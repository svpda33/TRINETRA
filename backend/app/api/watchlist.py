"""Watchlist & Security Alert API endpoints for NexTrAI."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.watchlist_service import watchlist_service

router = APIRouter(prefix="/watchlist", tags=["Watchlist & Alert Engine"])

class AddWatchlistRequest(BaseModel):
    plate_number: str
    alert_type: str = "STOLEN_VEHICLE"
    severity: str = "HIGH"
    notes: str = ""

@router.get("")
async def get_watchlist():
    """Lists all monitored vehicle license plates."""
    entries = await watchlist_service.get_all_watchlist()
    return {
        "status": "success",
        "total": len(entries),
        "watchlist": entries
    }

@router.post("")
async def add_watchlist(req: AddWatchlistRequest):
    """Adds a new license plate to the security watchlist."""
    try:
        entry = await watchlist_service.add_watchlist_entry(
            plate_number=req.plate_number,
            alert_type=req.alert_type,
            severity=req.severity,
            notes=req.notes
        )
        return {
            "status": "success",
            "data": entry,
            "message": f"Plate {req.plate_number} added to {req.severity} watchlist."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/alerts")
async def get_active_alerts():
    """Returns active, unacknowledged security and watchlist alerts."""
    alerts = await watchlist_service.get_active_alerts()
    return {
        "status": "success",
        "total_active_alerts": len(alerts),
        "alerts": alerts
    }

@router.post("/alerts/{alert_id}/ack")
async def acknowledge_alert(alert_id: int):
    """Marks an alert as acknowledged by traffic command operator."""
    await watchlist_service.acknowledge_alert(alert_id)
    return {
        "status": "success",
        "message": f"Alert {alert_id} marked as acknowledged."
    }
