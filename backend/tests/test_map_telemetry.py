"""Automated Test Suite for Interactive Hyderabad Traffic Map Telemetry.

Verifies:
1. Exact GPS coordinates for all 4 IT corridor junctions (I1 to I4).
2. All 8 cameras mapped with valid approach directions (NORTH, SOUTH, EAST, WEST).
3. CCTV Provenance: All feeds are declared as RECORDED_CCTV_REPLAY (never claimed as live CCTV).
4. Corridor links metadata: 850m active monitored MG Road link, 1400m and 2600m planned extensions.
5. Unified map telemetry endpoint response structure and fields.
"""

import pytest
import asyncio
from app.services.gis_engine import gis_engine
from app.api.gis import get_map_telemetry

def test_corridor_junction_coordinates():
    """Verify accurate WGS84 GPS coordinates for all 4 corridor intersections."""
    junctions = gis_engine.JUNCTIONS
    assert len(junctions) == 4

    # I1: Cyber Towers Junction
    assert junctions["I1"]["latitude"] == 17.4504
    assert junctions["I1"]["longitude"] == 78.3808
    assert "Cyber Towers" in junctions["I1"]["name"]

    # I2: Hitec City / Mindspace Junction
    assert junctions["I2"]["latitude"] == 17.4428
    assert junctions["I2"]["longitude"] == 78.3813

    # I3: Bio-Diversity Junction
    assert junctions["I3"]["latitude"] == 17.4325
    assert junctions["I3"]["longitude"] == 78.3728

    # I4: Gachibowli Junction
    assert junctions["I4"]["latitude"] == 17.4401
    assert junctions["I4"]["longitude"] == 78.3489

def test_camera_metadata_and_provenance():
    """
    Verify 8 camera approach directions and strict provenance declaration.
    CRITICAL TRANSPARENCY RULE: All camera feeds must be declared RECORDED_CCTV_REPLAY.
    """
    cameras = gis_engine.get_camera_nodes()
    assert len(cameras) == 8

    camera_ids = [c["camera_id"] for c in cameras]
    expected_ids = [
        "CAM_I1_NORTH", "CAM_I1_SOUTH", "CAM_I1_EAST", "CAM_I1_WEST",
        "CAM_I2_NORTH", "CAM_I2_SOUTH", "CAM_I2_EAST", "CAM_I2_WEST"
    ]
    for cid in expected_ids:
        assert cid in camera_ids

    # Verify provenance transparency and approximate offset disclosure
    for cam in cameras:
        assert cam["source_type"] == "RECORDED_CCTV_REPLAY"
        assert cam["source_provenance"] == "RECORDED_CCTV_REPLAY"
        assert cam["telemetry_status"] == "ACTIVE_REPLAY_STREAM"
        assert "LIVE_OBSERVED" not in str(cam.values())
        assert cam["location_confidence"] == "APPROXIMATE_APPROACH_OFFSET"
        assert cam["gps_verified"] is False
        assert cam["status"] == "ONLINE"
        assert cam["video_file"].endswith(".mp4")

def test_corridor_distances_and_topology():
    """Verify calibrated road distances along the corridor."""
    i1_to_i2 = gis_engine.get_corridor_distance("I1", "I2")
    assert i1_to_i2 == 850.0

    i2_to_i3 = gis_engine.get_corridor_distance("I2", "I3")
    assert i2_to_i3 == 1400.0

    i3_to_i4 = gis_engine.get_corridor_distance("I3", "I4")
    assert i3_to_i4 == 2600.0

    total_corridor = gis_engine.get_corridor_total_length_meters()
    assert total_corridor == 4850.0

def test_map_telemetry_endpoint_payload():
    """Verify unified telemetry endpoint returns all required sections and live values."""
    payload = asyncio.run(get_map_telemetry())
    assert payload["status"] == "success"
    assert "intersections" in payload
    assert "cameras" in payload
    assert "corridors" in payload

    # 4 Intersections
    intersections = payload["intersections"]
    assert len(intersections) == 4
    for item in intersections:
        assert "intersection_id" in item
        assert "phase_state" in item
        assert "active_approach" in item
        assert "remaining_seconds" in item
        assert "queues" in item
        assert "total_vehicles" in item
        assert "congestion_rating" in item

    # 8 Cameras
    cameras = payload["cameras"]
    assert len(cameras) == 8
    for cam in cameras:
        assert "current_approach_queue" in cam
        assert "is_active_approach" in cam
        assert cam["source_provenance"] == "RECORDED_CCTV_REPLAY"

    # Corridors
    corridors = payload["corridors"]
    assert len(corridors) == 3
    active_monitored = [c for c in corridors if c["status"] == "ACTIVE_MONITORED"]
    assert len(active_monitored) == 1
    assert active_monitored[0]["corridor_id"] == "CORR_I1_I2"
    assert active_monitored[0]["green_wave_active"] is True
