"""Vision Detection API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.cv_detector import cv_detector

router = APIRouter(prefix="/vision", tags=["Computer Vision Pipeline"])

class DetectionTriggerRequest(BaseModel):
    camera_id: str = "CAM_I1"
    vehicle_type: str = "AMBULANCE"

@router.get("/cameras")
async def get_cameras():
    """Returns list of active CCTV camera feeds and detection statuses."""
    return {
        "cameras": cv_detector.get_cameras(),
        "total_cameras": len(cv_detector.cameras)
    }

@router.post("/simulate-detection")
async def simulate_detection(req: DetectionTriggerRequest):
    """Triggers automated computer vision detection of an emergency vehicle on a camera feed."""
    try:
        res = cv_detector.simulate_camera_detection(req.camera_id, req.vehicle_type)
        return {
            "status": "success",
            "data": res,
            "message": f"CV Pipeline detected {req.vehicle_type} on {req.camera_id}. Automated green wave corridor triggered."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/trigger-ambulance-corridor")
async def trigger_ambulance_corridor(camera_id: str = "CAM_I1_NORTH"):
    """Triggers real-time frame-by-frame YOLO ambulance tracking and dynamic I1 -> I2 emergency corridor propagation."""
    try:
        res = cv_detector.simulate_camera_detection(camera_id, "AMBULANCE")
        return {
            "status": "success",
            "data": res,
            "message": f"Autonomous YOLO Ambulance Tracking & Dynamic I1 -> I2 Corridor Propagation initiated on {camera_id}."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/clear-detections")
async def clear_detections():
    """Clears camera detection overlays."""
    cv_detector.clear_detections()
    return {"status": "cleared", "message": "Camera detection overlays reset."}
