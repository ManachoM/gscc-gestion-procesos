"""
WorkflowContext — the interface handed to every workflow function at runtime.

Workflow code receives a context object instead of raw DB/storage handles so
that the execution lifecycle, logging, and artifact management details stay
outside the workflow implementation.
"""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from app.storage import LocalStorageBackend


class WorkflowContext:
    def __init__(
        self,
        execution_id: int,
        workflow_slug: str,
        params: dict,
        db: "Session",
        storage: "LocalStorageBackend",
    ) -> None:
        self.execution_id = execution_id
        self.workflow_slug = workflow_slug
        self.params = params
        self._db = db
        self._storage = storage
        # Tracks every path written to storage so the task runner can clean
        # them up if the workflow fails (DB rollback removes the rows but not
        # the files on disk).
        self._written_paths: list[str] = []

    # ── Logging ───────────────────────────────────────────────────────────────

    def log(self, message: str, level: str = "INFO") -> None:
        """Write a structured log entry for this execution (internal only)."""
        from app.models import ExecutionLog, LogLevel

        entry = ExecutionLog(
            execution_id=self.execution_id,
            level=LogLevel(level.upper()),
            message=message,
        )
        self._db.add(entry)
        self._db.flush()

    def info(self, message: str) -> None:
        self.log(message, "INFO")

    def warning(self, message: str) -> None:
        self.log(message, "WARNING")

    def error(self, message: str) -> None:
        self.log(message, "ERROR")

    # ── Artifact management ───────────────────────────────────────────────────

    def save_artifact(
        self,
        filename: str,
        data: bytes,
        *,
        mime_type: str | None = None,
        geo_country: str | None = None,
        geo_region: str | None = None,
        geo_city: str | None = None,
        geo_label: str | None = None,
        data_date: date | None = None,
        tags: list[str] | None = None,
        description: str | None = None,
    ) -> int:
        """
        Persist bytes to the storage backend and register the artifact in DB.
        The artifact starts with is_public=False; the task runner sets it to
        True after the whole workflow function completes successfully.

        Returns the new artifact's DB id.
        """
        from app.models import Artifact, Execution

        execution = self._db.get(Execution, self.execution_id)
        if execution is None:
            raise RuntimeError(f"Execution {self.execution_id} not found in DB")

        relative_path = f"{self.workflow_slug}/{self.execution_id}/{filename}"
        bytes_written = self._storage.save(relative_path, data)
        self._written_paths.append(relative_path)

        artifact = Artifact(
            execution_id=self.execution_id,
            workflow_id=execution.workflow_id,
            filename=filename,
            file_path=relative_path,
            file_size=bytes_written,
            mime_type=mime_type,
            is_public=False,
            geo_country=geo_country,
            geo_region=geo_region,
            geo_city=geo_city,
            geo_label=geo_label,
            data_date=data_date,
            tags=tags or [],
            description=description,
        )
        self._db.add(artifact)
        self._db.flush()
        return artifact.id
