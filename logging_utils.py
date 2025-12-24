import sys
from typing import Optional

from loguru import logger


def configure_logging(level: str = "INFO", serialize: bool = False) -> None:
    """Configure Loguru logging outputs."""

    logger.remove()
    logger.configure(extra={"audit_id": "-"})
    logger.add(
        sys.stdout,
        level=level.upper(),
        serialize=serialize,
        format=(
            "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {extra[audit_id]} | {message}"
            if not serialize
            else None
        ),
    )


def get_logger():
    return logger
