"""WebSocket Telemetry Streaming Route."""

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.simulation_engine import simulation_engine

router = APIRouter(tags=["WebSocket Telemetry"])

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time telemetry streaming to frontend dashboard.
    Broadcasts state updates whenever signal cycles advance or priority events trigger.
    """
    await websocket.accept()
    queue = simulation_engine.subscribe()
    
    try:
        # Send immediate initial state on connect
        initial_state = simulation_engine.get_topology().model_dump()
        await websocket.send_json(initial_state)
        
        while True:
            # Wait for next state broadcast from simulation engine
            state_data = await queue.get()
            await websocket.send_json(state_data)
    except WebSocketDisconnect:
        simulation_engine.unsubscribe(queue)
    except Exception:
        simulation_engine.unsubscribe(queue)
