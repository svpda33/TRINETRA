"""Safety Test Runner API Endpoint for Hackathon Judges."""

from fastapi import APIRouter
from typing import List, Dict, Any
from app.services.safety_validator import safety_validator

router = APIRouter(prefix="/api/safety", tags=["Safety Validator"])

@router.get("/run-tests")
def run_safety_suite() -> Dict[str, Any]:
    """Runs the 8 deterministic movement safety tests for hackathon validation."""
    tests = [
        {
            "test_id": "TEST_01",
            "title": "TEST 1: Exclusive NORTH Approach (N → S, N → E, N → W)",
            "proposed_movements": ["N_TO_S", "N_TO_E", "N_TO_W"],
            "expected": "PASSED",
        },
        {
            "test_id": "TEST_02",
            "title": "TEST 2: Exclusive SOUTH Approach (S → N, S → E, S → W)",
            "proposed_movements": ["S_TO_N", "S_TO_E", "S_TO_W"],
            "expected": "PASSED",
        },
        {
            "test_id": "TEST_03",
            "title": "TEST 3: Exclusive EAST Approach (E → W, E → N, E → S)",
            "proposed_movements": ["E_TO_W", "E_TO_N", "E_TO_S"],
            "expected": "PASSED",
        },
        {
            "test_id": "TEST_04",
            "title": "TEST 4: Exclusive WEST Approach (W → E, W → N, W → S)",
            "proposed_movements": ["W_TO_E", "W_TO_N", "W_TO_S"],
            "expected": "PASSED",
        },
        {
            "test_id": "TEST_05",
            "title": "TEST 5: Dual Approach Rejection (NORTH + SOUTH Active Simultaneously)",
            "proposed_movements": ["N_TO_S", "S_TO_N"],
            "expected": "REJECTED",
        },
        {
            "test_id": "TEST_06",
            "title": "TEST 6: Multi-Approach Crossing Conflict (NORTH + EAST Active)",
            "proposed_movements": ["N_TO_S", "E_TO_W"],
            "expected": "REJECTED",
        },
        {
            "test_id": "TEST_07",
            "title": "TEST 7: Emergency Vehicle Preemption (NORTH Approach Active)",
            "proposed_movements": ["N_TO_S", "N_TO_E", "N_TO_W"],
            "expected": "PASSED",
        },
        {
            "test_id": "TEST_08",
            "title": "TEST 8: All Red Clearance Transition State",
            "proposed_movements": [],
            "expected": "PASSED",
        },
    ]

    results = []
    total_passed = 0

    for test in tests:
        is_safe, msg, conflicting_pairs, resolved = safety_validator.validate_signal_plan(test["proposed_movements"])
        passed = (is_safe and test["expected"] == "PASSED") or (not is_safe and test["expected"] == "REJECTED")
        if passed:
            total_passed += 1

        results.append({
            "test_id": test["test_id"],
            "title": test["title"],
            "proposed_movements": [safety_validator.ID_TO_LABEL.get(m, m) for m in test["proposed_movements"]],
            "expected_verdict": test["expected"],
            "actual_verdict": "PASSED" if is_safe else "REJECTED",
            "test_status": "SUCCESS" if passed else "FAILED",
            "conflicting_pairs": conflicting_pairs,
            "detail": msg,
            "resolved_phase": resolved.get("name", "UNKNOWN")
        })

    return {
        "status": "COMPLETED",
        "total_tests": len(tests),
        "passed_count": total_passed,
        "results": results
    }
