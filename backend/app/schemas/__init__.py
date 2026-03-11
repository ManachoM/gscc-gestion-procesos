from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

from app.models import (
    ExecutionStatus,
    LogLevel,
    Role,
    ScheduleType,
    WorkflowStatus,
)


# ── Auth / User (existing) ────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    sub: str  # user email
    role: Role


class UserOut(BaseModel):
    id: int
    email: str
    role: Role
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: str
    password: str
    role: Role = Role.viewer
    is_active: bool = True


class UserUpdate(BaseModel):
    email: str | None = None
    role: Role | None = None
    is_active: bool | None = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


# ── Workflows ─────────────────────────────────────────────────────────────────

class WorkflowOut(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None
    status: WorkflowStatus
    # param_schema comes from the code registry, not the DB row
    param_schema: dict[str, Any]
    # True if the slug is currently registered in code (False means orphaned DB row)
    is_registered: bool
    created_at: datetime
    updated_at: datetime


class WorkflowStatusUpdate(BaseModel):
    status: WorkflowStatus


# ── Schedules ─────────────────────────────────────────────────────────────────

class ScheduleCreate(BaseModel):
    workflow_slug: str
    name: str | None = None
    params: dict[str, Any] = {}
    schedule_type: ScheduleType
    # Required for recurring schedules (standard 5-field cron: "0 8 * * 1")
    cron_expr: str | None = None
    # Required for one-off schedules
    run_at: datetime | None = None


class ScheduleOut(BaseModel):
    id: int
    workflow_id: int
    workflow_slug: str
    created_by: int
    name: str | None
    params: dict[str, Any]
    param_fingerprint: str
    schedule_type: ScheduleType
    cron_expr: str | None
    run_at: datetime | None
    is_active: bool
    next_run_at: datetime | None
    last_run_at: datetime | None
    created_at: datetime


class ScheduleUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


# ── Executions ────────────────────────────────────────────────────────────────

class ExecutionCreate(BaseModel):
    workflow_slug: str
    params: dict[str, Any] = {}


class ExecutionOut(BaseModel):
    id: int
    workflow_id: int
    workflow_slug: str
    schedule_id: int | None
    triggered_by: int
    params: dict[str, Any]
    param_fingerprint: str
    celery_task_id: str | None
    status: ExecutionStatus
    started_at: datetime | None
    finished_at: datetime | None
    # Visible to the operator who triggered the run and to admins
    error_message: str | None
    created_at: datetime


class ExecutionDetailOut(ExecutionOut):
    # error_traceback is included only for admins (router strips it for operators)
    error_traceback: str | None


# ── Logs ──────────────────────────────────────────────────────────────────────

class LogOut(BaseModel):
    id: int
    level: LogLevel
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Artifacts ─────────────────────────────────────────────────────────────────

class ArtifactOut(BaseModel):
    id: int
    execution_id: int
    workflow_id: int
    workflow_slug: str
    filename: str
    file_size: int | None
    mime_type: str | None
    # is_public is included so authenticated callers (e.g. ExecutionDetail) can
    # distinguish artifacts that are still private (workflow still running) from
    # those that have been published (workflow succeeded).
    is_public: bool
    geo_country: str | None
    geo_region: str | None
    geo_city: str | None
    geo_label: str | None
    data_date: date | None
    tags: list[str]
    description: str | None
    created_at: datetime
