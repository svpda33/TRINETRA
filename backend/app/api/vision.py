"""Vision Detection & Live Video Ingestion API endpoints for NexTrAI."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.cv_detector import cv_detector
from app.services.video_ingestion_service import video_ingestion_service

router = APIRouter(prefix="/vision", tags=["Computer Vision Pipeline"])

class DetectionTriggerRequest(BaseModel):
    camera_id: str = "CAM_I1_NORTH"
    vehicle_type: str = "AMBULANCE"

@router.get("/cameras")
async def get_cameras():
    """Returns list of active CCTV camera feeds and detection statuses."""
    return {
        "cameras": cv_detector.get_cameras(),
        "total_cameras": len(cv_detector.cameras)
    }

@router.get("/feed-status/{camera_id}")
async def get_feed_status(camera_id: str):
    """Returns live frame-processing statistics for a specific CCTV camera."""
    return video_ingestion_service.get_camera_status(camera_id)

@router.post("/start-feed/{camera_id}")
async def start_camera_feed(camera_id: str, sample_interval: int = Query(4, ge=1, le=30)):
    """
    Starts real video ingestion, YOLOv8 inference, and multi-object tracking
    on the camera's video stream.
    """
    res = video_ingestion_service.start_camera(camera_id, sample_interval=sample_interval)
    return res

@router.post("/stop-feed/{camera_id}")
async def stop_camera_feed(camera_id: str):
    """Stops video capture worker for a camera."""
    res = video_ingestion_service.stop_camera(camera_id)
    return res

@router.post("/process-batch/{camera_id}")
async def process_video_batch(camera_id: str, max_frames: int = Query(25, ge=1, le=150)):
    """
    Synchronously runs YOLOv8 and IoU tracking on N real frames from the camera's MP4 video.
    Guarantees genuine detections, tracking IDs, and database sighting rows.
    """
    res = video_ingestion_service.process_video_batch(camera_id, max_frames=max_frames)
    return res

@router.post("/simulate-detection")
async def simulate_detection(req: DetectionTriggerRequest):
    """
    Emergency Simulation Tool:
    Triggers simulated detection of an emergency vehicle on a camera feed to test green corridors.
    """
    try:
        res = cv_detector.simulate_camera_detection(req.camera_id, req.vehicle_type)
        return {
            "status": "success",
            "utility": "EMERGENCY_CORRIDOR_SIMULATION",
            "data": res,
            "message": f"CV Pipeline detected {req.vehicle_type} on {req.camera_id}. Automated green wave corridor triggered."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/trigger-ambulance-corridor")
async def trigger_ambulance_corridor(camera_id: str = "CAM_I1_NORTH"):
    """Triggers emergency ambulance tracking and dynamic I1 -> I2 corridor propagation."""
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
