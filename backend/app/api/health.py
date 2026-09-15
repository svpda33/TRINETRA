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
        "step": "NexTrAI City-Wide ANPR & Trajectory Tracking Engine (BEL SIH PS 26127)",
        "services": {
            "api_server": "running",
            "safety_validator": "ready",
            "ai_coordinator": "configured" if settings.FEATHERLESS_API_KEY else "standby",
            "anpr_engine": "ready",
            "gis_engine": "ready"
        }
    }
