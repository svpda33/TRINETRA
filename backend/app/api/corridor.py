"""City-Wide Corridor Coordination & Network Progression API for NexTrAI (Stage 3.4)."""

from fastapi import APIRouter, Query
from typing import Optional
from app.services.corridor_coordination_service import corridor_coordination_service

router = APIRouter(prefix="/corridor", tags=["Corridor Progression & Network Coordination"])


@router.get("/progression")
async def get_corridor_progression(speed_kmh: Optional[float] = Query(40.0, ge=10.0, le=100.0)):
    """
    Returns deterministic green-wave progression offset, travel time, and
    platoon arrival window between I1 and I2 along the MG Road arterial corridor.
    """
    return corridor_coordination_service.calculate_green_wave_offset(corridor_speed_kmh=speed_kmh)


@router.get("/heatmap")
async def get_network_congestion_heatmap():
    """
    Aggregates approach queue demand and lane densities across all independent CCTV cameras
    to provide city-wide congestion index, bottleneck hotspots, and corridor spillback risk.
    """
    return corridor_coordination_service.get_network_congestion_heatmap()


@router.get("/connectivity")
async def get_network_connectivity():
    """
    Returns the multi-intersection connectivity matrix and arterial corridor kinematics.
    """
    return corridor_coordination_service.get_connectivity_matrix()
