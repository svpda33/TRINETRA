"""Unit tests for Stage 3.4 Corridor Coordination & City-Wide Progression Service."""

import pytest
from app.services.corridor_coordination_service import CorridorCoordinationService


def test_green_wave_offset_calculation():
    """Verify deterministic green-wave travel time and progression offset."""
    service = CorridorCoordinationService()
    res = service.calculate_green_wave_offset(corridor_speed_kmh=40.0)

    assert res["distance_meters"] == 850.0
    assert res["corridor_speed_kmh"] == 40.0
    assert res["corridor_travel_time_sec"] == 76.5
    assert res["ideal_green_wave_offset_sec"] == 76.5
    assert res["platoon_arrival_window"]["start_sec"] == 70.5
    assert res["platoon_arrival_window"]["end_sec"] == 88.5
    assert res["calculation_method"] == "DETERMINISTIC_PROGRESSION_EQUATION"


def test_custom_speed_offset_calculation():
    """Verify offset updates accurately with faster arterial speed."""
    service = CorridorCoordinationService()
    # 51 km/h = 14.167 m/s -> 850 / 14.167 = 60.0s -> offset = 60.0s
    res = service.calculate_green_wave_offset(corridor_speed_kmh=51.0)
    assert round(res["corridor_travel_time_sec"], 0) == 60.0
    assert round(res["ideal_green_wave_offset_sec"], 0) == 60.0


def test_network_congestion_heatmap_structure():
    """Verify congestion heatmap aggregates all 7 independent cameras with data provenance."""
    service = CorridorCoordinationService()
    heatmap = service.get_network_congestion_heatmap()

    assert heatmap["source_type"] == "RECORDED_CCTV_REPLAY"
    assert heatmap["is_simulation"] is False
    assert heatmap["total_independent_cameras"] == 7
    assert 0.0 <= heatmap["network_congestion_index_pct"] <= 100.0
    assert heatmap["spillback_risk"] in ["LOW", "MODERATE", "HIGH"]
    assert "corridor_status" in heatmap
    assert len(heatmap["per_camera_metrics"]) == 7
