import html
import io
import os
import re
import smtplib
from collections import defaultdict
from datetime import datetime, timedelta
from email.message import EmailMessage
from functools import lru_cache
from time import perf_counter
from typing import Callable, Dict, List, Optional, Set, Tuple
from uuid import uuid4

import httpx
import pandas as pd
import firebase_admin
from firebase_admin import credentials as fb_credentials, firestore
from fastapi import BackgroundTasks, FastAPI, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
from prometheus_client import Counter, Histogram, REGISTRY
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field, ConfigDict
from tenacity import retry, stop_after_attempt, wait_exponential

from config import get_settings
from db import AuditHistoryRepository, check_database
from logging_utils import configure_logging, get_logger

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger()

SCOPES = settings.drive_scopes
DEFAULT_FAILURE_KEYWORDS = ["not valid", "failed", "error", "mandatory", "missing"]
DEFAULT_STATUS_COLUMNS = [
    "Remarks",
    "Sent To Physician Status",
    "WAV Document Upload Status",
    "Signed By Physician Status",
    "Uploaded Signed Order Status",
    "Order Upload Status",
]
SIGNATURE_COLUMN = "Signed By Physician Date"
SENT_TO_PHYSICIAN_COLUMN = "Sent To Physician Date"
IDENTIFIER_COLUMNS = ["OrderId", "Order Number", "Document Id"]
PENDING_OVERDUE_THRESHOLD_DAYS = settings.pending_overdue_threshold_days
ALERT_FAILURE_THRESHOLD = settings.alert_failure_threshold
ALERT_WEBHOOK_URL = settings.alert_webhook_url
SUMMARY_WEBHOOK_URL = settings.summary_webhook_url or ALERT_WEBHOOK_URL
EMAIL_SMTP_HOST = settings.audit_email_host
EMAIL_SMTP_PORT = settings.audit_email_port
EMAIL_SMTP_USER = settings.audit_email_user
EMAIL_SMTP_PASSWORD = settings.audit_email_password
EMAIL_SMTP_SENDER = settings.audit_email_sender
EMAIL_SMTP_RECIPIENTS = [
    addr.strip()
    for addr in (settings.audit_email_recipients or "").split(",")
    if addr.strip()
]
EMAIL_SMTP_USE_TLS = settings.audit_email_use_tls
DEFAULT_BATCH_FOLDER_IDS = settings.batch_folder_ids
FIREBASE_CREDENTIALS_PATH = settings.firebase_credentials_path
FIREBASE_PROJECT_ID = settings.firebase_project_id

DRIVE_RETRY_CONFIG = {
    "stop": stop_after_attempt(5),
    "wait": wait_exponential(multiplier=1, min=1, max=8),
    "reraise": True,
}
WEBHOOK_RETRY_CONFIG = {
    "stop": stop_after_attempt(3),
    "wait": wait_exponential(multiplier=1, min=1, max=4),
    "reraise": True,
}

firestore_app = None
firestore_client: Optional[firestore.Client] = None


def _get_or_create_metric(name: str, factory: Callable[[], object]):
    registry_map = getattr(REGISTRY, "_names_to_collectors", {})
    collector = registry_map.get(name)
    if collector is not None:
        return collector
    return factory()


def _counter_factory(metric_name: str, documentation: str, labels: List[str]):
    return Counter(metric_name, documentation, labels)


def _histogram_factory(metric_name: str, documentation: str, labels: List[str]):
    return Histogram(metric_name, documentation, labels)


AUDIT_RUNS_TOTAL = _get_or_create_metric(
    "auditor_bot_runs_total",
    lambda: _counter_factory(
        "auditor_bot_runs_total",
        "Number of audit executions performed by the Auditor Bot",
        ["status"],
    ),
)
AUDIT_DURATION_SECONDS = _get_or_create_metric(
    "auditor_bot_run_duration_seconds",
    lambda: _histogram_factory(
        "auditor_bot_run_duration_seconds",
        "Histogram of audit execution durations",
        ["status"],
    ),
)
FILES_PROCESSED_TOTAL = _get_or_create_metric(
    "auditor_bot_files_processed_total",
    lambda: _counter_factory(
        "auditor_bot_files_processed_total",
        "Number of files processed across audits",
        ["template_type"],
    ),
)

AGENCY_CONFIG: Dict[str, Dict[str, List[str]]] = {
    "axxess": {
        "failure_keywords": DEFAULT_FAILURE_KEYWORDS + ["no patient", "non da"],
        "status_columns": DEFAULT_STATUS_COLUMNS,
    },
    "kinnser": {
        "failure_keywords": DEFAULT_FAILURE_KEYWORDS,
        "status_columns": DEFAULT_STATUS_COLUMNS + ["Order Upload Status"],
    },
}

app = FastAPI(title="Auditor Bot", version=settings.app_version)
instrumentator = Instrumentator(should_group_status_codes=True, excluded_handlers=["/metrics"])
instrumentator.instrument(app).expose(app, include_in_schema=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rpa-bot-1.vercel.app",
        "https://9f3bdf6c59b4.ngrok-free.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuditRequest(BaseModel):
    folder_id: str = Field(
        default="14us_-8r7FHA3VeVSAhcxgbmcrh7vG8EZ",
        description="Google Drive folder ID to audit.",
        example="14us_-8r7FHA3VeVSAhcxgbmcrh7vG8EZ"
    )


class BatchAuditRequest(BaseModel):
    folder_ids: Optional[List[str]] = Field(
        None, description="Folders to batch audit. Defaults to configured scheduler folders."
    )
    background: bool = Field(False, description="Run in FastAPI background task.")
    alert_threshold: Optional[float] = Field(
        None, description="Override default failure-rate threshold for alerts."
    )


class RunOrder(BaseModel):
    order_id: Optional[str] = Field(None, description="Order identifier if available.")
    status: str = Field(
        ...,
        pattern=r"^(signed|unsigned|success|failed)$",
        description="Order status (accepts signed/unsigned/success/failed).",
    )
    reason: Optional[str] = Field(None, description="Failure or remark reason.")
    ehr: Optional[str] = Field(None, description="EHR name if known.")
    agency: Optional[str] = Field(None, description="Agency name if known.")
    received_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None


class RunIngestRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "bot_id": "Axxess-LunaVista",
                "orders_total": 50,
                "orders_processed": 25,
                "success_rate": 50,
                "run_date": "01/21/2025",
                "bot_type": "signed",
                "ehr": "Axxess",
                "agency": "Luna Vista",
                "remark": "batch summary",
                "orders": [
                    {
                        "order_id": "order1",
                        "status": "failed",
                        "reason": "Patient Does not exist",
                        "ehr": "Axxess",
                        "agency": "Luna Vista",
                    },
                    {
                        "order_id": "order2",
                        "status": "success",
                        "reason": "",
                    },
                ],
            }
        }
    )

    bot_id: str
    orders_total: int = Field(..., ge=0)
    orders_processed: int = Field(..., ge=0)
    success_rate: Optional[float] = Field(None, ge=0, le=100)
    bot_type: Optional[str] = Field(None, description="Bot type if provided (signed/unsigned/etc.)")
    ehr: Optional[str] = Field(None, description="EHR for the batch (optional if per-order).")
    agency: Optional[str] = Field(None, description="Agency for the batch (optional if per-order).")
    run_date: Optional[str] = Field(None, description="Run date string from caller (optional).")
    remark: Optional[str] = Field(None, description="Common remark / reason")
    orders: Optional[List[RunOrder]] = Field(None, description="Optional per-order details.")


history_repository = AuditHistoryRepository()


def init_firestore() -> Optional[firestore.Client]:
    """Initialize and cache Firestore client. Returns None if credentials are missing."""
    global firestore_client
    if firestore_client is not None:
        return firestore_client

    if not os.path.exists(FIREBASE_CREDENTIALS_PATH):
        logger.warning("Firebase credentials not found at {}. Skipping Firestore init.", FIREBASE_CREDENTIALS_PATH)
        return None

    try:
        firebase_admin.get_app()
    except ValueError:
        cred = fb_credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        init_kwargs = {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None
        firebase_admin.initialize_app(cred, init_kwargs)

    firestore_client = firestore.client()
    return firestore_client


def get_firestore_or_503() -> firestore.Client:
    client = init_firestore()
    if client is None:
        raise HTTPException(status_code=503, detail="Firestore is not configured or credentials missing.")
    return client


def verify_bot_api_key(client: firestore.Client, bot_id: str, api_key: Optional[str]) -> Dict[str, object]:
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key.")

    doc = client.collection("bots").document(bot_id).get()
    if not doc.exists:
        raise HTTPException(status_code=401, detail="Unknown bot_id or inactive bot.")

    data = doc.to_dict() or {}
    if data.get("active") is False:
        raise HTTPException(status_code=403, detail="Bot is disabled.")

    stored_key = data.get("api_key") or data.get("api_key_plain")
    if not stored_key or stored_key != api_key:
        raise HTTPException(status_code=401, detail="Invalid API key.")

    return data


def _serialize_run_doc(doc) -> Dict[str, object]:
    payload = doc.to_dict() or {}
    for key, value in list(payload.items()):
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
    payload["run_id"] = doc.id
    return payload


def get_credentials() -> Credentials:
    credentials_path = os.environ.get(
        "GOOGLE_APPLICATION_CREDENTIALS", settings.google_credentials_path
    )
    if not os.path.exists(credentials_path):
        raise FileNotFoundError(
            "Google credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or place credentials.json in the project root."
        )
    return Credentials.from_service_account_file(credentials_path, scopes=SCOPES)


def get_drive_service():
    credentials = get_credentials()
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


@retry(**DRIVE_RETRY_CONFIG)
def fetch_order_files(service, folder_id: str) -> List[Dict[str, str]]:
    query = f"'{folder_id}' in parents and trashed=false and name contains 'OrderTemplate'"
    results = service.files().list(q=query, fields="files(id, name, mimeType, modifiedTime)").execute()
    return results.get("files", [])


@retry(**DRIVE_RETRY_CONFIG)
def list_drive_files(service, folder_id: str) -> List[Dict[str, str]]:
    results = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name, mimeType, modifiedTime, size)",
        orderBy="name",
    ).execute()
    return results.get("files", [])


@retry(**DRIVE_RETRY_CONFIG)
def download_drive_file(service, file_id: str) -> io.BytesIO:
    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)

    done = False
    while not done:
        _, done = downloader.next_chunk()

    buffer.seek(0)
    return buffer


def load_dataframe(file_name: str, file_stream: io.BytesIO) -> pd.DataFrame:
    try:
        if file_name.lower().endswith(".csv"):
            return pd.read_csv(file_stream)
        return pd.read_excel(file_stream)
    except pd.errors.EmptyDataError:
        return pd.DataFrame()


def infer_agency_from_filename(file_name: str) -> str:
    # Try to extract agency from pattern: ...{EHR}-{Agency}_...
    # Example: ...Axxess-LunaVistaHomeHealthcare_... or ...Kinnser-Loyal-HomeCare_...
    # We look for known EHR prefixes followed by a hyphen and then the agency name until an underscore.
    match = re.search(r'(?:Axxess|Kinnser|Athena|WellSky|HCHB)-([^_]+)', file_name, re.IGNORECASE)
    if match:
        # Replace hyphens with spaces for better readability (e.g. Loyal-HomeCare -> Loyal HomeCare)
        return match.group(1).replace('-', ' ')
        
    # Fallback to simple keyword matching
    lowered = file_name.lower()
    if "axxess" in lowered:
        return "Axxess"
    if "kinnser" in lowered:
        return "Kinnser"
    if "athena" in lowered:
        return "Athena"
    return "Unknown"

def infer_ehr_from_filename(file_name: str) -> str:
    lowered = file_name.lower()
    if "axxess" in lowered:
        return "Axxess"
    if "kinnser" in lowered:
        return "Kinnser"
    if "athena" in lowered:
        return "Athena"
    return "Unknown"


def determine_template_type(file_name: str) -> str:
    lowered = file_name.lower()
    if "unsigned" in lowered:
        return "unsigned"
    if "signed" in lowered:
        return "signed"
    return "mixed"


def derive_pair_key(file_name: str) -> str:
    base_name = os.path.splitext(file_name)[0]
    lowered = base_name.lower()
    markers = [
        "_signedordertemplate",
        "_unsignedordertemplate",
        "_signedorder",
        "_unsignedorder",
        "_signed",
        "_unsigned",
        "_ordertemplate",
    ]
    for marker in markers:
        idx = lowered.find(marker)
        if idx != -1:
            return base_name[:idx].rstrip("-_ ") or base_name
    return base_name


def resolve_agency_config(agency: str) -> Dict[str, List[str]]:
    config = AGENCY_CONFIG.get(agency.lower())
    if not config:
        return {
            "failure_keywords": DEFAULT_FAILURE_KEYWORDS,
            "status_columns": DEFAULT_STATUS_COLUMNS,
        }
    return config


@lru_cache(maxsize=32)
def compile_failure_pattern(keywords_tuple: Tuple[str, ...]):
    pattern = "|".join(re.escape(keyword) for keyword in keywords_tuple)
    return re.compile(pattern, re.IGNORECASE)


def build_failure_mask(
    df: pd.DataFrame, keywords: List[str], status_columns: List[str]
) -> Tuple[pd.Series, List[str], re.Pattern]:
    if df.empty:
        return pd.Series([], dtype=bool), [], compile_failure_pattern(tuple(sorted(set(keywords))))

    mask = pd.Series(False, index=df.index)
    inspected_columns: List[str] = []
    compiled_pattern = compile_failure_pattern(tuple(sorted(set(keywords))))

    for column in status_columns:
        if column in df.columns:
            inspected_columns.append(column)
            column_values = df[column].fillna("").astype(str)
            mask |= column_values.str.contains(compiled_pattern, na=False)

    row_text = df.fillna("").astype(str).agg(" ".join, axis=1)
    mask |= row_text.str.contains(compiled_pattern, na=False)

    return mask, inspected_columns, compiled_pattern


def extract_order_identifiers(df: pd.DataFrame) -> Set[str]:
    for column in IDENTIFIER_COLUMNS:
        if column in df.columns:
            return set(df[column].dropna().astype(str).str.strip())
    return set()


def compute_sla_metrics(df: pd.DataFrame) -> Dict[str, Optional[float]]:
    if SIGNATURE_COLUMN not in df.columns or SENT_TO_PHYSICIAN_COLUMN not in df.columns:
        return {
            "average_days_to_sign": None,
            "max_days_to_sign": None,
            "min_days_to_sign": None,
            "pending_overdue_count": None,
        }

    sent_dates = pd.to_datetime(df[SENT_TO_PHYSICIAN_COLUMN], errors="coerce")
    signed_dates = pd.to_datetime(df[SIGNATURE_COLUMN], errors="coerce")
    latency = (signed_dates - sent_dates).dt.days.dropna()

    pending_mask = signed_dates.isna() & sent_dates.notna()
    if pending_mask.any():
        pending_days = (datetime.utcnow() - sent_dates[pending_mask]).dt.days
        pending_overdue_count = int((pending_days > PENDING_OVERDUE_THRESHOLD_DAYS).sum())
    else:
        pending_overdue_count = 0

    if latency.empty:
        return {
            "average_days_to_sign": None,
            "max_days_to_sign": None,
            "min_days_to_sign": None,
            "pending_overdue_count": pending_overdue_count,
        }

    return {
        "average_days_to_sign": round(latency.mean(), 2),
        "max_days_to_sign": int(latency.max()),
        "min_days_to_sign": int(latency.min()),
        "pending_overdue_count": pending_overdue_count,
    }


def calculate_stats(df: pd.DataFrame, agency_config: Dict[str, List[str]]) -> Dict[str, object]:
    total_rows = int(len(df))

    if total_rows == 0:
        return {
            "total_rows": 0,
            "success_rate": "0.0%",
            "failure_rate": "0.0%",
            "signed_count": 0,
            "unsigned_count": 0,
            "failure_count": 0,
            "success_count": 0,
            "unique_failure_reasons": [],
            "failure_reason_counts": {},
            "inspected_status_columns": [],
            "sla_metrics": compute_sla_metrics(df),
        }

    failure_mask, inspected_columns, pattern = build_failure_mask(
        df,
        agency_config["failure_keywords"],
        agency_config["status_columns"],
    )

    failure_count = int(failure_mask.sum())
    success_count = total_rows - failure_count

    signature_dates = pd.to_datetime(df[SIGNATURE_COLUMN], errors="coerce") if SIGNATURE_COLUMN in df.columns else None
    signed_count = int(signature_dates.notna().sum()) if signature_dates is not None else 0
    unsigned_count = total_rows - signed_count

    success_rate = (success_count / total_rows) * 100
    failure_rate = 100.0 - success_rate

    unique_failure_reasons: List[str] = []
    failure_reason_counts: Dict[str, int] = {}
    failure_details: Dict[str, List[str]] = defaultdict(list)

    if failure_count:
        collected_series: List[pd.Series] = []

        # Vectorized collection for counts (existing logic)
        if "Remarks" in df.columns:
            remarks = df.loc[failure_mask, "Remarks"].dropna().astype(str).str.strip()
            remarks = remarks[remarks != ""]
            if not remarks.empty:
                collected_series.append(remarks)

        for column in inspected_columns:
            if column == "Remarks" or column not in df.columns:
                continue
            column_values = df.loc[failure_mask, column].dropna().astype(str).str.strip()
            column_values = column_values[column_values != ""]
            if column_values.empty:
                continue
            column_values = column_values[column_values.str.contains(pattern, na=False)]
            if not column_values.empty:
                collected_series.append(column_values)

        if collected_series:
            combined = pd.concat(collected_series, ignore_index=True)
            unique_failure_reasons = combined.unique().tolist()
            failure_reason_counts = combined.value_counts().to_dict()

        # Iterative collection for detailed mapping (new logic)
        # Iterate only over failed rows to map reasons to identifiers
        failed_rows = df[failure_mask]
        for idx, row in failed_rows.iterrows():
            # Determine identifier (Order ID or Row Number)
            identifier = f"Row {idx + 2}"  # Default to Excel row (header + 1-based)
            for col in IDENTIFIER_COLUMNS:
                if col in df.columns and pd.notna(row[col]):
                    val = str(row[col]).strip()
                    if val:
                        identifier = val
                        break
            
            # Check Remarks
            if "Remarks" in df.columns:
                remark = str(row["Remarks"]).strip() if pd.notna(row["Remarks"]) else ""
                if remark:
                    failure_details[remark].append(identifier)
            
            # Check other columns
            for column in inspected_columns:
                if column == "Remarks" or column not in df.columns:
                    continue
                val = str(row[column]).strip() if pd.notna(row[column]) else ""
                if val and re.search(pattern, val):
                    failure_details[val].append(identifier)

    return {
        "total_rows": total_rows,
        "success_rate": f"{success_rate:.1f}%",
        "failure_rate": f"{failure_rate:.1f}%",
        "signed_count": signed_count,
        "unsigned_count": unsigned_count,
        "failure_count": failure_count,
        "success_count": success_count,
        "unique_failure_reasons": unique_failure_reasons,
        "failure_reason_counts": failure_reason_counts,
        "failure_details": dict(failure_details),
        "inspected_status_columns": inspected_columns,
        "sla_metrics": compute_sla_metrics(df),
    }


def analyze_file(df: pd.DataFrame, file_name: str, agency: str) -> Dict[str, object]:
    agency_config = resolve_agency_config(agency)
    stats = calculate_stats(df, agency_config)
    order_ids = extract_order_identifiers(df)
    template_type = determine_template_type(file_name)
    ehr = infer_ehr_from_filename(file_name)

    return {
        "agency": agency,
        "ehr": ehr,
        "file_name": file_name,
        "template_type": template_type,
        "pair_key": derive_pair_key(file_name),
        "stats": stats,
        "unique_failure_reasons": stats["unique_failure_reasons"],
        "failure_reason_counts": stats["failure_reason_counts"],
        "order_ids": order_ids,
    }


def _coerce_order_ids(payload: Optional[Set[str]]) -> Set[str]:
    if not payload:
        return set()
    return {str(item) for item in payload}


def summarize_pair_entries(signed: Optional[Dict[str, object]], unsigned: Optional[Dict[str, object]]):
    signed_stats = signed.get("stats") if signed else None
    unsigned_stats = unsigned.get("stats") if unsigned else None

    signed_ids = _coerce_order_ids(signed.get("order_ids")) if signed else set()
    unsigned_ids = _coerce_order_ids(unsigned.get("order_ids")) if unsigned else set()

    pending_signature_orders = sorted(unsigned_ids - signed_ids)
    signed_without_unsigned_source = sorted(signed_ids - unsigned_ids)

    def safe_failure_rate(entry_stats: Optional[Dict[str, object]]):
        if not entry_stats:
            return None
        return entry_stats["failure_rate"]

    def safe_success_rate(entry_stats: Optional[Dict[str, object]]):
        if not entry_stats:
            return None
        return entry_stats["success_rate"]

    documents_processed = {
        "signed": signed_stats["total_rows"] if signed_stats else 0,
        "unsigned": unsigned_stats["total_rows"] if unsigned_stats else 0,
    }

    combined_failures: List[str] = []
    if unsigned:
        combined_failures.extend(unsigned.get("unique_failure_reasons", []))
    if signed:
        combined_failures.extend(signed.get("unique_failure_reasons", []))
    dominant_failures = list(dict.fromkeys(combined_failures))[:5]

    return {
        "documents_processed": documents_processed,
        "failure_rate_unsigned": safe_failure_rate(unsigned_stats),
        "failure_rate_signed": safe_failure_rate(signed_stats),
        "success_rate_unsigned": safe_success_rate(unsigned_stats),
        "success_rate_signed": safe_success_rate(signed_stats),
        "pending_signature_orders": pending_signature_orders,
        "signed_without_unsigned_source": signed_without_unsigned_source,
        "dominant_failure_reasons": dominant_failures,
    }


def build_pair_results(results: List[Dict[str, object]]) -> List[Dict[str, object]]:
    pair_map: Dict[Tuple[str, str], Dict[str, Optional[Dict[str, object]]]] = {}
    ordered_keys: List[Tuple[str, str]] = []

    for entry in results:
        pair_key = entry.get("pair_key") or derive_pair_key(entry["file_name"])
        agency = entry.get("agency", "Unknown")
        composite_key = (agency, pair_key)
        if composite_key not in pair_map:
            pair_map[composite_key] = {"signed": None, "unsigned": None}
            ordered_keys.append(composite_key)
        template_type = entry.get("template_type") or "mixed"
        bucket_key = "signed" if template_type == "signed" else "unsigned"
        pair_map[composite_key][bucket_key] = entry

    paired_results: List[Dict[str, object]] = []
    for composite_key in ordered_keys:
        payload = pair_map[composite_key]
        signed_entry = payload.get("signed")
        unsigned_entry = payload.get("unsigned")
        representative = signed_entry or unsigned_entry
        if not representative:
            continue
        paired_results.append(
            {
                "pair_key": composite_key[1],
                "agency": composite_key[0],
                "signed": signed_entry,
                "unsigned": unsigned_entry,
                "combined_summary": summarize_pair_entries(signed_entry, unsigned_entry),
            }
        )
    return paired_results


def build_reconciliation_summary(results: List[Dict[str, object]]) -> List[Dict[str, object]]:
    if not results:
        return []

    grouped: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: {"signed": set(), "unsigned": set()})
    for entry in results:
        agency = entry["agency"]
        template_type = entry.get("template_type", "mixed")
        if template_type == "signed":
            grouped[agency]["signed"].update(entry.get("order_ids", set()))
        elif template_type == "unsigned":
            grouped[agency]["unsigned"].update(entry.get("order_ids", set()))

    reconciliation = []
    for agency, payload in grouped.items():
        unsigned_pending = sorted(payload["unsigned"] - payload["signed"])
        signed_without_unsigned = sorted(payload["signed"] - payload["unsigned"])
        reconciliation.append(
            {
                "agency": agency,
                "unsigned_total": len(payload["unsigned"]),
                "signed_total": len(payload["signed"]),
                "pending_signature_orders": unsigned_pending,
                "signed_without_unsigned_source": signed_without_unsigned,
            }
        )
    return reconciliation


def _record_audit_metrics(status: str, start_time: float) -> None:
    elapsed = max(perf_counter() - start_time, 0.0)
    AUDIT_RUNS_TOTAL.labels(status=status).inc()
    AUDIT_DURATION_SECONDS.labels(status=status).observe(elapsed)


@retry(**DRIVE_RETRY_CONFIG)
def _probe_drive_root(service) -> None:
    service.files().get(fileId="root", fields="id").execute()


def check_drive_health() -> Tuple[bool, Optional[str]]:
    try:
        service = get_drive_service()
        _probe_drive_root(service)
        return True, None
    except Exception as err:  # pylint: disable=broad-except
        logger.warning("Drive health check failed: {}", err)
        return False, str(err)


@retry(**WEBHOOK_RETRY_CONFIG)
def _post_json_with_retry(url: str, payload: Dict[str, object]) -> None:
    response = httpx.post(url, json=payload, timeout=10.0)
    response.raise_for_status()


def send_alerts(results: List[Dict[str, object]], threshold: Optional[float] = None) -> None:
    if not ALERT_WEBHOOK_URL:
        logger.debug("Alert webhook URL missing; skipping alert dispatch.")
        return

    threshold_value = threshold if threshold is not None else ALERT_FAILURE_THRESHOLD
    high_failures = [
        result for result in results if float(result["stats"]["failure_rate"].rstrip("%")) >= threshold_value
    ]

    if not high_failures:
        logger.debug("No agencies breached the alert threshold ({}).", threshold_value)
        return

    payload = {
        "text": "RPA Auditor Alert",
        "alerts": [
            {
                "agency": result["agency"],
                "file_name": result["file_name"],
                "failure_rate": result["stats"]["failure_rate"],
                "unique_failure_reasons": result["unique_failure_reasons"],
            }
            for result in high_failures
        ],
    }

    try:
        _post_json_with_retry(ALERT_WEBHOOK_URL, payload)
        logger.info("Dispatched {} alert notifications via webhook.", len(high_failures))
    except httpx.HTTPError as err:
        logger.exception("Failed to dispatch alert webhook: {}", err)


def send_summary_notification(
    results: List[Dict[str, object]],
    audit_timestamp: str,
    paired_results: Optional[List[Dict[str, object]]] = None,
) -> None:
    if not SUMMARY_WEBHOOK_URL:
        logger.debug("Summary webhook unavailable; skipping.")
        return
    if not results and not paired_results:
        logger.debug("No results available for summary webhook; skipping.")
        return

    formatted_results = []
    for result in results:
        stats = result["stats"]
        formatted_results.append(
            {
                "agency": result["agency"],
                "file_name": result["file_name"],
                "template_type": result.get("template_type"),
                "success_rate": stats["success_rate"],
                "failure_rate": stats["failure_rate"],
                "signed_count": stats["signed_count"],
                "unsigned_count": stats["unsigned_count"],
                "top_failure_reasons": result.get("unique_failure_reasons", [])[:3],
            }
        )

    paired_formatted = []
    for pair in paired_results or []:
        summary = pair.get("combined_summary", {})
        paired_formatted.append(
            {
                "pair_key": pair.get("pair_key"),
                "agency": pair.get("agency"),
                "signed_file": pair.get("signed", {}).get("file_name") if pair.get("signed") else None,
                "unsigned_file": pair.get("unsigned", {}).get("file_name") if pair.get("unsigned") else None,
                "combined_summary": summary,
            }
        )

    payload = {
        "text": "RPA Auditor Daily Summary",
        "audit_timestamp": audit_timestamp,
        "summary": formatted_results,
        "paired_summary": paired_formatted,
        "message": "Hey buddy, here is the automation audit summary for the agencies processed today.",
    }

    try:
        _post_json_with_retry(SUMMARY_WEBHOOK_URL, payload)
        logger.info(
            "Posted summary notification for {} per-file sets and {} paired groups.",
            len(results),
            len(paired_formatted),
        )
    except httpx.HTTPError as err:
        logger.exception("Failed to publish summary webhook: {}", err)


@retry(**WEBHOOK_RETRY_CONFIG)
def _send_email_via_smtp(message: EmailMessage) -> None:
    with smtplib.SMTP(EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, timeout=30) as server:
        if EMAIL_SMTP_USE_TLS:
            server.starttls()
        if EMAIL_SMTP_USER and EMAIL_SMTP_PASSWORD:
            server.login(EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD)
        server.send_message(message)


def build_email_content(
    audit_timestamp: str,
    results: List[Dict[str, object]],
    reconciliation: List[Dict[str, object]],
    paired_results: Optional[List[Dict[str, object]]] = None,
) -> Tuple[str, str]:
    text_lines = [
        f"RPA Auditor Summary - {audit_timestamp}",
        "",
    ]

    cards_html: List[str] = []
    pair_cards_html: List[str] = []

    for result in results:
        stats = result["stats"]
        top_failures = result.get("unique_failure_reasons", [])[:3]

        text_lines.extend(
            [
                f"Agency: {result['agency']} ({result.get('template_type', 'mixed')})",
                f"File: {result['file_name']}",
                f"Success Rate: {stats['success_rate']} | Failure Rate: {stats['failure_rate']}",
                f"Signed: {stats['signed_count']} | Unsigned: {stats['unsigned_count']}",
                "Top Failure Reasons: " + (", ".join(top_failures) or "None"),
                "",
            ]
        )

        card_html = f"""
        <div style="border:1px solid #e3e8ef;border-radius:10px;padding:16px;margin-bottom:14px;background:#ffffff;box-shadow:0 1px 2px rgba(15,23,42,0.08);">
            <div style="font-size:16px;font-weight:600;color:#111827;">{html.escape(result['agency'])}
                <span style="font-size:12px;font-weight:500;color:#6b7280;margin-left:6px;">({html.escape(result.get('template_type', 'mixed'))})</span>
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">{html.escape(result['file_name'])}</div>
            <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:120px;background:#ecfdf5;border-radius:8px;padding:12px;">
                    <div style="font-size:11px;color:#047857;text-transform:uppercase;">Success</div>
                    <div style="font-size:20px;font-weight:700;color:#065f46;">{stats['success_rate']}</div>
                </div>
                <div style="flex:1;min-width:120px;background:#fef2f2;border-radius:8px;padding:12px;">
                    <div style="font-size:11px;color:#b91c1c;text-transform:uppercase;">Failure</div>
                    <div style="font-size:20px;font-weight:700;color=#991b1b;">{stats['failure_rate']}</div>
                </div>
                <div style="flex:1;min-width:120px;background:#eef2ff;border-radius:8px;padding:12px;">
                    <div style="font-size:11px;color:#4338ca;text-transform:uppercase;">Signed vs Pending</div>
                    <div style="font-size:20px;font-weight:700;color:#312e81;">{stats['signed_count']} / {stats['unsigned_count']}</div>
                </div>
            </div>
            <div style="margin-top:12px;font-size:12px;color:#374151;">
                <strong>Top failure reasons:</strong> {html.escape(', '.join(top_failures) or 'None')}
            </div>
        </div>
        """
        cards_html.append(card_html)

    if paired_results:
        text_lines.append("Signed/Unsigned Pair Highlights:")
        for pair in paired_results:
            summary = pair.get("combined_summary", {})
            signed_entry = pair.get("signed") or {}
            unsigned_entry = pair.get("unsigned") or {}
            pending_count = len(summary.get("pending_signature_orders", []) or [])
            orphaned_signed_count = len(summary.get("signed_without_unsigned_source", []) or [])
            documents_processed = summary.get("documents_processed", {})
            text_lines.extend(
                [
                    f"Pair: {pair.get('pair_key')} ({pair.get('agency')})",
                    f"Signed file: {signed_entry.get('file_name', 'missing')} | Unsigned file: {unsigned_entry.get('file_name', 'missing')}",
                    f"Docs processed -> signed: {documents_processed.get('signed', 0)}, unsigned: {documents_processed.get('unsigned', 0)}",
                    f"Pending signatures: {pending_count} | Signed without unsigned source: {orphaned_signed_count}",
                    "",
                ]
            )
            card_html = f"""
            <div style="border:1px solid #dbeafe;border-radius:10px;padding:16px;margin-bottom:12px;background:#eff6ff;">
                <div style="font-size:15px;font-weight:600;color:#1d4ed8;">
                    {html.escape(str(pair.get('pair_key')))}
                    <span style="font-size:11px;color:#1e3a8a;margin-left:6px;">{html.escape(pair.get('agency', 'Unknown'))}</span>
                </div>
                <div style="font-size:12px;color:#1e3a8a;margin-top:2px;">
                    Signed: {html.escape(str(signed_entry.get('file_name', 'missing')))} | Unsigned: {html.escape(str(unsigned_entry.get('file_name', 'missing')))}
                </div>
                <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:10px;">
                        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;">Docs Processed</div>
                        <div style="font-size:18px;font-weight:700;color:#111827;">{documents_processed.get('signed', 0)} signed / {documents_processed.get('unsigned', 0)} unsigned</div>
                    </div>
                    <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:10px;">
                        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;">Failure Rate</div>
                        <div style="font-size:18px;font-weight:700;color:#dc2626;">S: {summary.get('failure_rate_signed') or 'n/a'} | U: {summary.get('failure_rate_unsigned') or 'n/a'}</div>
                    </div>
                    <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:10px;">
                        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;">Pending Signatures</div>
                        <div style="font-size:18px;font-weight:700;color:#1d4ed8;">{pending_count}</div>
                    </div>
                </div>
                <div style="margin-top:8px;font-size:12px;color:#1e3a8a;">
                    Signed without unsigned source: {orphaned_signed_count}<br/>
                    Dominant failures: {html.escape(', '.join(summary.get('dominant_failure_reasons') or []) or 'None')}
                </div>
            </div>
            """
            pair_cards_html.append(card_html)

    if reconciliation:
        text_lines.append("Reconciliation Highlights:")
        recon_rows = []
        for item in reconciliation:
            text_lines.append(
                f"- {item['agency']}: {len(item['pending_signature_orders'])} pending signatures, "
                f"{len(item['signed_without_unsigned_source'])} signed without source"
            )
            recon_rows.append(
                f"""
                <tr>
                    <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">{html.escape(item['agency'])}</td>
                    <td style="padding:8px 12px;border:1px solid #e5e7eb;">{len(item['pending_signature_orders'])}</td>
                    <td style="padding:8px 12px;border:1px solid #e5e7eb;">{len(item['signed_without_unsigned_source'])}</td>
                </tr>
                """
            )
        text_lines.append("")
        reconciliation_html = f"""
        <div style="margin-top:18px;">
            <div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:8px;">Reconciliation Highlights</div>
            <table style="border-collapse:collapse;width:100%;font-size:13px;background:#ffffff;border-radius:10px;overflow:hidden;">
                <thead style="background:#f9fafb;color:#4b5563;text-transform:uppercase;font-size:11px;">
                    <tr>
                        <th style="text-align:left;padding:10px 12px;border:1px solid #e5e7eb;">Agency</th>
                        <th style="text-align:left;padding:10px 12px;border:1px solid #e5e7eb;">Pending Signatures</th>
                        <th style="text-align:left;padding:10px 12px;border:1px solid #e5e7eb;">Signed Without Source</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(recon_rows)}
                </tbody>
            </table>
        </div>
        """
    else:
        reconciliation_html = ""

    text_lines.append("Automated message generated by the RPA Auditor Bot.")

    pair_section_html = ""
    if pair_cards_html:
        pair_section_html = f"""
        <div style="margin-top:18px;">
            <div style="font-size:15px;font-weight:600;color:#1f2937;margin-bottom:8px;">Signed/Unsigned Pair Highlights</div>
            {''.join(pair_cards_html)}
        </div>
        """

    html_body = f"""
    <html>
    <body style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; background:#f3f4f6; padding:24px; color:#111827;">
        <div style="max-width:680px;margin:0 auto;">
            <div style="background:#111827;color:#f9fafb;border-radius:12px;padding:18px 24px;margin-bottom:18px;">
                <div style="font-size:20px;font-weight:600;">RPA Auditor Summary</div>
                <div style="font-size:13px;color:#cbd5f5;">{audit_timestamp}</div>
                <div style="margin-top:6px;font-size:14px;color:#e5e7eb;">Hey buddy, here is your detailed automation audit report.</div>
            </div>
            {''.join(cards_html)}
            {pair_section_html}
            {reconciliation_html}
            
            <div style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:24px;text-align:center;">
                <div style="font-size:14px;color:#374151;margin-bottom:12px;">
                    Want to dive deeper into the data? 🕵️‍♂️
                </div>
                <div style="font-size:14px;color:#374151;">
                    <a href="https://afecc10f3c8b.ngrok-free.app/" style="color:#2563eb;text-decoration:underline;font-weight:600;">Click here</a> to access the full interactive dashboard.
                </div>
                <div style="margin-top:24px;font-size:12px;color:#9ca3af;">
                    (This link connects securely to your local RPA bot)
                </div>
            </div>

            <div style="margin-top:24px;font-size:12px;color:#6b7280;text-align:center;">
                Automated message generated by the RPA Auditor Bot.
            </div>
        </div>
    </body>
    </html>
    """

    text_lines.append("")
    text_lines.append("Want more info? You can view the full interactive dashboard here:")
    text_lines.append("https://afecc10f3c8b.ngrok-free.app/")
    text_lines.append("")
    text_lines.append("Automated message generated by the RPA Auditor Bot.")

    return "\n".join(text_lines), html_body


def send_email_summary(
    audit_timestamp: str,
    results: List[Dict[str, object]],
    reconciliation: List[Dict[str, object]],
    paired_results: Optional[List[Dict[str, object]]] = None,
) -> None:
    if not (
        EMAIL_SMTP_HOST
        and EMAIL_SMTP_SENDER
        and EMAIL_SMTP_RECIPIENTS
    ):
        return

    text_body, html_body = build_email_content(audit_timestamp, results, reconciliation, paired_results)
    msg = EmailMessage()
    msg["Subject"] = f"RPA Audit Summary | {audit_timestamp}"
    msg["From"] = EMAIL_SMTP_SENDER
    msg["To"] = ", ".join(EMAIL_SMTP_RECIPIENTS)
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        logger.info(
            "Sending summary email to {} recipients via {}.",
            len(EMAIL_SMTP_RECIPIENTS),
            EMAIL_SMTP_HOST,
        )
        _send_email_via_smtp(msg)
        logger.info("Summary email dispatched successfully.")
    except Exception as err:  # pylint: disable=broad-except
        logger.exception("Summary email delivery failed: {}", err)


def run_audit(folder_id: str, alert_threshold: Optional[float] = None) -> Dict[str, object]:
    audit_id = str(uuid4())
    start_time = perf_counter()

    with logger.contextualize(audit_id=audit_id):
        logger.info("Starting audit for folder {}", folder_id)
        try:
            drive_service = get_drive_service()
            files = fetch_order_files(drive_service, folder_id)
        except FileNotFoundError as err:
            logger.error("Credentials missing for audit {}: {}", audit_id, err)
            _record_audit_metrics("configuration_error", start_time)
            raise HTTPException(status_code=500, detail=str(err)) from err
        except HttpError as err:
            logger.error("Drive service initialization failed for audit {}: {}", audit_id, err)
            _record_audit_metrics("drive_error", start_time)
            raise HTTPException(status_code=502, detail=f"Google Drive API error: {err}") from err

        logger.info("Retrieved {} candidate files from folder {}", len(files), folder_id)

        if not files:
            logger.warning("No OrderTemplate files found in folder {}", folder_id)
            _record_audit_metrics("no_files", start_time)
            raise HTTPException(status_code=404, detail="No OrderTemplate files found in the provided folder.")

        audit_results: List[Dict[str, object]] = []
        for file_meta in files:
            file_name = file_meta.get("name", "UnknownFile")
            file_id = file_meta.get("id", "unknown-id")
            logger.info("Processing Drive file {} ({})", file_name, file_id)
            try:
                file_stream = download_drive_file(drive_service, file_meta["id"])
                df = load_dataframe(file_name, file_stream)
                agency = infer_agency_from_filename(file_name)
                analysis = analyze_file(df, file_name, agency)
            except HttpError as err:
                logger.error("Failed to download {} ({}): {}", file_name, file_id, err)
                _record_audit_metrics("drive_error", start_time)
                raise HTTPException(status_code=502, detail=f"Failed to download {file_name}: {err}") from err
            except Exception as err:  # pylint: disable=broad-except
                logger.exception("Processing error for {} ({}): {}", file_name, file_id, err)
                _record_audit_metrics("processing_error", start_time)
                raise HTTPException(status_code=500, detail=f"Processing error for {file_name}: {err}") from err

            audit_results.append(analysis)
            template_label = analysis.get("template_type") or "mixed"
            FILES_PROCESSED_TOTAL.labels(template_type=template_label).inc()

        audit_timestamp = datetime.utcnow().isoformat()
        for entry in audit_results:
            history_repository.save_run(audit_timestamp, folder_id, entry)

        paired_results = build_pair_results(audit_results)
        reconciliation_summary = build_reconciliation_summary(audit_results)
        send_alerts(audit_results, alert_threshold)
        send_summary_notification(audit_results, audit_timestamp, paired_results)
        send_email_summary(audit_timestamp, audit_results, reconciliation_summary, paired_results)

        result = {
            "status": "success",
            "audit_timestamp": audit_timestamp,
            "audit_results": audit_results,
            "paired_results": paired_results,
            "reconciliation_summary": reconciliation_summary,
        }
        
        # Save the full batch result for the dashboard
        history_repository.save_batch(audit_timestamp, folder_id, result)

        logger.info(
            "Audit {} completed for folder {} with {} files processed.",
            audit_id,
            folder_id,
            len(audit_results),
        )
        _record_audit_metrics("success", start_time)
        return result


def run_batch_audit(folder_ids: List[str], alert_threshold: Optional[float] = None) -> Dict[str, object]:
    batch_summary = []
    for folder_id in folder_ids:
        try:
            result = run_audit(folder_id, alert_threshold)
        except HTTPException as err:
            batch_summary.append({"folder_id": folder_id, "error": err.detail})
            continue
        batch_summary.append({"folder_id": folder_id, "result": result})
    return {"status": "completed", "batch": batch_summary}


@app.post("/api/rpa/runs")
def ingest_run(request: RunIngestRequest):
    client = get_firestore_or_503()

    return _persist_run(client, request)


def _persist_run(client: firestore.Client, request: RunIngestRequest) -> Dict[str, object]:

    orders_total = request.orders_total
    orders_processed = request.orders_processed
    if orders_processed > orders_total:
        raise HTTPException(status_code=400, detail="orders_processed cannot exceed orders_total.")

    computed_success = request.success_rate
    if computed_success is None:
        computed_success = (orders_processed / orders_total) * 100 if orders_total > 0 else 0.0
    computed_success = max(0.0, min(100.0, round(computed_success, 2)))

    remark = (request.remark or "").strip()
    if len(remark) > 200:
        remark = remark[:200]

    run_ref = client.collection("runs").document()
    now_dt = datetime.utcnow()
    run_date = request.run_date or None
    run_doc = {
        "bot_id": request.bot_id,
        "timestamp": firestore.SERVER_TIMESTAMP,
        "timestamp_iso": now_dt.isoformat(),
        "run_date": run_date,
        "bot_type": request.bot_type,
        "ehr": request.ehr,
        "agency": request.agency,
        "orders_total": orders_total,
        "orders_processed": orders_processed,
        "orders_unsigned": max(orders_total - orders_processed, 0),
        "success_rate": computed_success,
        "remark": remark,
        "source": "push",
        "meta": {},
    }

    run_ref.set(run_doc)

    if request.orders:
        batch = client.batch()
        orders_ref = run_ref.collection("orders")
        for order in request.orders:
            order_payload = order.dict()
            order_payload.setdefault("ehr", request.ehr)
            order_payload.setdefault("agency", request.agency)
            order_payload["created_at"] = firestore.SERVER_TIMESTAMP
            order_ref = orders_ref.document(order.order_id) if order.order_id else orders_ref.document()
            batch.set(order_ref, order_payload)
        batch.commit()

    return {"status": "ok", "run_id": run_ref.id}


@app.post("/api/rpa/runs/bulk")
def ingest_runs_bulk(requests: List[RunIngestRequest]):
    client = get_firestore_or_503()

    results = []
    for req in requests:
        try:
            results.append(_persist_run(client, req))
        except HTTPException as err:
            results.append({"status": "error", "detail": err.detail, "bot_id": req.bot_id})

    return {"status": "ok", "results": results}


@app.get("/api/rpa/runs/latest")
def latest_run(bot_id: str, x_api_key: Optional[str] = Header(None)):
    client = get_firestore_or_503()
    verify_bot_api_key(client, bot_id, x_api_key)

    runs_ref = client.collection("runs")
    docs = list(
        runs_ref.where("bot_id", "==", bot_id)
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="No runs found for this bot.")

    return {"status": "success", "run": _serialize_run_doc(docs[0])}


@app.get("/api/rpa/runs/summary")
def summary_run(bot_id: str, range_days: int = 7, x_api_key: Optional[str] = Header(None)):
    if range_days <= 0:
        range_days = 7

    client = get_firestore_or_503()
    verify_bot_api_key(client, bot_id, x_api_key)

    start_time = datetime.utcnow() - timedelta(days=range_days)
    runs_ref = client.collection("runs")
    docs = list(
        runs_ref.where("bot_id", "==", bot_id)
        .where("timestamp", ">=", start_time)
        .order_by("timestamp")
        .stream()
    )

    if not docs:
        return {
            "status": "success",
            "summary": {
                "runs": 0,
                "orders_total": 0,
                "orders_processed": 0,
                "orders_unsigned": 0,
                "success_rate": 0.0,
                "top_remarks": [],
                "trend": [],
            },
        }

    total_orders = 0
    total_processed = 0
    remark_counts: Dict[str, int] = {}
    trend: Dict[str, Dict[str, int]] = {}

    for doc in docs:
        data = doc.to_dict() or {}
        orders_total = int(data.get("orders_total", 0) or 0)
        orders_processed = int(data.get("orders_processed", 0) or 0)
        total_orders += orders_total
        total_processed += orders_processed

        sr = data.get("success_rate")
        if sr is None and orders_total > 0:
            sr = (orders_processed / orders_total) * 100

        remark = (data.get("remark") or "").strip()
        if remark:
            remark_counts[remark] = remark_counts.get(remark, 0) + 1

        ts = data.get("timestamp")
        if isinstance(ts, datetime):
            bucket = ts.date().isoformat()
            if bucket not in trend:
                trend[bucket] = {"orders_total": 0, "orders_processed": 0}
            trend[bucket]["orders_total"] += orders_total
            trend[bucket]["orders_processed"] += orders_processed

    success_rate_overall = 0.0
    if total_orders > 0:
        success_rate_overall = round((total_processed / total_orders) * 100, 2)

    top_remarks = sorted(remark_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]
    trend_list = [
        {"date": day, "orders_total": payload["orders_total"], "orders_processed": payload["orders_processed"]}
        for day, payload in sorted(trend.items())
    ]

    return {
        "status": "success",
        "summary": {
            "runs": len(docs),
            "orders_total": total_orders,
            "orders_processed": total_processed,
            "orders_unsigned": max(total_orders - total_processed, 0),
            "success_rate": success_rate_overall,
            "top_remarks": top_remarks,
            "trend": trend_list,
        },
    }


@app.post("/audit-agency-data")
def audit_agency_data(request: AuditRequest):
    folder_id = request.folder_id or "14us_-8r7FHA3VeVSAhcxgbmcrh7vG8EZ"
    if not folder_id:
        raise HTTPException(status_code=400, detail="No folder ID provided.")
    return run_audit(folder_id)


@app.post("/batch-audit")
def batch_audit(request: BatchAuditRequest, background_tasks: BackgroundTasks):
    folder_ids = request.folder_ids or DEFAULT_BATCH_FOLDER_IDS
    if not folder_ids:
        raise HTTPException(status_code=400, detail="No folder IDs provided for batch audit.")

    if request.background:
        background_tasks.add_task(run_batch_audit, folder_ids, request.alert_threshold)
        return {"status": "accepted", "folders": folder_ids}
    return run_batch_audit(folder_ids, request.alert_threshold)


@app.get("/drive-files/{folder_id}")
def drive_files(folder_id: str):
    try:
        service = get_drive_service()
        files = list_drive_files(service, folder_id)
    except FileNotFoundError as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    except HttpError as err:
        raise HTTPException(status_code=502, detail=f"Google Drive API error: {err}") from err

    return {
        "status": "success",
        "files": [
            {
                "id": file_meta.get("id"),
                "name": file_meta.get("name"),
                "mimeType": file_meta.get("mimeType"),
                "modifiedTime": file_meta.get("modifiedTime"),
                "size": file_meta.get("size"),
            }
            for file_meta in files
        ],
    }


@app.get("/audit-history")
def audit_history(limit: int = 25):
    # Prefer full batch summaries if available, otherwise fall back to individual runs (or return both?)
    # The dashboard expects a list of "audits".
    # If we return batches, they contain the full details.
    batches = history_repository.fetch_recent_batches(limit)
    if batches:
        return {"status": "success", "history": batches}
    
    # Fallback to old behavior if no batches found (e.g. old data)
    return {"status": "success", "history": history_repository.fetch_recent(limit)}


@app.get("/healthz")
def healthz():
    db_ok = check_database()
    drive_ok, drive_detail = check_drive_health()
    overall_status = "ok" if db_ok and drive_ok else "degraded"

    database_status = {"status": "ok" if db_ok else "error"}
    drive_status = {"status": "ok" if drive_ok else "error"}
    if drive_detail:
        drive_status["detail"] = drive_detail

    return {
        "status": overall_status,
        "app_version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {
            "database": database_status,
            "drive": drive_status,
        },
    }

# Mount the frontend static files
# Ensure the directory exists before mounting to avoid errors if build is missing
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    
    # Catch-all route for React SPA (must be last)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # If the path is an API route that wasn't matched above, return 404
        # (FastAPI checks specific routes first, so this only catches unmatched ones)
        if full_path.startswith("api/") or full_path.startswith("audit-history") or full_path.startswith("healthz"):
             raise HTTPException(status_code=404, detail="Not Found")
        
        # Serve index.html for any other route (React Router handles the rest)
        return FileResponse("frontend/dist/index.html")
else:
    logger.warning("Frontend build directory 'frontend/dist' not found. Dashboard will not be served.")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
