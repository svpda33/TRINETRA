"""Unit tests for Stage 3.1 Spatial Geometry Service."""

import pytest
from app.models.geometry import NormalizedPoint, NormalizedPolygon, AnchorStrategy
from app.services.spatial_geometry_service import (
    point_in_polygon, segments_intersect, SpatialGeometryService
)
from app.services.geometry_service import GeometryService


def test_point_in_polygon():
    # Square from (0.2, 0.2) to (0.6, 0.6)
    poly = NormalizedPolygon(points=[
        NormalizedPoint(x=0.2, y=0.2),
        NormalizedPoint(x=0.6, y=0.2),
        NormalizedPoint(x=0.6, y=0.6),
        NormalizedPoint(x=0.2, y=0.6)
    ])

    inside_pt = NormalizedPoint(x=0.4, y=0.4)
    outside_pt = NormalizedPoint(x=0.8, y=0.8)
    outside_left = NormalizedPoint(x=0.1, y=0.4)

    assert point_in_polygon(inside_pt, poly) is True
    assert point_in_polygon(outside_pt, poly) is False
    assert point_in_polygon(outside_left, poly) is False


def test_segments_intersect():
    # Horizontal line from (0.2, 0.5) to (0.8, 0.5)
    s1 = NormalizedPoint(x=0.2, y=0.5)
    s2 = NormalizedPoint(x=0.8, y=0.5)

    # Vertical line crossing from (0.5, 0.3) to (0.5, 0.7)
    v1 = NormalizedPoint(x=0.5, y=0.3)
    v2 = NormalizedPoint(x=0.5, y=0.7)

    # Non-crossing line from (0.5, 0.1) to (0.5, 0.3)
    nc1 = NormalizedPoint(x=0.5, y=0.1)
    nc2 = NormalizedPoint(x=0.5, y=0.3)

    assert segments_intersect(s1, s2, v1, v2) is True
    assert segments_intersect(s1, s2, nc1, nc2) is False


def test_anchor_point_calculation():
    service = SpatialGeometryService()
    # Box: x1=400, y1=200, x2=600, y2=500 in 1000x1000 image
    bbox = [400, 200, 600, 500]

    tire_anchor = service.compute_anchor_point(bbox, 1000, 1000, AnchorStrategy.TIRE_CONTACT)
    assert round(tire_anchor.x, 3) == 0.500
    assert round(tire_anchor.y, 3) == 0.500  # y2 / 1000

    centroid_anchor = service.compute_anchor_point(bbox, 1000, 1000, AnchorStrategy.CENTROID)
    assert round(centroid_anchor.x, 3) == 0.500
    assert round(centroid_anchor.y, 3) == 0.350  # (200+500)/2 / 1000 = 0.350


def test_lane_association_and_queue_metrics():
    service = SpatialGeometryService()
    # Vehicle in Middle Lane of CAM_I1_WEST (cx around 0.53, y2 around 0.70)
    # 1920x1080: cx=0.53 -> x1=960, x2=1080; y2=0.70 -> y2=756
    vehicles = [
        {
            "track_id": 101,
            "class_label": "CAR",
            "confidence": 0.88,
            "bbox": [960, 650, 1080, 756]
        },
        {
            "track_id": 102,
            "class_label": "AUTO_RICKSHAW",
            "confidence": 0.75,
            "bbox": [400, 650, 550, 756]  # cx around 475/1920 ~ 0.247 (Left Lane)
        }
    ]

    telem = service.process_frame_spatial_telemetry("CAM_I1_WEST", vehicles, 1920, 1080)
    assert telem["is_calibrated"] is True
    assert telem["queue_vehicle_count"] == 2
    assert telem["lane_queues"]["LANE_I1_WEST_1"] == 1  # Left Lane
    assert telem["lane_queues"]["LANE_I1_WEST_2"] == 1  # Middle Lane
    assert telem["lane_queues"]["LANE_I1_WEST_3"] == 0  # Right Lane


def test_stop_line_crossing_and_deduplication():
    service = SpatialGeometryService()

    # Frame 1: Vehicle approaching stop line from bottom of image (y2 = 0.60 * 1080 = 648)
    # Using 'tracker_id' as emitted by cv_engine
    frame1_vehicles = [
        {"tracker_id": 201, "class_label": "CAR", "confidence": 0.90, "bbox": [900, 550, 1000, 648]}
    ]
    t1 = service.process_frame_spatial_telemetry("CAM_I1_WEST", frame1_vehicles, 1920, 1080)
    assert t1["stop_line_crossings_count"] == 0

    # Frame 2: Vehicle crosses stop line upward at y=0.52 (y2 = 0.45 * 1080 = 486, dy = -0.15)
    # Forward direction along normal [0.0, -1.0] -> dot_prod = -0.15 * -1.0 = +0.15 > 0.005
    frame2_vehicles = [
        {"tracker_id": 201, "class_label": "CAR", "confidence": 0.90, "bbox": [900, 390, 1000, 486]}
    ]
    t2 = service.process_frame_spatial_telemetry("CAM_I1_WEST", frame2_vehicles, 1920, 1080)
    assert t2["stop_line_crossings_count"] == 1
    assert len(t2["recent_crossings"]) == 1
    assert t2["recent_crossings"][0]["track_id"] == 201

    # Frame 3: Same vehicle continues forward (y2 = 0.35 * 1080 = 378) -> should NOT duplicate crossing
    frame3_vehicles = [
        {"tracker_id": 201, "class_label": "CAR", "confidence": 0.90, "bbox": [900, 280, 1000, 378]}
    ]
    t3 = service.process_frame_spatial_telemetry("CAM_I1_WEST", frame3_vehicles, 1920, 1080)
    assert t3["stop_line_crossings_count"] == 1  # Deduplicated!


def test_stop_line_rejects_reverse_and_parallel_crossing():
    service = SpatialGeometryService()

    # Reverse direction: Vehicle moving downwards (from y=0.45 to y=0.60)
    rev_f1 = [
        {"track_id": 301, "class_label": "CAR", "confidence": 0.90, "bbox": [900, 390, 1000, 486]}
    ]
    service.process_frame_spatial_telemetry("CAM_I1_WEST", rev_f1, 1920, 1080)

    rev_f2 = [
        {"track_id": 301, "class_label": "CAR", "confidence": 0.90, "bbox": [900, 550, 1000, 648]}
    ]
    t_rev = service.process_frame_spatial_telemetry("CAM_I1_WEST", rev_f2, 1920, 1080)
    assert t_rev["stop_line_crossings_count"] == 0, "Reverse motion must be rejected by normal vector"


def test_intersection_approach_demand_aggregation():
    service = SpatialGeometryService()
    camera_telemetries = {
        "CAM_I1_WEST": {
            "direction": "WEST",
            "queue_vehicle_count": 6,
            "lane_queues": {"LANE_I1_WEST_1": 2, "LANE_I1_WEST_2": 2, "LANE_I1_WEST_3": 2}
        },
        "CAM_I1_EAST": {
            "direction": "EAST",
            "queue_vehicle_count": 8,
            "lane_queues": {"LANE_I1_EAST_1": 4, "LANE_I1_EAST_2": 4}
        },
        "CAM_I2_WEST": {
            # Duplicate camera; should be ignored in independent counts
            "direction": "WEST",
            "queue_vehicle_count": 99,
            "lane_queues": {}
        }
    }

    demand = service.get_intersection_approach_demand("I1", camera_telemetries)
    assert demand["intersection_id"] == "I1"
    assert demand["approaches"]["WEST"]["queue"] == 6
    assert demand["approaches"]["EAST"]["queue"] == 8
    assert demand["total_queue"] == 14  # Excluded CAM_I2_WEST!
