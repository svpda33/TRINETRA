"""Geometry Configuration and Spatial Analytics API for NexTrAI (Stage 3.1)."""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from app.services.geometry_service import geometry_service
from app.services.video_ingestion_service import video_ingestion_service

router = APIRouter(prefix="/geometry", tags=["Camera Geometry & Spatial Analytics"])


@router.get("/summary")
async def get_geometry_summary():
    """Returns calibration summary, independent camera counts, and readiness status."""
    return geometry_service.get_calibration_summary()


@router.get("/cameras")
async def get_all_geometries():
    """Returns declarative geometry configurations (ROIs, lanes, stop lines) for all cameras."""
    geoms = geometry_service.get_all_geometries()
    return {cid: cfg.model_dump() for cid, cfg in geoms.items()}


@router.get("/cameras/{camera_id}")
async def get_camera_geometry(camera_id: str):
    """Returns declarative geometry configuration for a single camera."""
    cfg = geometry_service.get_camera_geometry(camera_id)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Geometry configuration for {camera_id} not found")
    return cfg.model_dump()


@router.get("/cameras/{camera_id}/spatial")
async def get_camera_spatial_telemetry(camera_id: str):
    """Returns real-time vehicle-to-lane spatial associations and queue metrics."""
    return video_ingestion_service.get_camera_spatial_telemetry(camera_id)


@router.get("/intersections/{intersection_id}/spatial")
async def get_intersection_spatial_demand(intersection_id: str):
    """Aggregates queue demand across independent cameras for an intersection."""
    return video_ingestion_service.get_intersection_spatial_demand(intersection_id)
