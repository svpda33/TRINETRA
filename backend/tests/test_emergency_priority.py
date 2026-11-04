"""Unit tests for Stage 3.3 Emergency Vehicle Priority Service."""

import pytest
import time
from app.services.emergency_priority_service import (
    EmergencyPriorityService
)
from app.services.adaptive_signal_service import adaptive_signal_service


def test_temporal_confirmation_prevents_single_frame_false_positives():
    """Verify single frame detection does NOT trigger preemption until confirmed in frame 2."""
    service = EmergencyPriorityService()

    # Frame 1: Single hit -> should await confirmation
    res1 = service.register_emergency_detection(
        camera_id="CAM_I1_WEST",
        track_id=501,
        vehicle_class="AMBULANCE",
        confidence=0.85
    )
    assert res1["is_confirmed"] is False
    assert res1["status"] == "AWAITING_TEMPORAL_CONFIRMATION"
    assert res1["consecutive_hits"] == 1

    # Frame 2: Second consecutive hit -> confirmed and corridor initiated!
    res2 = service.register_emergency_detection(
        camera_id="CAM_I1_WEST",
        track_id=501,
        vehicle_class="AMBULANCE",
        confidence=0.89
    )
    assert res2["is_confirmed"] is True
    assert res2["status"] == "CONFIRMED_PREEMPTION_ACTIVE"
    assert res2["consecutive_hits"] == 2
    assert "corridor_preemption" in res2


def test_corridor_preemption_staged_i1_to_i2():
    """Verify Priority 5: Staged preemption preempts I1 immediately and schedules I2 with 61.5s delay."""
    service = EmergencyPriorityService()

    # Confirm ambulance on CAM_I1_WEST
    service.register_emergency_detection("CAM_I1_WEST", 777, "AMBULANCE", 0.90)
    res = service.register_emergency_detection("CAM_I1_WEST", 777, "AMBULANCE", 0.92)

    status = service.get_preemption_status()
    # Node 1 (I1) is immediately active
    assert "I1" in status["active_preemptions"]
    assert status["active_preemptions"]["I1"]["approach"] == "WEST"

    # Node 2 (I2) is NOT immediately active; it is scheduled staged
    assert "I2" not in status["active_preemptions"]
    assert status["pending_scheduled_preemptions_count"] >= 1
    sched_i2 = next(s for s in status["scheduled_preemptions"] if s["intersection_id"] == "I2")
    assert sched_i2["status"] == "PENDING_STAGED_ACTIVATION"
    assert sched_i2["staged_delay_sec"] == 61.5

    # Simulate arrival time reached for I2 (advance target time)
    sched_i2["target_activation_time"] = time.time() - 1.0
    tick_res = service.check_scheduled_preemptions_and_timeouts()
    assert "I2" in tick_res["activated_nodes"]

    # Now I2 is active as well
    updated_status = service.get_preemption_status()
    assert "I2" in updated_status["active_preemptions"]


def test_upstream_release_cancels_downstream_schedule():
    """Verify if ambulance clears I1 or deviates, downstream staged preemption for I2 is cancelled."""
    service = EmergencyPriorityService()
    service.register_emergency_detection("CAM_I1_WEST", 666, "AMBULANCE", 0.90)
    service.register_emergency_detection("CAM_I1_WEST", 666, "AMBULANCE", 0.92)

    # Release I1 before I2 schedule fires
    rel = service.release_preemption("I1", reason="AMBULANCE_TURNED_NORTH")
    assert len(rel["cancelled_downstream_schedules"]) >= 1

    # Verify no pending scheduled preemptions remain
    status = service.get_preemption_status()
    assert status["pending_scheduled_preemptions_count"] == 0


def test_priority_release_and_recovery():
    """Verify preemption release initiates smooth adaptive recovery."""
    service = EmergencyPriorityService()
    service.register_emergency_detection("CAM_I1_WEST", 888, "FIRE_TRUCK", 0.95)
    service.register_emergency_detection("CAM_I1_WEST", 888, "FIRE_TRUCK", 0.96)

    # Release I1
    rel = service.release_preemption("I1", reason="STOP_LINE_DEPARTED")
    assert rel["status"] == "RELEASED"
    assert rel["release_reason"] == "STOP_LINE_DEPARTED"

    ctrl_i1 = adaptive_signal_service.get_controller("I1")
    assert ctrl_i1.emergency_active is False


def test_safety_timeout_cutoff():
    """Verify preemption exceeding 90s safety limit is automatically released."""
    service = EmergencyPriorityService()
    service.register_emergency_detection("CAM_I1_WEST", 999, "AMBULANCE", 0.95)
    service.register_emergency_detection("CAM_I1_WEST", 999, "AMBULANCE", 0.95)

    # Manually backdate initiated_at to simulate > 90s duration
    service._active_preemptions["I1"]["initiated_at"] = time.time() - 95.0

    expired = service.check_safety_timeouts()
    assert "I1" in expired
    assert "I1" not in service._active_preemptions
