"""AI Contextual Reasoning API endpoints."""

from fastapi import APIRouter
from app.services.ai_coordinator import ai_coordinator

router = APIRouter(prefix="/ai", tags=["AI Contextual Reasoning Layer"])

@router.get("/status")
async def get_ai_status():
    """Returns Featherless API configuration status and target LLM model."""
    return {
        "model": ai_coordinator.model,
        "featherless_api_configured": ai_coordinator.is_configured(),
        "status": "READY" if ai_coordinator.is_configured() else "UNCONFIGURED"
    }

@router.post("/optimize")
async def optimize_ai_traffic():
    """
    Triggers AI contextual reasoning analysis over network state (I1 & I2),
    evaluates Featherless LLM recommendations, and passes plan through Deterministic Safety Layer.
    """
    res = await ai_coordinator.compute_reasoning_plan()
    return {
        "status": res.get("status", "success"),
        "data": res
    }

@router.post("/reason")
async def compute_ai_reasoning():
    """Alias endpoint for AI optimization request."""
    return await optimize_ai_traffic()
