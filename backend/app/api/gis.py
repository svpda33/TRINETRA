"""GIS Spatial Topology API endpoints for NexTrAI."""

from fastapi import APIRouter
from app.services.gis_engine import gis_engine

router = APIRouter(prefix="/gis", tags=["GIS Spatial Engine"])

@router.get("/topology")
async def get_gis_topology():
    """
    Returns GIS topology, junction coordinates, camera placements,
    and road segment distances along the Hyderabad Smart IT Corridor.
    """
    return {
        "status": "success",
        "data": gis_engine.get_topology_payload()
    }
