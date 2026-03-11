from fastapi import APIRouter

from app.dependencies import require_role
from app.models import Role, User

router = APIRouter()


@router.get("/admin/dashboard")
async def admin_dashboard(current_user: User = require_role(Role.admin)):
    return {"message": f"Welcome, admin {current_user.email}"}


@router.get("/operator/jobs")
async def operator_jobs(current_user: User = require_role(Role.operator, Role.admin)):
    return {"message": f"Job list for {current_user.email}", "role": current_user.role}


@router.get("/viewer/reports")
async def viewer_reports(current_user: User = require_role(Role.viewer, Role.operator, Role.admin)):
    return {"message": f"Reports for {current_user.email}", "role": current_user.role}
