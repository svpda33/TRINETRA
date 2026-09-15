"""Vehicle Trajectory Reconstruction API endpoints for NexTrAI.

100% Database-driven spatial-temporal vehicle trajectory tracking across
geographically distributed cameras along the Hyderabad Smart IT Corridor.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
from app.services.trajectory_engine import trajectory_engine
from app.services.plate_validator import plate_validator

router = APIRouter(prefix="/trajectories", tags=["Vehicle Trajectory Engine"])

@router.get("/search")
@router.get("/{plate_number}")
async def get_vehicle_trajectory(plate_number: Optional[str] = None):
    """
    Retrieves full spatial-temporal reconstructed trajectory for a specific vehicle.
    Queries actual database sightings, orders them chronologically, and calculates
    segment distances, transit duration, and point-to-point average speeds.
    """
    if not plate_number:
        raise HTTPException(status_code=400, detail="plate_number query parameter is required.")

    norm = plate_number.replace(" ", "").upper()
    traj = await trajectory_engine.get_vehicle_trajectory(norm)

    if traj:
        return {"status": "success", "data": traj}

    # Honest, accurate response when no sightings exist for this plate
    raise HTTPException(
        status_code=404,
        detail=f"No sightings recorded for vehicle plate '{norm}'. Vehicle has not traversed monitored corridor cameras."
    )

@router.get("/recent/active")
async def get_recent_active(limit: int = Query(10, ge=1, le=50)):
    """Returns recent actively tracked vehicles with latest camera sighting."""
    recent = await trajectory_engine.get_recent_active_plates(limit=limit)
    return {"status": "success", "recent_trajectories": recent}
