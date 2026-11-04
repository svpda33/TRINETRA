"""Adaptive Traffic Signal Intelligence & Baseline Comparison API for NexTrAI (Stage 3.2)."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Dict, Any, Optional, List
from app.services.adaptive_signal_service import adaptive_signal_service

router = APIRouter(prefix="/signals", tags=["Adaptive Signal Intelligence"])


class TickRequest(BaseModel):
    delta_sec: float = 1.0
    queue_counts: Optional[Dict[str, int]] = None


class EmergencyPreemptionRequest(BaseModel):
    approach: str = "WEST"
    active: bool = True

    @field_validator("approach")
    @classmethod
    def validate_approach(cls, v: str, info):
        if not isinstance(v, str):
            raise ValueError("Approach must be a non-empty string.")
        cleaned = v.strip().upper()
        # When active is True (or default), validate against the 4 physical approaches
        if cleaned not in {"NORTH", "SOUTH", "EAST", "WEST"}:
            raise ValueError(f"Invalid approach '{v}'. Approach must be one of ['NORTH', 'SOUTH', 'EAST', 'WEST'].")
        return cleaned


@router.get("/adaptive/{intersection_id}/status")
async def get_adaptive_signal_status(intersection_id: str):
    """
    Returns current deterministic adaptive signal state, approach pressures,
    active constraints, and explainability reasoning for an intersection.
    """
    return adaptive_signal_service.get_status(intersection_id)


@router.post("/adaptive/{intersection_id}/tick")
async def tick_adaptive_signal(intersection_id: str, req: TickRequest):
    """
    Advances deterministic signal controller state machine by delta_sec.
    Enforces min/max green, yellow clearance, and all-red clearance.
    """
    return adaptive_signal_service.tick_intersection(
        intersection_id=intersection_id,
        delta_sec=req.delta_sec,
        queue_counts=req.queue_counts
    )


@router.post("/adaptive/{intersection_id}/emergency-preemption")
async def set_emergency_preemption(intersection_id: str, req: EmergencyPreemptionRequest):
    """
    Applies or cancels emergency vehicle preemption priority for an intersection approach.
    Initiates safe clearance transition (Yellow -> All-Red -> Emergency Green).
    """
    ctrl = adaptive_signal_service.get_controller(intersection_id)
    try:
        return ctrl.set_emergency_preemption(approach=req.approach, active=req.active)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/benchmark/comparison")
async def get_benchmark_comparison(
    simulation_seconds: int = Query(360, ge=60, le=1800),
    profile: str = Query("arterial_corridor_heavy", description="Demand profile: arterial_corridor_heavy, balanced_all_approach, off_peak"),
    seeds: Optional[str] = Query(None, description="Comma-separated random seeds (e.g. '42,101,777')")
):
    """
    Runs rigorous baseline comparison across:
    1. Fixed-Time (Pre-Timed)
    2. Actuated (Gap-Out)
    3. NexTrAI Adaptive (Queue-Pressure & Anti-Starvation)
    All models use equalized multi-lane saturation flow capacity.
    Supports multi-seed Monte Carlo evaluation reporting statistical distributions.
    """
    seed_list = None
    if seeds:
        try:
            seed_list = [int(s.strip()) for s in seeds.split(",") if s.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid seeds parameter: must be comma-separated integers.")

    return adaptive_signal_service.run_baseline_benchmark(
        simulation_seconds=simulation_seconds,
        profile=profile,
        seeds=seed_list
    )
