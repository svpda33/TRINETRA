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
        "platform": "NexTrAI Urban Traffic Intelligence & Management Platform",
        "category": "Intelligent Transportation Systems (ITS)",
        "services": {
            "api_server": "running",
            "safety_validator": "ready",
            "gemini_service": "configured" if settings.GEMINI_API_KEY else "standby",
            "anpr_engine": "ready",
            "gis_engine": "ready"
        }
    }
