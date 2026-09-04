"""Simulation Control API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.simulation_engine import simulation_engine
from app.models.priority import PriorityCategory

router = APIRouter(prefix="/simulation", tags=["Simulation Control"])

class EventTriggerRequest(BaseModel):
    category: PriorityCategory
    target_node: str = "I1"

@router.get("/state")
async def get_simulation_state():
    """Returns current real-time state of all 4 intersections and active events."""
    return {
        "is_running": simulation_engine.is_running,
        "topology": simulation_engine.get_topology(),
        "active_events": simulation_engine.active_events
    }

@router.post("/start")
async def start_simulation():
    """Starts automatic signal cycle simulation loop."""
    simulation_engine.start()
    return {"status": "started", "message": "Signal cycle simulation loop is running."}

@router.post("/stop")
async def stop_simulation():
    """Pauses automatic signal cycle simulation loop."""
    simulation_engine.stop()
    return {"status": "stopped", "message": "Signal cycle simulation loop is paused."}

@router.post("/trigger-event")
async def trigger_event(req: EventTriggerRequest):
    """Triggers a simulated priority traffic event (Emergency, Pedestrian, Wanted Vehicle, etc.)."""
    try:
        event = simulation_engine.trigger_event(req.category.value, req.target_node)
        # Automatically trigger broadcast
        await simulation_engine.broadcast_state()
        return {
            "status": "triggered",
            "event": event,
            "message": f"Successfully injected {req.category.value} event at node {req.target_node}."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/clear")
async def clear_events():
    """Clears all active simulation events and resets network signals to baseline."""
    simulation_engine.clear_events()
    await simulation_engine.broadcast_state()
    return {"status": "cleared", "message": "All active simulation events cleared."}
