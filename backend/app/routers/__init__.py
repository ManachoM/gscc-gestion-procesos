from fastapi import APIRouter

from app.routers.auth import router as auth_router
from app.routers.protected import router as protected_router
from app.routers.users import router as users_router
from app.routers.workflows import router as workflows_router
from app.routers.executions import router as executions_router
from app.routers.schedules import router as schedules_router
from app.routers.artifacts import router as artifacts_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(protected_router, tags=["protected"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(workflows_router, prefix="/workflows", tags=["workflows"])
router.include_router(executions_router, prefix="/executions", tags=["executions"])
router.include_router(schedules_router, prefix="/schedules", tags=["schedules"])
router.include_router(artifacts_router, prefix="/artifacts", tags=["artifacts"])
