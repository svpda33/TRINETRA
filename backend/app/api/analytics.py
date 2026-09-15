"""Urban Traffic Analytics & Macro Flow API endpoints for NexTrAI."""

from fastapi import APIRouter
from app.services.analytics_engine import analytics_engine

router = APIRouter(prefix="/analytics", tags=["Urban Traffic Analytics"])

@router.get("/summary")
@router.get("/macro-flow")
async def get_analytics_summary():
    """
    Returns city-wide traffic volume, modal split (cars, 2-wheelers, buses, trucks, autos),
    corridor average speed, peak-hour flow rate, and identified bottlenecks.
    """
    metrics = await analytics_engine.get_summary_metrics()
    return {
        "status": "success",
        "data": metrics
    }

@router.get("/od-matrix")
async def get_od_matrix():
    """
    Returns Origin-Destination (O-D) flow matrix across the 4 Hyderabad corridor junctions.
    """
    od = await analytics_engine.get_od_matrix()
    return {
        "status": "success",
        "data": od
    }
