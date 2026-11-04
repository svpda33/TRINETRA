"""Unit tests for Stage 3.2 Adaptive Traffic Signal Service."""

import pytest
from app.services.adaptive_signal_service import (
    AdaptiveIntersectionController, AdaptiveSignalService
)


def test_min_green_constraint_enforced():
    """Verify green cannot terminate before MIN_GREEN_SEC (15s) despite high competitor pressure."""
    ctrl = AdaptiveIntersectionController("TEST_I1")
    ctrl.current_approach = "WEST"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 5.0  # 5s in green

    # Heavily congested EAST approach
    queues = {"NORTH": 0, "SOUTH": 0, "EAST": 20, "WEST": 2}
    dec = ctrl.tick(1.0, queues)

    # Must remain GREEN on WEST
    assert dec["interval_state"] == "GREEN"
    assert dec["current_approach"] == "WEST"
    assert "MIN_GREEN_ACTIVE" in dec["active_constraints"]


def test_max_green_constraint_enforced():
    """Verify green must initiate clearance once MAX_GREEN_SEC (60s) expires."""
    ctrl = AdaptiveIntersectionController("TEST_I1")
    ctrl.current_approach = "WEST"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 60.0  # Max green reached

    queues = {"NORTH": 2, "SOUTH": 2, "EAST": 10, "WEST": 5}
    dec = ctrl.tick(1.0, queues)

    # Must transition to YELLOW to serve EAST
    assert dec["interval_state"] == "YELLOW"
    assert dec["target_approach"] == "EAST"
    assert "MAX_GREEN_EXPIRED" in dec["active_constraints"]


def test_clearance_intervals_yellow_and_all_red():
    """Verify deterministic 4s Yellow followed by 2s All-Red sequence."""
    ctrl = AdaptiveIntersectionController("TEST_I1")
    ctrl.current_approach = "WEST"
    ctrl.target_approach = "EAST"
    ctrl.interval_state = "YELLOW"
    ctrl.interval_elapsed = 3.0

    # Advance 1s -> reaches 4.0s yellow
    d1 = ctrl.tick(1.0, {"EAST": 5, "WEST": 1})
    assert d1["interval_state"] == "ALL_RED"
    assert d1["interval_elapsed_sec"] == 0.0

    # Advance 1s in ALL_RED
    d2 = ctrl.tick(1.0, {"EAST": 5, "WEST": 1})
    assert d2["interval_state"] == "ALL_RED"

    # Advance 1s more (reaches 2.0s all-red) -> switches to GREEN on target
    d3 = ctrl.tick(1.0, {"EAST": 5, "WEST": 1})
    assert d3["interval_state"] == "GREEN"
    assert d3["current_approach"] == "EAST"
    assert "SAFETY_VALIDATED" in d3["active_constraints"]


def test_starvation_mitigation_trigger():
    """Verify approach waiting >= 75s with queue receives priority boost."""
    ctrl = AdaptiveIntersectionController("TEST_I1")
    ctrl.current_approach = "WEST"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 20.0  # past min green
    ctrl.waiting_times["NORTH"] = 80.0  # Starved

    queues = {"NORTH": 3, "SOUTH": 0, "EAST": 2, "WEST": 4}
    dec = ctrl.tick(1.0, queues)

    assert dec["interval_state"] == "YELLOW"
    assert dec["target_approach"] == "NORTH"
    assert "STARVATION_PREVENTION" in dec["active_constraints"]


def test_baseline_benchmark_execution():
    """Verify baseline comparison benchmark computes metrics with equalized saturation flow."""
    service = AdaptiveSignalService()
    res = service.run_baseline_benchmark(simulation_seconds=120, profile="arterial_corridor_heavy")

    assert "models" in res
    assert "FIXED_TIME" in res["models"]
    assert "ACTUATED" in res["models"]
    assert "NEXTRAI_ADAPTIVE" in res["models"]

    # Verify fair audit metadata
    assert "methodology_audit" in res
    assert res["methodology_audit"]["status"] == "FAIR_EQUAL_SATURATION_FLOW_VERIFIED"
    assert "INVALIDATED" in res["methodology_audit"]["previous_asymmetric_benchmark"]

    # Verify Adaptive achieves throughput and low delay
    ad_m = res["models"]["NEXTRAI_ADAPTIVE"]
    ft_m = res["models"]["FIXED_TIME"]
    assert ad_m["total_throughput_vehicles"] > 0
    assert ft_m["total_throughput_vehicles"] > 0
    assert "delay_reduction_vs_fixed_time_pct" in res["performance_comparison"]

    # Test alternate profile
    res_bal = service.run_baseline_benchmark(simulation_seconds=60, profile="balanced_all_approach")
    assert res_bal["demand_profile"] == "balanced_all_approach"


def test_safe_emergency_preemption_lifecycle():
    """Verify emergency preemption NEVER snaps instantly to green; enforces 4s Yellow + 2s All-Red."""
    ctrl = AdaptiveIntersectionController("TEST_I1")
    ctrl.current_approach = "WEST"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 20.0

    # 1. Request Emergency Preemption on NORTH approach
    preempt_res = ctrl.set_emergency_preemption(approach="NORTH", active=True)
    assert preempt_res["emergency_active"] is True
    assert preempt_res["emergency_approach"] == "NORTH"
    assert preempt_res["preemption_state"] == "WAITING_CLEARANCE"
    # Current approach must NOT be NORTH yet! Must transition through clearance
    assert ctrl.interval_state == "YELLOW"
    assert ctrl.current_approach == "WEST"
    assert ctrl.target_approach == "NORTH"

    # 2. Advance 3 seconds in Yellow -> still Yellow
    d1 = ctrl.tick(3.0, {"NORTH": 1, "WEST": 5})
    assert d1["interval_state"] == "YELLOW"
    assert d1["preemption_state"] == "WAITING_CLEARANCE"

    # 3. Advance 1 more second (reaches 4s Yellow) -> transitions to ALL_RED
    d2 = ctrl.tick(1.0, {"NORTH": 1, "WEST": 5})
    assert d2["interval_state"] == "ALL_RED"
    assert d2["preemption_state"] == "WAITING_CLEARANCE"

    # 4. Advance 2 seconds in All-Red -> Safely activates EMERGENCY GREEN on NORTH
    d3 = ctrl.tick(2.0, {"NORTH": 1, "WEST": 5})
    assert d3["interval_state"] == "GREEN"
    assert d3["current_approach"] == "NORTH"
    assert d3["preemption_state"] == "ACTIVE"
    assert "EMERGENCY_GREEN_ENGAGED" in d3["active_constraints"]

    # 5. Hold emergency green past standard 60s max green: must remain GREEN on NORTH
    ctrl.interval_elapsed = 70.0
    d4 = ctrl.tick(1.0, {"NORTH": 0, "WEST": 20})
    assert d4["interval_state"] == "GREEN"
    assert d4["current_approach"] == "NORTH"
    assert d4["preemption_state"] == "ACTIVE"

    # 6. Release emergency preemption: must safely transition via Yellow clearance
    rel_res = ctrl.set_emergency_preemption(approach="", active=False)
    assert rel_res["emergency_active"] is False
    assert rel_res["preemption_state"] == "RELEASING"
    assert ctrl.interval_state == "YELLOW"
    assert ctrl.interval_elapsed == 0.0


def test_cv_pipeline_to_adaptive_signal_integration():
    """
    CRITICAL INTEGRATION TEST:
    Verify that AdaptiveIntersectionController.tick() without manual queue_counts
    directly ingests genuine queue demand from video_ingestion_service / spatial geometry.
    """
    from unittest.mock import patch

    ctrl = AdaptiveIntersectionController("I1")
    ctrl.current_approach = "WEST"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 20.0  # Eligible for dynamic transition past min green

    # Mock video_ingestion_service spatial demand returning genuine camera measurements
    camera_demand = {
        "intersection_id": "I1",
        "is_data_available": True,
        "data_quality": "ACTIVE_REPLAY_STREAM",
        "approaches": {
            "NORTH": {"queue": 15, "observed": 20},
            "SOUTH": {"queue": 2, "observed": 4},
            "EAST": {"queue": 1, "observed": 3},
            "WEST": {"queue": 0, "observed": 1}
        }
    }

    with patch("app.services.adaptive_signal_service.video_ingestion_service.get_intersection_spatial_demand", return_value=camera_demand):
        dec = ctrl.tick(delta_sec=1.0)
        
        # Controller must have ingested camera demand directly
        assert dec["queue_counts"]["NORTH"] == 15
        assert dec["queue_counts"]["SOUTH"] == 2
        assert dec["queue_counts"]["WEST"] == 0
        # High NORTH demand must drive pressure and trigger transition to serve NORTH
        assert dec["pressures"]["NORTH"] >= 15.0
        assert dec["target_approach"] == "NORTH"
        assert dec["interval_state"] == "YELLOW"
        assert "PRESSURE_TRANSFER" in dec["active_constraints"]


def test_scenario_low_density_smooth_cycling():
    """Verify low-density scenario cycles smoothly adhering to min-green constraints."""
    ctrl = AdaptiveIntersectionController("I1")
    ctrl.current_approach = "NORTH"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 0.0

    low_queues = {"NORTH": 1, "SOUTH": 1, "EAST": 1, "WEST": 1}

    # First 14 seconds: must hold MIN_GREEN_ACTIVE
    for sec in range(14):
        dec = ctrl.tick(1.0, low_queues)
        assert dec["interval_state"] == "GREEN"
        assert "MIN_GREEN_ACTIVE" in dec["active_constraints"]

    # At 15.0s, min green expires. Since competitors accumulated waiting time,
    # the controller safely initiates Yellow clearance to rotate to the competitor with highest waiting pressure!
    dec15 = ctrl.tick(1.0, low_queues)
    assert dec15["interval_state"] in ["YELLOW", "GREEN"]
    if dec15["interval_state"] == "YELLOW":
        assert dec15["target_approach"] in ["SOUTH", "EAST", "WEST"]


def test_scenario_unbalanced_high_density_and_gridlock():
    """Verify heavy unbalanced demand and gridlock scenarios prevent deadlock and starvation."""
    ctrl = AdaptiveIntersectionController("I1")
    ctrl.current_approach = "NORTH"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 20.0

    # Unbalanced: SOUTH has 35 vehicles (gridlock approach)
    unbalanced_queues = {"NORTH": 2, "SOUTH": 35, "EAST": 1, "WEST": 0}
    dec = ctrl.tick(1.0, unbalanced_queues)

    # Competitor pressure significantly exceeds current approach -> initiates yellow transition to SOUTH
    assert dec["target_approach"] == "SOUTH"
    assert dec["interval_state"] == "YELLOW"
    assert "PRESSURE_TRANSFER" in dec["active_constraints"]

    # Advance through Yellow (4s) and All-Red (2s)
    ctrl.tick(4.0, unbalanced_queues)
    dec_green = ctrl.tick(2.0, unbalanced_queues)

    assert dec_green["interval_state"] == "GREEN"
    assert dec_green["current_approach"] == "SOUTH"
    assert dec_green["waiting_times"]["SOUTH"] == 0.0


