from fastapi import APIRouter

from app.routers.auth import router as auth_router
from app.routers.protected import router as protected_router
from app.routers.users import router as users_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(protected_router, tags=["protected"])
router.include_router(users_router, prefix="/users", tags=["users"])
