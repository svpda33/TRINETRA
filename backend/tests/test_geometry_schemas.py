"""Unit tests for Stage 3.1 Task 1: Geometry Domain Schemas and Declarative Configuration."""

import pytest
from pydantic import ValidationError
from app.models.geometry import (
    NormalizedPoint,
    NormalizedPolygon,
    AnchorStrategy,
    CalibrationReadiness,
    LaneType,
    LaneConfig,
    StopLineConfig,
    ApproachConfig,
    CameraSourceIdentity,
    CameraGeometryConfig
)
from app.services.geometry_service import geometry_service


def test_normalized_point_range_validation():
    """Verify NormalizedPoint enforces [0.0, 1.0] bounds."""
    # Valid points
    p_valid = NormalizedPoint(x=0.0, y=1.0)
    assert p_valid.x == 0.0 and p_valid.y == 1.0

    p_mid = NormalizedPoint(x=0.5, y=0.5)
    assert p_mid.x == 0.5 and p_mid.y == 0.5

    # Out-of-bounds X
    with pytest.raises(ValidationError):
        NormalizedPoint(x=-0.01, y=0.5)

    with pytest.raises(ValidationError):
        NormalizedPoint(x=1.01, y=0.5)

    # Out-of-bounds Y
    with pytest.raises(ValidationError):
        NormalizedPoint(x=0.5, y=-0.01)

    with pytest.raises(ValidationError):
        NormalizedPoint(x=0.5, y=1.01)


def test_normalized_point_pixel_conversion():
    """Verify resolution-aware pixel coordinate conversion."""
    p = NormalizedPoint(x=0.5, y=0.5)
    # On 1920x1080
    px, py = p.to_pixel(1920, 1080)
    assert 950 <= px <= 965
    assert 535 <= py <= 545

    # On 768x432
    px, py = p.to_pixel(768, 432)
    assert 380 <= px <= 385
    assert 210 <= py <= 220

    # Invalid non-positive dimensions
    with pytest.raises(ValueError):
        p.to_pixel(0, 1080)


def test_normalized_polygon_validation():
    """Verify NormalizedPolygon requires at least 3 points."""
    pts = [
        NormalizedPoint(x=0.1, y=0.1),
        NormalizedPoint(x=0.9, y=0.1),
        NormalizedPoint(x=0.9, y=0.9)
    ]
    poly = NormalizedPolygon(points=pts)
    assert len(poly.points) == 3

    # Reject fewer than 3 points
    with pytest.raises(ValidationError):
        NormalizedPolygon(points=[NormalizedPoint(x=0.1, y=0.1), NormalizedPoint(x=0.9, y=0.9)])


def test_stop_line_endpoint_validation():
    """Verify StopLineConfig rejects coincident endpoints when calibrated."""
    p1 = NormalizedPoint(x=0.2, y=0.7)
    p2 = NormalizedPoint(x=0.8, y=0.7)

    # Valid calibrated stop line
    sl_valid = StopLineConfig(
        line_id="SL_TEST",
        p1=p1,
        p2=p2,
        is_calibrated=True
    )
    assert sl_valid.is_calibrated is True

    # Coincident endpoints when calibrated must fail
    with pytest.raises(ValueError, match="endpoints p1 and p2 cannot be coincident"):
        StopLineConfig(
            line_id="SL_FAIL",
            p1=p1,
            p2=NormalizedPoint(x=0.2, y=0.7),
            is_calibrated=True
        )

    # Uncalibrated stop line with None points is allowed
    sl_uncalibrated = StopLineConfig(
        line_id="SL_PENDING",
        p1=None,
        p2=None,
        is_calibrated=False
    )
    assert sl_uncalibrated.is_calibrated is False


def test_lane_multi_movement_support():
    """Verify LaneConfig supports shared movements (Through + Right Turn)."""
    lane = LaneConfig(
        lane_id="LANE_TEST_SHARED",
        lane_number=3,
        lane_type=LaneType.SHARED_THROUGH_RIGHT,
        permitted_movements=["W_TO_E", "W_TO_S"]
    )
    assert len(lane.permitted_movements) == 2
    assert "W_TO_E" in lane.permitted_movements
    assert "W_TO_S" in lane.permitted_movements


def test_anchor_strategy_configurable():
    """Verify TIRE_CONTACT and CENTROID anchor strategies."""
    cfg_tire = CameraGeometryConfig(
        camera_id="CAM_TEST_TIRE",
        intersection_id="I1",
        source_identity=CameraSourceIdentity(
            video_filename="test.mp4",
            source_path="/test.mp4",
            md5_checksum="1234"
        ),
        reference_resolution=[1920, 1080],
        anchor_strategy=AnchorStrategy.TIRE_CONTACT
    )
    assert cfg_tire.anchor_strategy == AnchorStrategy.TIRE_CONTACT

    cfg_centroid = CameraGeometryConfig(
        camera_id="CAM_TEST_CENTROID",
        intersection_id="I1",
        source_identity=CameraSourceIdentity(
            video_filename="test.mp4",
            source_path="/test.mp4",
            md5_checksum="1234"
        ),
        reference_resolution=[768, 432],
        anchor_strategy=AnchorStrategy.CENTROID
    )
    assert cfg_centroid.anchor_strategy == AnchorStrategy.CENTROID


def test_declarative_configs_loaded_and_duplicates_excluded():
    """Verify geometry_service loads all 8 cameras and excludes duplicate CAM_I2_WEST from independent count."""
    geometries = geometry_service.get_all_geometries()
    assert len(geometries) == 8, f"Expected 8 camera configurations, got {len(geometries)}"

    # Check CAM_I1_WEST
    cam_west = geometry_service.get_camera_geometry("CAM_I1_WEST")
    assert cam_west is not None
    assert cam_west.readiness_status == CalibrationReadiness.READY
    assert cam_west.is_calibrated is True
    assert len(cam_west.lanes) == 3

    # Check duplicate CAM_I2_WEST
    cam_i2_w = geometry_service.get_camera_geometry("CAM_I2_WEST")
    assert cam_i2_w is not None
    assert cam_i2_w.source_identity.is_duplicate is True
    assert cam_i2_w.source_identity.duplicate_of_camera_id == "CAM_I1_NORTH"
    assert cam_i2_w.source_identity.is_independent_observation is False
    assert cam_i2_w.readiness_status == CalibrationReadiness.DUPLICATE

    # Verify independent camera count is exactly 7 (excluding duplicate CAM_I2_WEST)
    independent_cams = geometry_service.get_independent_cameras()
    assert len(independent_cams) == 7
    assert not any(c.camera_id == "CAM_I2_WEST" for c in independent_cams)

    # Check intersection breakdown: I1 has 4 independent cameras, I2 has 3 independent cameras
    i1_cams = geometry_service.get_independent_cameras(intersection_id="I1")
    i2_cams = geometry_service.get_independent_cameras(intersection_id="I2")
    assert len(i1_cams) == 4
    assert len(i2_cams) == 3


def test_calibration_readiness_summary():
    """Verify aggregate summary matches Stage 3.1 calibrations."""
    summary = geometry_service.get_calibration_summary()
    assert summary["total_cameras"] == 8
    assert summary["independent_cameras"] == 7
    assert summary["by_readiness"]["READY"] == 7       # All 7 independent cameras calibrated
    assert summary["by_readiness"]["DUPLICATE"] == 1   # CAM_I2_WEST
    assert summary["calibrated_count"] == 7            # All 7 independent configurations calibrated
