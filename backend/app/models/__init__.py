import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# ── Existing enums ────────────────────────────────────────────────────────────

class Role(str, enum.Enum):
    admin = "admin"
    operator = "operator"
    viewer = "viewer"


# ── New domain enums ──────────────────────────────────────────────────────────

class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class ScheduleType(str, enum.Enum):
    once = "once"
    recurring = "recurring"


class ExecutionStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"


class LogLevel(str, enum.Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Existing models ───────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(SAEnum(Role, name="role"), default=Role.viewer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ── New domain models ─────────────────────────────────────────────────────────

class Workflow(Base):
    """
    Represents a code-defined extraction workflow. The slug must match a registered
    workflow in app.workflows.registry. Admins control the lifecycle (draft →
    published → archived) through the API; code is never uploaded at runtime.
    """
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[WorkflowStatus] = mapped_column(
        SAEnum(WorkflowStatus, name="workflow_status"),
        default=WorkflowStatus.draft,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class Schedule(Base):
    """
    Recurring or one-off trigger configuration for a workflow. Operators create
    schedules; the beat task dispatches executions when next_run_at is reached.
    One-off schedules (type=once) use Celery's eta for the exact timestamp.
    """
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Stable fingerprint of params (sha256 hex) used for overlap detection
    param_fingerprint: Mapped[str] = mapped_column(String(64))

    schedule_type: Mapped[ScheduleType] = mapped_column(
        SAEnum(ScheduleType, name="schedule_type")
    )
    # Cron expression for recurring schedules (e.g. "0 8 * * 1")
    cron_expr: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Target timestamp for one-off schedules
    run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )


class Execution(Base):
    """
    A single run of a workflow. Created either by an ad-hoc API call or by the
    schedule dispatcher. Celery task ID is stored so the task can be revoked on
    cancellation, but Postgres (not the Celery result backend) is the source of
    truth for status and provenance.
    """
    __tablename__ = "executions"
    __table_args__ = (
        # Composite index to efficiently check for concurrent runs
        Index("ix_executions_workflow_fingerprint_status",
              "workflow_id", "param_fingerprint", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"), index=True)
    # NULL for ad-hoc runs
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("schedules.id"), nullable=True)
    triggered_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    param_fingerprint: Mapped[str] = mapped_column(String(64))

    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[ExecutionStatus] = mapped_column(
        SAEnum(ExecutionStatus, name="execution_status"),
        default=ExecutionStatus.pending,
        index=True,
    )

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # error_message is visible to the operator who triggered the run.
    # error_traceback is internal — only admins can see it.
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_traceback: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )


class Artifact(Base):
    """
    A file produced by a successful workflow execution. Metadata lives here;
    the actual bytes are stored on disk via the storage backend. is_public is
    automatically set to True by the task runner on execution success.
    """
    __tablename__ = "artifacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id"), index=True)
    # Denormalised for efficient public search without joining through executions
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"), index=True)

    filename: Mapped[str] = mapped_column(String(500))
    # Storage-relative path, e.g. "sample_extraction/42/output.csv"
    file_path: Mapped[str] = mapped_column(String(1000))
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Geographic metadata — structured fields first; PostGIS can be added later
    geo_country: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    geo_region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    geo_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    geo_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # The calendar date the artifact data represents (not the creation time)
    data_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    tags: Mapped[list[str]] = mapped_column(ARRAY(Text()), default=list, server_default="{}")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )


class ExecutionLog(Base):
    """
    Structured log entries produced by a running workflow via WorkflowContext.log().
    Internal only — public users never see these.
    """
    __tablename__ = "execution_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id"), index=True)
    level: Mapped[LogLevel] = mapped_column(
        SAEnum(LogLevel, name="log_level"), default=LogLevel.INFO
    )
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
