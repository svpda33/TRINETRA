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
    """Returns list of active CCTV camera feeds, genuine feed statuses, and live detections."""
    cams = []
    for cid, info in cv_detector.cameras.items():
        feed_status = video_ingestion_service.get_camera_status(cid)
        cams.append({
            "camera_id": cid,
            "intersection_id": info["intersection_id"],
            "direction": info["direction"],
            "name": info["name"],
            "status": info.get("status", "ONLINE"),
            "video_src": info["video_src"],
            "source_type": "RECORDED_CCTV_REPLAY",
            "feed_status": feed_status,
            "is_running": feed_status.get("is_running", False),
            "active_detections": feed_status.get("active_tracks", []),
            "vehicles_detected_count": feed_status.get("active_tracks_count", len(feed_status.get("active_tracks", []))),
            "spatial": feed_status.get("spatial"),
            "last_frame_idx": feed_status.get("last_frame_idx", 0),
            "video_time_sec": feed_status.get("video_time_sec", 0.0),
            "detection_age_sec": feed_status.get("detection_age_sec"),
            "is_expired": feed_status.get("is_expired", False),
            "last_update": feed_status.get("last_update")
        })
    return {
        "cameras": cams,
        "total_cameras": len(cams)
    }

@router.get("/feed-status/{camera_id}")
async def get_feed_status(camera_id: str):
    """Returns live frame-processing statistics for a specific CCTV camera."""
    return video_ingestion_service.get_camera_status(camera_id)

@router.get("/cameras/{camera_id}/spatial")
async def get_camera_spatial(camera_id: str):
    """Returns real-time vehicle-to-lane spatial associations and queue metrics."""
    return video_ingestion_service.get_camera_spatial_telemetry(camera_id)

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
    Operator / V2X Emergency Simulation Tool:
    Triggers simulated emergency beacon on a camera feed to evaluate staged green wave corridors.
    (Note: Distinguishes simulated emergency beacons from automatic CCTV vehicle detections).
    """
    try:
        res = cv_detector.simulate_camera_detection(req.camera_id, req.vehicle_type)
        return {
            "status": "success",
            "trigger_source": "OPERATOR_TRIGGERED_OR_V2X_SIMULATED",
            "utility": "EMERGENCY_CORRIDOR_SIMULATION",
            "data": res,
            "message": f"Operator/V2X trigger registered {req.vehicle_type} on {req.camera_id}. Staged corridor preemption initiated."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/trigger-ambulance-corridor")
async def trigger_ambulance_corridor(camera_id: str = "CAM_I1_NORTH"):
    """Triggers operator-dispatched ambulance preemption with staged I1 -> I2 corridor propagation."""
    try:
        res = cv_detector.simulate_camera_detection(camera_id, "AMBULANCE")
        return {
            "status": "success",
            "trigger_source": "OPERATOR_DISPATCH_OR_V2X_SIMULATED",
            "data": res,
            "message": f"Operator/V2X Dispatch: Ambulance preemption & staged I1 -> I2 corridor propagation initiated on {camera_id}."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/clear-detections")
async def clear_detections():
    """Clears camera detection overlays."""
    cv_detector.clear_detections()
    return {"status": "cleared", "message": "Camera detection overlays reset."}
