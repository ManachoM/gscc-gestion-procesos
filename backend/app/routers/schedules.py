"""
Schedule management routes.

POST   /schedules          create a one-off or recurring schedule
GET    /schedules          list schedules (operator: own; admin: all)
GET    /schedules/{id}     detail
PATCH  /schedules/{id}     update name / is_active
DELETE /schedules/{id}     deactivate (soft delete)
"""
from datetime import datetime, timezone

from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import (
    Execution,
    ExecutionStatus,
    Role,
    Schedule,
    ScheduleType,
    User,
    Workflow,
    WorkflowStatus,
)
from app.schemas import ScheduleCreate, ScheduleOut, ScheduleUpdate
from app.tasks.workflow_runner import run_workflow
from app.workflows.registry import compute_fingerprint

router = APIRouter()

_staff = require_role(Role.admin, Role.operator)


def _schedule_to_out(schedule: Schedule, workflow_slug: str) -> ScheduleOut:
    return ScheduleOut(
        id=schedule.id,
        workflow_id=schedule.workflow_id,
        workflow_slug=workflow_slug,
        created_by=schedule.created_by,
        name=schedule.name,
        params=schedule.params,
        param_fingerprint=schedule.param_fingerprint,
        schedule_type=schedule.schedule_type,
        cron_expr=schedule.cron_expr,
        run_at=schedule.run_at,
        is_active=schedule.is_active,
        next_run_at=schedule.next_run_at,
        last_run_at=schedule.last_run_at,
        created_at=schedule.created_at,
    )


async def _get_schedule_or_404(
    schedule_id: int,
    db: AsyncSession,
    current_user: User,
) -> tuple[Schedule, str]:
    result = await db.execute(
        select(Schedule, Workflow.slug)
        .join(Workflow, Schedule.workflow_id == Workflow.id)
        .where(Schedule.id == schedule_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    schedule, workflow_slug = row
    if current_user.role == Role.operator and schedule.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    return schedule, workflow_slug


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    body: ScheduleCreate,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> ScheduleOut:
    """
    Create a one-off or recurring schedule for a published workflow.

    - once: body.run_at is required; an Execution is created immediately
      with Celery eta so it fires at the specified time.
    - recurring: body.cron_expr is required; executions are dispatched by
      the beat task each time next_run_at passes.
    """
    # Resolve workflow
    wf_result = await db.execute(
        select(Workflow).where(Workflow.slug == body.workflow_slug)
    )
    workflow = wf_result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{body.workflow_slug}' not found",
        )
    if workflow.status != WorkflowStatus.published:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workflow '{body.workflow_slug}' is not published",
        )

    # Validate schedule-type-specific fields
    if body.schedule_type == ScheduleType.once:
        if body.run_at is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="run_at is required for once schedules",
            )
        if body.run_at <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="run_at must be in the future",
            )

    elif body.schedule_type == ScheduleType.recurring:
        if not body.cron_expr:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="cron_expr is required for recurring schedules",
            )
        if not croniter.is_valid(body.cron_expr):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid cron expression: {body.cron_expr!r}",
            )

    fingerprint = compute_fingerprint(body.params)
    now = datetime.now(timezone.utc)

    # Compute next_run_at
    if body.schedule_type == ScheduleType.once:
        next_run_at = body.run_at
    else:
        cron = croniter(body.cron_expr, now)
        next_run_at = cron.get_next(datetime)

    schedule = Schedule(
        workflow_id=workflow.id,
        created_by=current_user.id,
        name=body.name,
        params=body.params,
        param_fingerprint=fingerprint,
        schedule_type=body.schedule_type,
        cron_expr=body.cron_expr,
        run_at=body.run_at,
        is_active=True,
        next_run_at=next_run_at,
    )
    db.add(schedule)
    await db.flush()  # get schedule.id

    # For one-off schedules: create a pending execution and dispatch with eta
    if body.schedule_type == ScheduleType.once:
        execution = Execution(
            workflow_id=workflow.id,
            schedule_id=schedule.id,
            triggered_by=current_user.id,
            params=body.params,
            param_fingerprint=fingerprint,
            status=ExecutionStatus.pending,
        )
        db.add(execution)
        await db.flush()

        task = run_workflow.apply_async(args=[execution.id], eta=body.run_at)
        execution.celery_task_id = task.id

    await db.commit()
    await db.refresh(schedule)
    return _schedule_to_out(schedule, body.workflow_slug)


@router.get("", response_model=list[ScheduleOut])
async def list_schedules(
    workflow_slug: str | None = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> list[ScheduleOut]:
    stmt = (
        select(Schedule, Workflow.slug)
        .join(Workflow, Schedule.workflow_id == Workflow.id)
        .order_by(Schedule.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    if current_user.role == Role.operator:
        stmt = stmt.where(Schedule.created_by == current_user.id)
    if workflow_slug:
        stmt = stmt.where(Workflow.slug == workflow_slug)
    if active_only:
        stmt = stmt.where(Schedule.is_active.is_(True))

    result = await db.execute(stmt)
    return [_schedule_to_out(s, slug) for s, slug in result.all()]


@router.get("/{schedule_id}", response_model=ScheduleOut)
async def get_schedule(
    schedule_id: int,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> ScheduleOut:
    schedule, workflow_slug = await _get_schedule_or_404(schedule_id, db, current_user)
    return _schedule_to_out(schedule, workflow_slug)


@router.patch("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: int,
    body: ScheduleUpdate,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> ScheduleOut:
    schedule, workflow_slug = await _get_schedule_or_404(schedule_id, db, current_user)

    if body.name is not None:
        schedule.name = body.name
    if body.is_active is not None:
        schedule.is_active = body.is_active

    await db.commit()
    await db.refresh(schedule)
    return _schedule_to_out(schedule, workflow_slug)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deactivate a schedule. Does not delete historical execution records."""
    schedule, _ = await _get_schedule_or_404(schedule_id, db, current_user)
    schedule.is_active = False
    await db.commit()
