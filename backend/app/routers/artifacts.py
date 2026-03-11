"""
Public artifact routes — no authentication required.

GET /artifacts              search and browse public artifacts
GET /artifacts/{id}         artifact metadata
GET /artifacts/{id}/download stream artifact file
"""
from __future__ import annotations

import mimetypes
import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Artifact, Workflow
from app.schemas import ArtifactOut
from app.storage import get_storage

router = APIRouter()

CHUNK_SIZE = 64 * 1024  # 64 KB streaming chunks

_LIKE_ESCAPE = "\\"
_LIKE_META = re.compile(r"([%_\\])")


def _escape_like(s: str) -> str:
    """Escape LIKE metacharacters so user input is treated as a literal string."""
    return _LIKE_META.sub(r"\\\1", s)


def _artifact_to_out(artifact: Artifact, workflow_slug: str) -> ArtifactOut:
    return ArtifactOut(
        id=artifact.id,
        execution_id=artifact.execution_id,
        workflow_id=artifact.workflow_id,
        workflow_slug=workflow_slug,
        filename=artifact.filename,
        file_size=artifact.file_size,
        mime_type=artifact.mime_type,
        is_public=artifact.is_public,
        geo_country=artifact.geo_country,
        geo_region=artifact.geo_region,
        geo_city=artifact.geo_city,
        geo_label=artifact.geo_label,
        data_date=artifact.data_date,
        tags=artifact.tags or [],
        description=artifact.description,
        created_at=artifact.created_at,
    )


async def _get_public_artifact_or_404(
    artifact_id: int, db: AsyncSession
) -> tuple[Artifact, str]:
    result = await db.execute(
        select(Artifact, Workflow.slug)
        .join(Workflow, Artifact.workflow_id == Workflow.id)
        .where(Artifact.id == artifact_id, Artifact.is_public.is_(True))
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found",
        )
    return row


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ArtifactOut])
async def search_artifacts(
    workflow_slug: str | None = Query(None, description="Filter by workflow slug"),
    country: str | None = Query(None, description="Filter by geo_country (exact)"),
    region: str | None = Query(None, description="Filter by geo_region (exact)"),
    date_from: date | None = Query(None, description="data_date >= date_from"),
    date_to: date | None = Query(None, description="data_date <= date_to"),
    tags: list[str] | None = Query(None, description="Artifact must have at least one of these tags"),
    q: str | None = Query(None, description="Full-text search on filename, description, geo_label"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[ArtifactOut]:
    """
    Public endpoint — no authentication required.
    Returns only is_public=True artifacts.
    """
    stmt = (
        select(Artifact, Workflow.slug)
        .join(Workflow, Artifact.workflow_id == Workflow.id)
        .where(Artifact.is_public.is_(True))
        .order_by(Artifact.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    if workflow_slug:
        stmt = stmt.where(Workflow.slug == workflow_slug)
    if country:
        stmt = stmt.where(Artifact.geo_country == country)
    if region:
        stmt = stmt.where(Artifact.geo_region == region)
    if date_from:
        stmt = stmt.where(Artifact.data_date >= date_from)
    if date_to:
        stmt = stmt.where(Artifact.data_date <= date_to)
    if tags:
        # Artifact must contain at least one of the requested tags (PostgreSQL && operator)
        stmt = stmt.where(Artifact.tags.overlap(tags))
    if q:
        pattern = f"%{_escape_like(q)}%"
        stmt = stmt.where(
            or_(
                Artifact.filename.ilike(pattern, escape=_LIKE_ESCAPE),
                Artifact.description.ilike(pattern, escape=_LIKE_ESCAPE),
                Artifact.geo_label.ilike(pattern, escape=_LIKE_ESCAPE),
            )
        )

    result = await db.execute(stmt)
    return [_artifact_to_out(a, slug) for a, slug in result.all()]


@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
) -> ArtifactOut:
    """Public endpoint — returns metadata for a single published artifact."""
    artifact, workflow_slug = await _get_public_artifact_or_404(artifact_id, db)
    return _artifact_to_out(artifact, workflow_slug)


@router.get("/{artifact_id}/download")
async def download_artifact(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Public endpoint — streams the artifact file.
    The file is read through the storage abstraction so the path implementation
    can be swapped (e.g. S3) without changing this endpoint.
    """
    artifact, _ = await _get_public_artifact_or_404(artifact_id, db)

    storage = get_storage()
    if not storage.exists(artifact.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on storage",
        )

    mime = artifact.mime_type
    if not mime:
        guessed, _ = mimetypes.guess_type(artifact.filename)
        mime = guessed or "application/octet-stream"

    def _iter_file():
        with storage.open_stream(artifact.file_path) as f:
            while chunk := f.read(CHUNK_SIZE):
                yield chunk

    # Sanitize filename for the Content-Disposition header: strip characters
    # that would break the quoted-string syntax (RFC 6266).
    safe_filename = re.sub(r'["\\\r\n\t]', "_", artifact.filename)

    return StreamingResponse(
        _iter_file(),
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            **({"Content-Length": str(artifact.file_size)} if artifact.file_size else {}),
        },
    )
