from __future__ import annotations

from contextlib import contextmanager
from typing import Dict, List

from sqlalchemy import Column, Float, Integer, MetaData, String, Table, Text, create_engine, select, text
from sqlalchemy.engine import Engine

from config import get_settings

settings = get_settings()
engine: Engine = create_engine(settings.database_url, future=True)
metadata = MetaData()


audit_runs = Table(
    "audit_runs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", String, nullable=False),
    Column("folder_id", String, nullable=False),
    Column("agency", String, nullable=False),
    Column("file_name", String, nullable=False),
    Column("total_rows", Integer),
    Column("success_rate", Float),
    Column("failure_rate", Float),
    Column("success_count", Integer),
    Column("failure_count", Integer),
    Column("signed_count", Integer),
    Column("unsigned_count", Integer),
    Column("unique_failure_reasons", Text),
    Column("failure_reason_counts", Text),
)


audit_batches = Table(
    "audit_batches",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("timestamp", String, nullable=False),
    Column("folder_id", String, nullable=False),
    Column("full_result", Text, nullable=False),
)


def init_db() -> None:
    metadata.create_all(engine)


@contextmanager
def get_connection():
    with engine.begin() as connection:
        yield connection


def check_database() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


class AuditHistoryRepository:
    """Persistence helper around the audit_runs table."""

    def __init__(self) -> None:
        init_db()

    def save_run(self, timestamp: str, folder_id: str, entry: Dict[str, object]) -> None:
        stats = entry["stats"]
        with get_connection() as conn:
            conn.execute(
                audit_runs.insert().values(
                    timestamp=timestamp,
                    folder_id=folder_id,
                    agency=entry["agency"],
                    file_name=entry["file_name"],
                    total_rows=stats["total_rows"],
                    success_rate=float(stats["success_rate"].rstrip("%")),
                    failure_rate=float(stats["failure_rate"].rstrip("%")),
                    success_count=stats["success_count"],
                    failure_count=stats["failure_count"],
                    signed_count=stats["signed_count"],
                    unsigned_count=stats["unsigned_count"],
                    unique_failure_reasons=json_dumps(entry.get("unique_failure_reasons", [])),
                    failure_reason_counts=json_dumps(entry.get("failure_reason_counts", {})),
                )
            )

    def save_batch(self, timestamp: str, folder_id: str, result: Dict[str, object]) -> None:
        with get_connection() as conn:
            conn.execute(
                audit_batches.insert().values(
                    timestamp=timestamp,
                    folder_id=folder_id,
                    full_result=json_dumps(result),
                )
            )

    def fetch_recent_batches(self, limit: int = 5) -> List[Dict[str, object]]:
        stmt = (
            select(audit_batches)
            .order_by(audit_batches.c.id.desc())
            .limit(limit)
        )
        with get_connection() as conn:
            rows = conn.execute(stmt).fetchall()

        batches = []
        for row in rows:
            try:
                batches.append(json_loads(row.full_result))
            except Exception:
                continue
        return batches

    def fetch_recent(self, limit: int = 25) -> List[Dict[str, object]]:
        stmt = (
            select(audit_runs)
            .order_by(audit_runs.c.id.desc())
            .limit(limit)
        )
        with get_connection() as conn:
            rows = conn.execute(stmt).fetchall()

        history = []
        for row in rows:
            # Infer EHR from agency or filename if possible, since we don't have an EHR column yet
            ehr = "Unknown"
            if "axxess" in row.file_name.lower():
                ehr = "Axxess"
            elif "kinnser" in row.file_name.lower():
                ehr = "Kinnser"
            
            # Parse failure reasons to create a meaningful remark
            reasons = json_loads(row.unique_failure_reasons or "[]")
            remarks = "No issues found"
            if reasons:
                remarks = f"{len(reasons)} issues found: {', '.join(reasons[:2])}"
                if len(reasons) > 2:
                    remarks += "..."

            history.append(
                {
                    "timestamp": row.timestamp,
                    "folder_id": row.folder_id,
                    "agency": row.agency,
                    "ehr": ehr,
                    "file_name": row.file_name,
                    "stats": {
                        "total_rows": row.total_rows,
                        "success_rate": f"{row.success_rate:.1f}%" if row.success_rate is not None else "0.0%",
                        "failure_rate": f"{row.failure_rate:.1f}%" if row.failure_rate is not None else "0.0%",
                        "success_count": row.success_count,
                        "failure_count": row.failure_count,
                        "signed_count": row.signed_count,
                        "unsigned_count": row.unsigned_count,
                    },
                    "unique_failure_reasons": reasons,
                    "failure_reason_counts": json_loads(row.failure_reason_counts or "{}"),
                    "error_message": remarks, # Map remarks to error_message for frontend
                }
            )
        return history


def json_dumps(value: object) -> str:
    import json
    import datetime
    
    class CustomEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, (datetime.date, datetime.datetime)):
                return obj.isoformat()
            if isinstance(obj, set):
                return list(obj)
            # Handle numpy types if numpy is installed
            try:
                import numpy as np
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                if isinstance(obj, np.bool_):
                    return bool(obj)
            except ImportError:
                pass
            return super().default(obj)

    return json.dumps(value, cls=CustomEncoder)


def json_loads(payload: str) -> object:
    import json

    return json.loads(payload)
