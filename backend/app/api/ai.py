"""AI Contextual Reasoning & Gemini Traffic Intelligence API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from app.services.ai_coordinator import ai_coordinator
from app.services.gemini_service import gemini_traffic_service

router = APIRouter(prefix="/ai", tags=["AI Contextual Reasoning Layer"])

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, description="Natural language operator query")
    history: Optional[List[Dict[str, str]]] = Field(default=[], description="Previous conversation turns")

class IncidentReportRequest(BaseModel):
    event_id: Optional[str] = "EVT-01"
    intersection_id: Optional[str] = "I1"
    type: Optional[str] = "EMERGENCY_PREEMPTION"
    severity: Optional[str] = "HIGH"
    details: Optional[Dict[str, Any]] = {}

@router.get("/status")
async def get_ai_status():
    """Returns AI configuration status, provider, and active model."""
    gemini_ready = gemini_traffic_service.is_configured()
    
    return {
        "provider": "gemini" if gemini_ready else "none",
        "model": gemini_traffic_service.configured_model,
        "gemini_configured": gemini_ready,
        "status": "READY" if gemini_ready else "UNCONFIGURED"
    }

@router.post("/optimize")
async def optimize_ai_traffic():
    """
    Triggers AI contextual reasoning analysis over network state (I1 & I2),
    evaluates LLM recommendations, and passes plan through Deterministic Safety Layer.
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

@router.get("/traffic-summary")
async def get_traffic_summary():
    """Provides real-time narrative operational summary of network traffic conditions."""
    return await gemini_traffic_service.get_traffic_intelligence_summary()

@router.get("/explain-signal/{intersection_id}")
async def explain_signal_decision(intersection_id: str):
    """Explains why a given intersection approach is active, green allocations, and clearance safety."""
    return await gemini_traffic_service.explain_signal_decision(intersection_id)

@router.get("/congestion-insights")
async def get_congestion_insights():
    """Provides corridor bottleneck analysis and flow efficiency scoring."""
    return await gemini_traffic_service.analyze_network_congestion()

@router.post("/chat")
async def chat_with_operator_assistant(req: ChatRequest):
    """Natural-language conversational assistant for TMC operators."""
    return await gemini_traffic_service.operator_chat_assistant(req.message, req.history)

@router.post("/incident-report")
async def generate_incident_report_endpoint(req: IncidentReportRequest):
    """Generates formal markdown incident post-mortem documentation."""
    payload = {
        "event_id": req.event_id,
        "intersection_id": req.intersection_id,
        "type": req.type,
        "severity": req.severity,
        **(req.details or {})
    }
    return await gemini_traffic_service.generate_incident_report(payload)
