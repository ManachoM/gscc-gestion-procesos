from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.routers import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: import all workflow modules (populates the registry), then
    reconcile the registry with the workflows table in Postgres.

    New workflow slugs are inserted as 'draft'; existing rows get their
    name/description updated from code. Slugs that exist in DB but not in
    code are left as-is so admins can see and archive orphaned workflows.
    """
    # Import the workflows package — side-effect: all @workflow decorators run
    import app.workflows  # noqa: F401

    try:
        await _sync_workflows()
    except Exception as exc:  # tables may not exist before first migration
        import logging
        logging.getLogger(__name__).warning(
            "Workflow sync skipped (DB not ready or migration pending): %s", exc
        )
    yield
    # Nothing to clean up on shutdown


async def _sync_workflows() -> None:
    from app.models import Workflow, WorkflowStatus
    from app.workflows.registry import get_registry

    registry = get_registry()
    async with AsyncSessionLocal() as db:
        for slug, defn in registry.items():
            result = await db.execute(select(Workflow).where(Workflow.slug == slug))
            wf = result.scalar_one_or_none()
            if wf is None:
                wf = Workflow(
                    slug=slug,
                    name=defn.name,
                    description=defn.description,
                    status=WorkflowStatus.draft,
                )
                db.add(wf)
            else:
                # Keep name/description in sync with code; never overwrite status
                wf.name = defn.name
                wf.description = defn.description
        await db.commit()


app = FastAPI(
    title=settings.app_name,
    description="REST API for the worker process manager.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # In production, replace with your actual frontend domain
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Next.js dev server (if migrated)
        "http://localhost:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok", "service": "backend"}
