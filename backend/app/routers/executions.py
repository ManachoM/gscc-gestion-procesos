"""
Execution management routes.

POST /executions                 trigger an ad-hoc run
GET  /executions                 list runs (operator: own; admin: all)
GET  /executions/{id}            execution detail
GET  /executions/{id}/logs       structured log entries (operator/admin)
GET  /executions/{id}/artifacts  artifacts produced by this run
POST /executions/{id}/cancel     cancel a pending run
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery_app
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import (
    Artifact,
    Execution,
    ExecutionLog,
    ExecutionStatus,
    Role,
    User,
    Workflow,
    WorkflowStatus,
)
from app.schemas import ArtifactOut, ExecutionCreate, ExecutionDetailOut, ExecutionOut, LogOut
from app.tasks.workflow_runner import run_workflow
from app.workflows.registry import compute_fingerprint

router = APIRouter()

_staff = require_role(Role.admin, Role.operator)


def _execution_to_out(execution: Execution, workflow_slug: str) -> ExecutionOut:
    return ExecutionOut(
        id=execution.id,
        workflow_id=execution.workflow_id,
        workflow_slug=workflow_slug,
        schedule_id=execution.schedule_id,
        triggered_by=execution.triggered_by,
        params=execution.params,
        param_fingerprint=execution.param_fingerprint,
        celery_task_id=execution.celery_task_id,
        status=execution.status,
        started_at=execution.started_at,
        finished_at=execution.finished_at,
        error_message=execution.error_message,
        created_at=execution.created_at,
    )


def _execution_to_detail(
    execution: Execution, workflow_slug: str, include_traceback: bool
) -> ExecutionDetailOut:
    return ExecutionDetailOut(
        id=execution.id,
        workflow_id=execution.workflow_id,
        workflow_slug=workflow_slug,
        schedule_id=execution.schedule_id,
        triggered_by=execution.triggered_by,
        params=execution.params,
        param_fingerprint=execution.param_fingerprint,
        celery_task_id=execution.celery_task_id,
        status=execution.status,
        started_at=execution.started_at,
        finished_at=execution.finished_at,
        error_message=execution.error_message,
        error_traceback=execution.error_traceback if include_traceback else None,
        created_at=execution.created_at,
    )


async def _get_execution_or_404(
    execution_id: int,
    db: AsyncSession,
    current_user: User,
) -> tuple[Execution, str]:
    """
    Return (execution, workflow_slug).
    Operators can only access their own executions.
    """
    result = await db.execute(
        select(Execution, Workflow.slug)
        .join(Workflow, Execution.workflow_id == Workflow.id)
        .where(Execution.id == execution_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")

    execution, workflow_slug = row
    if current_user.role == Role.operator and execution.triggered_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")

    return execution, workflow_slug


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ExecutionOut, status_code=status.HTTP_201_CREATED)
async def create_execution(
    body: ExecutionCreate,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> ExecutionOut:
    """
    Trigger an ad-hoc run of a published workflow.
    Returns 409 if a run with the same workflow + parameter fingerprint is
    already pending or running.
    """
    # Resolve workflow
    result = await db.execute(
        select(Workflow).where(Workflow.slug == body.workflow_slug)
    )
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{body.workflow_slug}' not found",
        )
    if workflow.status != WorkflowStatus.published:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workflow '{body.workflow_slug}' is not published (status: {workflow.status})",
        )

    fingerprint = compute_fingerprint(body.params)

    # Concurrency guard: reject if an active run with the same fingerprint exists
    overlap_result = await db.execute(
        select(Execution).where(
            Execution.workflow_id == workflow.id,
            Execution.param_fingerprint == fingerprint,
            Execution.status.in_([ExecutionStatus.pending, ExecutionStatus.running]),
        )
    )
    if overlap_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An execution with the same parameters is already pending or running",
        )

    execution = Execution(
        workflow_id=workflow.id,
        schedule_id=None,
        triggered_by=current_user.id,
        params=body.params,
        param_fingerprint=fingerprint,
        status=ExecutionStatus.pending,
    )
    db.add(execution)
    await db.flush()  # get execution.id before dispatching

    task = run_workflow.apply_async(args=[execution.id])
    execution.celery_task_id = task.id

    await db.commit()
    await db.refresh(execution)

    return _execution_to_out(execution, workflow.slug)


@router.get("", response_model=list[ExecutionOut])
async def list_executions(
    workflow_slug: str | None = Query(None),
    exec_status: ExecutionStatus | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> list[ExecutionOut]:
    """
    List executions with optional filters.
    Operators see only their own runs; admins see all.
    """
    stmt = (
        select(Execution, Workflow.slug)
        .join(Workflow, Execution.workflow_id == Workflow.id)
        .order_by(Execution.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    if current_user.role == Role.operator:
        stmt = stmt.where(Execution.triggered_by == current_user.id)
    if workflow_slug:
        stmt = stmt.where(Workflow.slug == workflow_slug)
    if exec_status:
        stmt = stmt.where(Execution.status == exec_status)

    result = await db.execute(stmt)
    return [_execution_to_out(e, slug) for e, slug in result.all()]


@router.get("/{execution_id}", response_model=ExecutionDetailOut)
async def get_execution(
    execution_id: int,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> ExecutionDetailOut:
    execution, workflow_slug = await _get_execution_or_404(execution_id, db, current_user)
    include_traceback = current_user.role == Role.admin
    return _execution_to_detail(execution, workflow_slug, include_traceback)


@router.get("/{execution_id}/logs", response_model=list[LogOut])
async def get_execution_logs(
    execution_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> list[LogOut]:
    await _get_execution_or_404(execution_id, db, current_user)  # access check

    result = await db.execute(
        select(ExecutionLog)
        .where(ExecutionLog.execution_id == execution_id)
        .order_by(ExecutionLog.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{execution_id}/artifacts", response_model=list[ArtifactOut])
async def get_execution_artifacts(
    execution_id: int,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> list[ArtifactOut]:
    execution, workflow_slug = await _get_execution_or_404(execution_id, db, current_user)

    result = await db.execute(
        select(Artifact)
        .where(Artifact.execution_id == execution_id)
        .order_by(Artifact.created_at.asc())
    )
    return [
        ArtifactOut(
            id=a.id,
            execution_id=a.execution_id,
            workflow_id=a.workflow_id,
            workflow_slug=workflow_slug,
            filename=a.filename,
            file_size=a.file_size,
            mime_type=a.mime_type,
            is_public=a.is_public,
            geo_country=a.geo_country,
            geo_region=a.geo_region,
            geo_city=a.geo_city,
            geo_label=a.geo_label,
            data_date=a.data_date,
            tags=a.tags or [],
            description=a.description,
            created_at=a.created_at,
        )
        for a in result.scalars().all()
    ]


@router.post("/{execution_id}/cancel", response_model=ExecutionOut)
async def cancel_execution(
    execution_id: int,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> ExecutionOut:
    """Cancel a pending execution. Running executions will be attempted to terminate."""
    execution, workflow_slug = await _get_execution_or_404(execution_id, db, current_user)

    if execution.status not in (ExecutionStatus.pending, ExecutionStatus.running):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Execution is already in terminal state: {execution.status}",
        )

    # Revoke the Celery task (terminate=True sends SIGTERM to the worker process)
    if execution.celery_task_id:
        celery_app.control.revoke(execution.celery_task_id, terminate=True, signal="SIGTERM")

    execution.status = ExecutionStatus.cancelled
    execution.finished_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(execution)

    return _execution_to_out(execution, workflow_slug)
