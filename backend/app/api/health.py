"""Health check API endpoint."""

from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    """
    Health-check endpoint confirming backend service operational status.
    """
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
        "step": "Step 1 - Foundation & Architecture",
        "services": {
            "api_server": "running",
            "safety_validator": "ready",
            "ai_coordinator": "configured" if settings.FEATHERLESS_API_KEY else "standby",
            "cv_detector": "standby"
        }
    }
