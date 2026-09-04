"""Priority Hierarchy configuration endpoints."""

from fastapi import APIRouter
from app.config import settings

router = APIRouter(prefix="/priority-levels", tags=["Priority Hierarchy"])

@router.get("")
async def get_priority_hierarchy():
    """
    Retrieve centralized priority hierarchy configuration.
    """
    return {
        "hierarchy": settings.PRIORITY_HIERARCHY,
        "total_levels": len(settings.PRIORITY_HIERARCHY),
        "rule": "Lower rank integer indicates higher emergency precedence."
    }
