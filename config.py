from functools import lru_cache
from typing import List, Optional

from pydantic import AliasChoices, Field, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
	"""Application configuration loaded from environment variables / .env."""

	# Google Drive
	google_credentials_path: str = Field(
		"credentials.json",
		description="Absolute path to the Google service-account credentials file.",
	)
	drive_scopes: List[str] = Field(
		default_factory=lambda: [
			"https://www.googleapis.com/auth/drive.readonly",
		],
		description="Scopes granted to the service account for Drive access.",
	)

	# Business logic
	pending_overdue_threshold_days: int = Field(5, ge=0)
	alert_failure_threshold: float = Field(50.0, ge=0, le=100)

	# Storage / persistence
	database_url: str = Field(
		"sqlite:///./audit_history.db",
		description="SQLAlchemy database URL (sqlite:///./audit_history.db, postgres://, etc.)",
	)
	firebase_credentials_path: str = Field(
		"firebase-service-account.json",
		description="Absolute path to the Firebase service-account JSON file.",
		validation_alias=AliasChoices("FIREBASE_CREDENTIALS", "FIREBASE_CREDENTIALS_PATH"),
	)
	firebase_project_id: Optional[str] = Field(
		None,
		description="Firebase/Google Cloud project ID.",
		validation_alias=AliasChoices("FIREBASE_PROJECT_ID", "FIREBASE_PROJECT"),
	)

	# Notifications
	alert_webhook_url: Optional[str] = None
	summary_webhook_url: Optional[str] = None

	audit_email_host: Optional[str] = None
	audit_email_port: int = Field(587, gt=0)
	audit_email_user: Optional[str] = None
	audit_email_password: Optional[str] = None
	audit_email_sender: Optional[str] = None
	audit_email_recipients: Optional[str] = None
	audit_email_use_tls: bool = True

	# Runtime / security
	app_version: str = "2.0.0"
	log_level: str = "INFO"
	batch_folder_ids: List[str] = Field(
		default_factory=list,
		description="Default Drive folder IDs processed by the scheduler.",
	)
	default_audit_folder_id: Optional[str] = Field(
		None,
		description="Default Google Drive folder ID for /audit-agency-data endpoint.",
	)

	class Config:
		env_file = ".env"
		env_file_encoding = "utf-8"

	@staticmethod
	def _split_csv(value: Optional[str]) -> List[str]:
		if value is None:
			return []
		if isinstance(value, list):
			return value
		return [item.strip() for item in str(value).split(",") if item.strip()]

	@validator("batch_folder_ids", pre=True)
	def _validate_csv_fields(cls, value):  # type: ignore[no-untyped-def]
		return cls._split_csv(value)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
	return Settings()

