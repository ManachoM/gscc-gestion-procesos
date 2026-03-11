"""
Workflow management routes.

GET  /workflows           list all workflows (admin: all statuses; operator: published only)
GET  /workflows/{slug}    detail + param schema
PATCH /workflows/{slug}   change lifecycle status (admin only)
GET  /workflows/{slug}/executions  execution history for a workflow
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Execution, Role, User, Workflow, WorkflowStatus
from app.schemas import ExecutionOut, WorkflowOut, WorkflowStatusUpdate
from app.workflows.registry import get_registry, get_workflow_def

router = APIRouter()

_admin = require_role(Role.admin)
_staff = require_role(Role.admin, Role.operator)


def _build_workflow_out(wf: Workflow) -> WorkflowOut:
    defn = get_workflow_def(wf.slug)
    return WorkflowOut(
        id=wf.id,
        slug=wf.slug,
        name=wf.name,
        description=wf.description,
        status=wf.status,
        param_schema=defn.param_schema if defn else {},
        is_registered=defn is not None,
        created_at=wf.created_at,
        updated_at=wf.updated_at,
    )


async def _get_workflow_or_404(slug: str, db: AsyncSession) -> Workflow:
    result = await db.execute(select(Workflow).where(Workflow.slug == slug))
    wf = result.scalar_one_or_none()
    if wf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return wf


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[WorkflowOut])
async def list_workflows(
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowOut]:
    """
    Admins see all workflows regardless of status.
    Operators see only published workflows.
    """
    stmt = select(Workflow).order_by(Workflow.name)
    if current_user.role == Role.operator:
        stmt = stmt.where(Workflow.status == WorkflowStatus.published)
    result = await db.execute(stmt)
    return [_build_workflow_out(wf) for wf in result.scalars().all()]


@router.get("/{slug}", response_model=WorkflowOut)
async def get_workflow(
    slug: str,
    current_user: User = _staff,
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    wf = await _get_workflow_or_404(slug, db)
    if current_user.role == Role.operator and wf.status != WorkflowStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return _build_workflow_out(wf)


@router.patch("/{slug}", response_model=WorkflowOut)
async def update_workflow_status(
    slug: str,
    body: WorkflowStatusUpdate,
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    """Admin-only: move a workflow through draft → published → archived."""
    wf = await _get_workflow_or_404(slug, db)
    wf.status = body.status
    await db.commit()
    await db.refresh(wf)
    return _build_workflow_out(wf)


@router.get("/{slug}/executions", response_model=list[ExecutionOut])
async def list_workflow_executions(
    slug: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> list[ExecutionOut]:
    """Admin-only: execution history for a specific workflow."""
    wf = await _get_workflow_or_404(slug, db)
    result = await db.execute(
        select(Execution)
        .where(Execution.workflow_id == wf.id)
        .order_by(Execution.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    executions = result.scalars().all()
    return [
        ExecutionOut(
            **{
                **{c: getattr(e, c) for c in [
                    "id", "workflow_id", "schedule_id", "triggered_by",
                    "params", "param_fingerprint", "celery_task_id", "status",
                    "started_at", "finished_at", "error_message", "created_at",
                ]},
                "workflow_slug": slug,
            }
        )
        for e in executions
    ]
