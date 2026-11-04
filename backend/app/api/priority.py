"""Priority Hierarchy and Emergency Corridor Preemption endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.config import settings
from app.services.emergency_priority_service import emergency_priority_service

router = APIRouter(prefix="/priority", tags=["Priority Hierarchy & Emergency Preemption"])


class ManualPreemptionRequest(BaseModel):
    camera_id: str = "CAM_I1_WEST"
    vehicle_class: str = "AMBULANCE"
    track_id: int = 9999


@router.get("/levels")
@router.get("/priority-levels")
async def get_priority_hierarchy():
    """
    Retrieve centralized priority hierarchy configuration.
    """
    return {
        "hierarchy": settings.PRIORITY_HIERARCHY,
        "total_levels": len(settings.PRIORITY_HIERARCHY),
        "rule": "Lower rank integer indicates higher emergency precedence."
    }


@router.get("/emergency/status")
async def get_emergency_status():
    """Returns currently active emergency preemption corridors and recent audit log."""
    return emergency_priority_service.get_preemption_status()


@router.post("/emergency/trigger")
async def trigger_emergency_preemption(req: ManualPreemptionRequest):
    """
    Operator Manual / V2X Simulated Trigger:
    Preempts traffic signals along the designated corridor using operator dispatch
    or simulated emergency V2X beacon (distinguished from standard CV vehicle classes).
    Enforces deterministic safety clearance and staged downstream progression.
    """
    # Trigger first hit
    emergency_priority_service.register_emergency_detection(
        camera_id=req.camera_id,
        track_id=req.track_id,
        vehicle_class=req.vehicle_class,
        confidence=0.98
    )
    # Trigger second hit for confirmation
    res = emergency_priority_service.register_emergency_detection(
        camera_id=req.camera_id,
        track_id=req.track_id,
        vehicle_class=req.vehicle_class,
        confidence=0.99
    )
    res["trigger_source"] = "OPERATOR_TRIGGERED_OR_V2X_SIMULATED"
    return res


@router.post("/emergency/release/{intersection_id}")
async def release_emergency_preemption(intersection_id: str, reason: str = "OPERATOR_OVERRIDE"):
    """
    Operator Manual Release: Cancels emergency preemption and resumes smooth adaptive control.
    """
    return emergency_priority_service.release_preemption(intersection_id, reason=reason)
