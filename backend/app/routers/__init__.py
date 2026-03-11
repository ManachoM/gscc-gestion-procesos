from fastapi import APIRouter

router = APIRouter()

# Register sub-routers here as they are created:
#
#   from app.routers.jobs import router as jobs_router
#   router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
#
#   from app.routers.workers import router as workers_router
#   router.include_router(workers_router, prefix="/workers", tags=["workers"])
