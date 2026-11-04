"""Comprehensive test suite for Stage 3.6 Safety Hardening and Stage 4 Traffic Intelligence."""

import pytest
import time
from app.services.adaptive_signal_service import (
    AdaptiveIntersectionController,
    adaptive_signal_service
)
from app.services.emergency_priority_service import (
    EmergencyPriorityService,
    emergency_priority_service
)
from app.services.corridor_coordination_service import corridor_coordination_service
from app.services.spatial_geometry_service import spatial_geometry_service


def test_emergency_cancellation_during_waiting_clearance_prevents_emergency_green():
    """
    Stage 3.6.A Safety Hardening:
    If emergency priority is cancelled while in WAITING_CLEARANCE (YELLOW or ALL_RED),
    the controller must finish clearance safely, redirect target_approach to a civilian
    candidate, and NEVER grant Green to the cancelled emergency approach.
    """
    ctrl = AdaptiveIntersectionController("TEST_CANCEL_WAIT")
    ctrl.current_approach = "WEST"
    ctrl.interval_state = "GREEN"
    ctrl.interval_elapsed = 20.0

    # 1. Request emergency preemption on NORTH approach
    res = ctrl.set_emergency_preemption("NORTH", active=True)
    assert res["preemption_state"] == "WAITING_CLEARANCE"
    assert ctrl.interval_state == "YELLOW"
    assert ctrl.target_approach == "NORTH"

    # 2. Advance 2 seconds into Yellow (interval_elapsed = 2.0 / 4.0)
    ctrl.tick(2.0, {"NORTH": 0, "SOUTH": 0, "EAST": 0, "WEST": 0})
    assert ctrl.interval_state == "YELLOW"
    assert ctrl.preemption_state == "WAITING_CLEARANCE"

    # 3. CANCEL preemption while in Yellow clearance
    rel = ctrl.set_emergency_preemption("", active=False)
    assert ctrl.emergency_active is False
    assert ctrl.emergency_approach is None
    # CRITICAL: Target approach must NO LONGER be NORTH!
    assert ctrl.target_approach != "NORTH"
    assert ctrl.preemption_state == "RECOVERY"

    # 4. Advance through remainder of Yellow (2s) and into All-Red (2s)
    ctrl.tick(2.5, {"NORTH": 0, "SOUTH": 0, "EAST": 0, "WEST": 0})
    assert ctrl.interval_state == "ALL_RED"
    assert ctrl.target_approach != "NORTH"

    # 5. Advance through All-Red to Green activation
    ctrl.tick(2.5, {"NORTH": 0, "SOUTH": 0, "EAST": 0, "WEST": 0})
    assert ctrl.interval_state == "GREEN"
    # Guaranteed safety: Green is given to the civilian candidate, NEVER to cancelled NORTH!
    assert ctrl.current_approach != "NORTH"
    assert ctrl.current_approach in {"WEST", "SOUTH", "EAST"}


def test_emergency_cancellation_during_active_green_initiates_full_clearance():
    """
    Stage 3.6.A: When priority is cancelled during ACTIVE emergency green,
    it must safely initiate Yellow (4s) followed by All-Red (2s) clearance.
    It can NEVER immediately switch to green on another approach.
    """
    ctrl = AdaptiveIntersectionController("TEST_CANCEL_ACTIVE")
    ctrl.current_approach = "NORTH"
    ctrl.interval_state = "GREEN"
    ctrl.preemption_state = "ACTIVE"
    ctrl.emergency_approach = "NORTH"
    ctrl.emergency_active = True

    # Cancel preemption
    ctrl.set_emergency_preemption("", active=False)
    assert ctrl.preemption_state == "RELEASING"
    assert ctrl.interval_state == "YELLOW"
    assert ctrl.interval_elapsed == 0.0
    assert ctrl.target_approach != "NORTH"

    # Step through Yellow
    ctrl.tick(4.0, {"NORTH": 0, "SOUTH": 0, "EAST": 0, "WEST": 0})
    assert ctrl.interval_state == "ALL_RED"

    # Step through All-Red
    ctrl.tick(2.0, {"NORTH": 0, "SOUTH": 0, "EAST": 0, "WEST": 0})
    assert ctrl.interval_state == "GREEN"
    assert ctrl.current_approach != "NORTH"


def test_simultaneous_emergency_tie_breaking_via_fifo_queue():
    """
    Stage 3.6.A: When multiple emergency requests arrive simultaneously,
    the active approach is preserved and subsequent requests are placed into a FIFO queue.
    Upon release of the active emergency, the queued emergency is served with full clearance.
    """
    ctrl = AdaptiveIntersectionController("TEST_FIFO")
    ctrl.current_approach = "WEST"
    ctrl.interval_state = "GREEN"

    # First emergency: NORTH
    res1 = ctrl.set_emergency_preemption("NORTH", active=True)
    assert res1["emergency_approach"] == "NORTH"
    assert ctrl.preemption_state == "WAITING_CLEARANCE"

    # Second emergency arrives for EAST while NORTH is clearing
    res2 = ctrl.set_emergency_preemption("EAST", active=True)
    assert "EAST" in ctrl._pending_emergency_requests
    assert ctrl.emergency_approach == "NORTH"  # Active emergency not disrupted

    # Finish clearance to get NORTH into ACTIVE green
    ctrl.tick(4.0, {"NORTH": 0, "SOUTH": 0, "EAST": 0, "WEST": 0})  # Yellow done -> All-Red
    ctrl.tick(2.0, {"NORTH": 0, "SOUTH": 0, "EAST": 0, "WEST": 0})  # All-Red done -> NORTH Green
    assert ctrl.current_approach == "NORTH"
    assert ctrl.interval_state == "GREEN"
    assert ctrl.preemption_state == "ACTIVE"

    # Release NORTH preemption -> must seamlessly promote EAST from queue
    ctrl.set_emergency_preemption("", active=False)
    assert ctrl.emergency_approach == "EAST"
    assert ctrl.emergency_active is True
    # NORTH initiates yellow clearance to serve EAST safely
    assert ctrl.interval_state == "YELLOW"
    assert ctrl.target_approach == "EAST"


def test_approach_input_validation_strictness():
    """
    Stage 3.6.B: Approach parameter must strictly be in {"NORTH", "SOUTH", "EAST", "WEST"}.
    Any invalid input must raise ValueError.
    """
    ctrl = AdaptiveIntersectionController("TEST_VALIDATION")

    # Valid inputs (case-insensitive and trimmed)
    for valid_app in ["north", " SOUTH ", "EAST", "west"]:
        res = ctrl.set_emergency_preemption(valid_app, active=True)
        assert res["emergency_approach"] == valid_app.strip().upper()
        ctrl.set_emergency_preemption("", active=False)

    # Invalid inputs must raise ValueError
    invalid_inputs = ["NORTHEAST", "UNKNOWN", "", "   ", "DOWN", "123", None]
    for inv in invalid_inputs:
        with pytest.raises(ValueError):
            ctrl.set_emergency_preemption(inv, active=True)


def test_corridor_mapping_route_isolation():
    """
    Stage 3.6.C Corridor Mapping Audit:
    Only genuine East-West arterial feeds (CAM_I1_WEST, CAM_I2_EAST) schedule downstream preemption.
    Cross-street feeds (CAM_I1_NORTH, CAM_I2_NORTH) preempt strictly their local node.
    """
    service = EmergencyPriorityService()

    # CAM_I1_WEST -> Staged preemption of both I1 and I2
    service.register_emergency_detection("CAM_I1_WEST", 101, "AMBULANCE", 0.95)
    res_w = service.register_emergency_detection("CAM_I1_WEST", 101, "AMBULANCE", 0.95)
    assert len(res_w["corridor_preemption"]["preempted_intersections"]) == 1  # I1 immediate
    assert len(res_w["corridor_preemption"]["scheduled_downstream_intersections"]) == 1  # I2 staged
    service.release_preemption("I1")

    # CAM_I1_NORTH -> Preempts ONLY I1 (isolated cross-street, NO downstream preemption)
    service.register_emergency_detection("CAM_I1_NORTH", 102, "AMBULANCE", 0.95)
    res_n = service.register_emergency_detection("CAM_I1_NORTH", 102, "AMBULANCE", 0.95)
    assert len(res_n["corridor_preemption"]["preempted_intersections"]) == 1
    assert res_n["corridor_preemption"]["preempted_intersections"][0]["intersection_id"] == "I1"
    assert len(res_n["corridor_preemption"]["scheduled_downstream_intersections"]) == 0  # NO staged nodes!
    service.release_preemption("I1")


@pytest.mark.anyio
async def test_restart_recovery_reconciliation():
    """
    Stage 3.6.D: Restart recovery invalidates stale DB states on reboot
    and initializes all controllers safely into clean civilian mode.
    """
    from app.db import AsyncSessionLocal, init_db
    from app.models.db_models import EmergencyEventModel, CorridorScheduleModel
    from sqlalchemy import select

    await init_db()

    ts = int(time.time() * 1000)
    ev_id = f"TEST_REBOOT_EV_{ts}"
    sched_id = f"TEST_REBOOT_SCHED_{ts}"

    # Seed an unreleased emergency event and pending schedule
    async with AsyncSessionLocal() as session:
        ev = EmergencyEventModel(
            event_id=ev_id,
            trigger_camera_id="CAM_I1_WEST",
            intersection_id="I1",
            approach="WEST",
            status="ACTIVE"
        )
        sc = CorridorScheduleModel(
            schedule_id=sched_id,
            event_id=ev_id,
            upstream_iid="I1",
            downstream_iid="I2",
            approach="WEST",
            target_activation_timestamp=time.time() + 100.0,
            status="PENDING_STAGED_ACTIVATION"
        )
        session.add(ev)
        session.add(sc)
        await session.commit()

    # Execute restart reconciliation
    res = await emergency_priority_service.reconcile_restart_recovery()
    assert res["status"] == "RECONCILED"
    assert res["invalidated_events_count"] >= 1
    assert res["invalidated_schedules_count"] >= 1

    # Verify records in DB are no longer ACTIVE or PENDING
    async with AsyncSessionLocal() as session:
        ev_check = (await session.execute(
            select(EmergencyEventModel).where(EmergencyEventModel.event_id == ev_id)
        )).scalar_one()
        assert ev_check.status == "STALE_RESTART_INVALIDATED"
        assert ev_check.release_reason == "SYSTEM_REBOOT_RECONCILED"

        sc_check = (await session.execute(
            select(CorridorScheduleModel).where(CorridorScheduleModel.schedule_id == sched_id)
        )).scalar_one()
        assert sc_check.status == "STALE_RESTART_INVALIDATED"


def test_multi_seed_benchmark_statistical_validation():
    """
    Stage 3.6.E: Benchmark statistical validation across multi-seed Monte Carlo evaluation.
    Reports mean, median, std dev, throughput, and max queue across seeds.
    """
    bench = adaptive_signal_service.run_baseline_benchmark(
        simulation_seconds=120,
        profile="arterial_corridor_heavy",
        seeds=[42, 101, 777]
    )

    assert "statistical_distributions" in bench
    assert "FIXED_TIME" in bench["statistical_distributions"]
    assert "NEXTRAI_ADAPTIVE" in bench["statistical_distributions"]

    ad_stats = bench["statistical_distributions"]["NEXTRAI_ADAPTIVE"]
    assert "delay_sec" in ad_stats
    assert "mean" in ad_stats["delay_sec"]
    assert "median" in ad_stats["delay_sec"]
    assert "std_dev" in ad_stats["delay_sec"]
    assert "max_queue_vehicles" in ad_stats

    # Fair equalized multi-lane saturation discharge flow verified
    assert bench["methodology_audit"]["status"] == "FAIR_EQUAL_SATURATION_FLOW_VERIFIED"
    assert bench["performance_comparison"]["delay_reduction_vs_fixed_time_pct"] > 0.0


def test_camera_unavailable_safe_fallback_rotation():
    """
    Stage 4.D: When camera telemetry is unavailable, controller must NOT assume zero traffic.
    It activates CAMERA_DATA_UNAVAILABLE_SAFE_FALLBACK and rotates safely based on waiting times.
    """
    ctrl = AdaptiveIntersectionController("TEST_FALLBACK")
    # Ticking with queue_counts=None when cameras are stopped triggers fallback
    dec = ctrl.tick(1.0, queue_counts=None)
    assert "CAMERA_DATA_UNAVAILABLE_SAFE_FALLBACK" in dec["active_constraints"]
    # Controller uses safe nominal queue count (2 veh) rather than zero
    assert dec["queue_counts"]["NORTH"] == 2
    assert dec["queue_counts"]["WEST"] == 2


def test_corridor_connectivity_matrix_reporting():
    """
    Stage 4.F: Corridor coordination service reports multi-intersection connectivity matrix.
    """
    conn = corridor_coordination_service.get_connectivity_matrix()
    assert conn["total_segments"] >= 3
    seg_i1_i2 = next(s for s in conn["segments"] if s["segment_id"] == "SEG_I1_I2_MG_ROAD")
    assert seg_i1_i2["distance_meters"] == 850.0
    assert seg_i1_i2["speed_kmh"] == 40.0
    assert seg_i1_i2["status"] == "ACTIVE_MONITORED"
