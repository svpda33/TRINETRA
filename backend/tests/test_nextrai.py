"""Comprehensive Unit and Verification Tests for NexTrAI Urban Traffic Intelligence Platform."""

import pytest
from app.services.safety_validator import safety_validator
from app.services.plate_validator import PlateValidator
from app.services.gis_engine import GISEngine
from app.services.watchlist_service import watchlist_service

def test_safety_validator_exclusive_approaches():
    """Verify exclusive approaches pass without conflicts."""
    for movements in [
        ["N_TO_S", "N_TO_E", "N_TO_W"],
        ["S_TO_N", "S_TO_E", "S_TO_W"],
        ["E_TO_W", "E_TO_N", "E_TO_S"],
        ["W_TO_E", "W_TO_N", "W_TO_S"],
    ]:
        is_safe, msg, conflicts, resolved = safety_validator.validate_signal_plan(movements)
        assert is_safe is True
        assert len(conflicts) == 0

def test_safety_validator_conflicting_movements():
    """Verify simultaneous opposing/crossing approaches are rejected."""
    # North + South crossing conflict
    is_safe, msg, conflicts, resolved = safety_validator.validate_signal_plan(["N_TO_S", "S_TO_N"])
    assert is_safe is False
    assert len(conflicts) > 0

    # North + East crossing conflict
    is_safe, msg, conflicts, resolved = safety_validator.validate_signal_plan(["N_TO_S", "E_TO_W"])
    assert is_safe is False
    assert len(conflicts) > 0

def test_safety_validator_all_red():
    """Verify all-red transition clearance state is valid."""
    is_safe, msg, conflicts, resolved = safety_validator.validate_signal_plan([])
    assert is_safe is True
    assert "CLEARANCE" in resolved["name"].upper()

def test_hsrp_plate_validation():
    """Verify MoRTH HSRP standard plate patterns."""
    valid_plates = [
        "TS09EA1234",
        "DL01AB9999",
        "MH12DE1432",
        "KA03MM5678",
        "AP28BK4321",
        "UP32AB0001",
    ]
    for plate in valid_plates:
        res = PlateValidator.validate(plate)
        assert res["is_valid"] is True, f"Failed for {plate}"
        assert res["plate_type"] == "STANDARD_HSRP"

def test_bharat_series_validation():
    """Verify Bharat Series (BH) plate validation."""
    bh_plates = [
        "22BH1234AA",
        "23BH9876B",
        "24BH0001Z",
    ]
    for plate in bh_plates:
        res = PlateValidator.validate(plate)
        assert res["is_valid"] is True, f"Failed for BH plate {plate}"
        assert res["plate_type"] == "BH_SERIES"

def test_character_ambiguity_corrections():
    """Verify optical character ambiguity corrector."""
    # 'TSO9' where O should be 0
    res = PlateValidator.correct_ambiguities("TSO9EA1234")
    assert res == "TS09EA1234"

    # 'TS09EA123O' where trailing O should be 0
    res = PlateValidator.correct_ambiguities("TS09EA123O")
    assert res == "TS09EA1230"

def test_gis_corridor_topology():
    """Verify Hyderabad Smart Corridor nodes and road distances."""
    junctions = GISEngine.get_all_junctions()
    assert len(junctions) == 4
    j_ids = [j["intersection_id"] for j in junctions]
    assert j_ids == ["I1", "I2", "I3", "I4"]

    # Cyber Towers to Mindspace distance
    dist = GISEngine.get_road_distance("I1", "I2")
    assert dist == 850.0

    # Total corridor distance Cyber Towers to Gachibowli
    total_dist = GISEngine.get_corridor_total_length_meters()
    assert total_dist == 4850.0

def test_watchlist_service():
    """Verify O(1) watchlist caching and lookup."""
    # Seeded vehicle TS09EA1234 is on watchlist
    match = watchlist_service.check_watchlist("TS09EA1234")
    assert match is not None
    assert match["severity"] == "CRITICAL"
    assert "STOLEN" in match["notes"].upper()

    # Clean plate
    clean_match = watchlist_service.check_watchlist("TS07XY9999")
    assert clean_match is None

def test_cv_engine_iou_and_tracking():
    """Verify CV Engine IoU calculation, track persistence, and flicker suppression."""
    from app.services.cv_engine import compute_iou, IoUMultiObjectTracker, cv_engine
    
    # 1. IoU calculation
    boxA = [100, 100, 200, 200]
    boxB = [100, 100, 200, 200]
    assert compute_iou(boxA, boxB) == 1.0

    boxC = [150, 100, 250, 200]
    iou = compute_iou(boxA, boxC)
    assert 0.30 < iou < 0.40

    boxD = [300, 300, 400, 400]
    assert compute_iou(boxA, boxD) == 0.0

    # 2. IoUMultiObjectTracker lifecycle and min_hits confirmation
    tracker = IoUMultiObjectTracker(min_hits=2, start_id=200)

    # Frame 1: Tentative low-confidence detection should be suppressed
    f1_dets = [
        {"bbox": [100, 100, 200, 200], "class_label": "CAR", "confidence": 0.38},
        {"bbox": [500, 500, 600, 600], "class_label": "BUS", "confidence": 0.85}
    ]
    t1 = tracker.update(f1_dets)
    # The high confidence BUS should immediately appear, low conf CAR suppressed on hits=1
    assert any(t["class_label"] == "BUS" for t in t1)
    assert not any(t["class_label"] == "CAR" for t in t1)

    # Frame 2: When CAR is detected again (hits=2), it becomes confirmed
    f2_dets = [
        {"bbox": [102, 102, 202, 202], "class_label": "CAR", "confidence": 0.42},
        {"bbox": [505, 505, 605, 605], "class_label": "BUS", "confidence": 0.88}
    ]
    t2 = tracker.update(f2_dets)
    assert any(t["class_label"] == "CAR" for t in t2)
    assert any(t["class_label"] == "BUS" for t in t2)

    # Persistent IDs should be maintained
    car_track = next(t for t in t2 if t["class_label"] == "CAR")
    bus_track = next(t for t in t2 if t["class_label"] == "BUS")
    assert car_track["hits"] == 2
    assert bus_track["hits"] == 2
