"""
Celery tasks for workflow execution and schedule dispatching.

run_workflow      — generic task that executes any registered workflow.
dispatch_due_schedules — beat task that fires recurring schedules on time.

Design notes:
- These tasks use a *synchronous* SQLAlchemy session because Celery tasks run
  in a thread/process, not an asyncio event loop.
- Postgres (not the Celery result backend) is the source of truth for status.
- All exceptions are caught, written to executions.error_traceback, and then
  re-raised so Celery also marks the task as FAILED (visible in Flower).
"""
from __future__ import annotations

import traceback as tb
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

# Import workflows package to populate the registry before any task runs.
import app.workflows  # noqa: F401 — side-effect: registers all workflow functions

from app.celery_app import celery_app
from app.config import settings

# Module-level synchronous engine — created once per worker process.
_engine = create_engine(
    settings.database_sync_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=2,
)
_SessionFactory = sessionmaker(bind=_engine, expire_on_commit=False)


@contextmanager
def _db_session() -> Generator[Session, None, None]:
    session = _SessionFactory()
    try:
        yield session
    finally:
        session.close()


# ── Main workflow executor ────────────────────────────────────────────────────

@celery_app.task(name="workflows.run", bind=True, max_retries=0)
def run_workflow(self, execution_id: int) -> None:
    """
    Execute a workflow identified by execution_id.

    The execution record must already exist in DB (created by the API or by
    dispatch_due_schedules). This task:
      1. Marks the execution as running.
      2. Builds WorkflowContext and calls the registered workflow function.
      3. On success: marks success, publishes all artifacts.
      4. On failure: marks failed, stores error_message + traceback.
    """
    from app.models import (
        Artifact,
        Execution,
        ExecutionStatus,
        Schedule,
        ScheduleType,
        Workflow,
    )
    from app.storage import get_storage
    from app.workflows.context import WorkflowContext
    from app.workflows.registry import get_workflow_def

    with _db_session() as db:
        execution = db.get(Execution, execution_id)
        if execution is None:
            # Execution was deleted before the task ran; nothing to do.
            return

        # Guard against double-execution (e.g. after a broker hiccup)
        if execution.status not in (ExecutionStatus.pending,):
            return

        workflow_row = db.get(Workflow, execution.workflow_id)
        if workflow_row is None:
            execution.status = ExecutionStatus.failed
            execution.error_message = f"Workflow id={execution.workflow_id} not found in DB"
            execution.finished_at = datetime.now(timezone.utc)
            db.commit()
            return

        workflow_def = get_workflow_def(workflow_row.slug)
        if workflow_def is None:
            execution.status = ExecutionStatus.failed
            execution.error_message = (
                f"Workflow '{workflow_row.slug}' is not registered in code. "
                "Redeploy the backend with the workflow module included."
            )
            execution.finished_at = datetime.now(timezone.utc)
            db.commit()
            return

        # ── Mark running ──────────────────────────────────────────────────────
        execution.status = ExecutionStatus.running
        execution.started_at = datetime.now(timezone.utc)
        execution.celery_task_id = self.request.id
        db.commit()

        ctx = WorkflowContext(
            execution_id=execution_id,
            workflow_slug=workflow_row.slug,
            params=execution.params,
            db=db,
            storage=get_storage(),
        )

        try:
            workflow_def.fn(ctx)
            db.flush()

            # ── Success: publish artifacts ────────────────────────────────────
            execution.status = ExecutionStatus.success
            execution.finished_at = datetime.now(timezone.utc)

            artifacts = (
                db.execute(
                    select(Artifact).where(Artifact.execution_id == execution_id)
                ).scalars().all()
            )
            for artifact in artifacts:
                artifact.is_public = True

            db.commit()

        except Exception as exc:
            db.rollback()

            # Clean up any files written to storage during this execution.
            # The DB rollback already removed the Artifact rows; without this,
            # the files on disk become unreferenced orphans.
            storage = get_storage()
            for path in ctx._written_paths:
                storage.delete(path)

            # Reload after rollback (session state was discarded)
            execution = db.get(Execution, execution_id)
            if execution is not None:
                execution.status = ExecutionStatus.failed
                execution.finished_at = datetime.now(timezone.utc)
                # Keep error_message brief and user-visible; full traceback is admin-only
                execution.error_message = type(exc).__name__ + ": " + str(exc)[:500]
                execution.error_traceback = tb.format_exc()
                db.commit()

            # Re-raise so Celery records this as a failed task in Flower/result backend
            raise

        finally:
            # If this was a one-off schedule, deactivate it now that the run fired
            if execution and execution.schedule_id:
                schedule = db.get(Schedule, execution.schedule_id)
                if schedule and schedule.schedule_type == ScheduleType.once:
                    schedule.is_active = False
                    schedule.last_run_at = datetime.now(timezone.utc)
                    db.commit()


# ── Recurring schedule dispatcher ─────────────────────────────────────────────

@celery_app.task(name="tasks.dispatch_due_schedules")
def dispatch_due_schedules() -> dict:
    """
    Beat task (runs every 60 seconds). Finds recurring schedules whose
    next_run_at has passed, creates an Execution for each, and dispatches
    run_workflow. Updates next_run_at to the following occurrence.

    Returns a summary dict (visible in Flower) with dispatched count.
    """
    from croniter import croniter

    from app.models import (
        Execution,
        ExecutionStatus,
        Schedule,
        ScheduleType,
        Workflow,
        WorkflowStatus,
    )

    now = datetime.now(timezone.utc)
    dispatched: list[int] = []

    with _db_session() as db:
        due = db.execute(
            select(Schedule).where(
                Schedule.schedule_type == ScheduleType.recurring,
                Schedule.is_active.is_(True),
                Schedule.next_run_at <= now,
            )
        ).scalars().all()

        for schedule in due:
            workflow_row = db.get(Workflow, schedule.workflow_id)
            if workflow_row is None or workflow_row.status != WorkflowStatus.published:
                # Skip if workflow was archived/removed since the schedule was created
                continue

            # Reuse the fingerprint already stored — avoids recomputing from params
            fingerprint = schedule.param_fingerprint

            # Overlap guard: skip if an active run already exists for this fingerprint
            overlapping = db.execute(
                select(Execution).where(
                    Execution.workflow_id == schedule.workflow_id,
                    Execution.param_fingerprint == fingerprint,
                    Execution.status.in_([ExecutionStatus.pending, ExecutionStatus.running]),
                )
            ).scalar_one_or_none()
            if overlapping:
                continue

            execution = Execution(
                workflow_id=schedule.workflow_id,
                schedule_id=schedule.id,
                triggered_by=schedule.created_by,
                params=schedule.params,
                param_fingerprint=fingerprint,
                status=ExecutionStatus.pending,
            )
            db.add(execution)
            db.flush()  # get execution.id before dispatching

            task = run_workflow.apply_async(args=[execution.id])
            execution.celery_task_id = task.id

            # Advance next_run_at relative to the *previous* scheduled time,
            # not wall-clock now. This prevents cumulative drift when the beat
            # task fires a few seconds late.
            schedule.last_run_at = now
            try:
                cron = croniter(schedule.cron_expr, schedule.next_run_at)
                schedule.next_run_at = cron.get_next(datetime)
            except Exception:
                # Invalid cron expression — deactivate to prevent infinite retries
                schedule.is_active = False

            db.commit()
            dispatched.append(execution.id)

    return {"dispatched_executions": dispatched, "count": len(dispatched)}
