"""Geometry domain schemas & camera calibration configuration for NexTrAI (Stage 3.1).

Defines normalized 2D coordinate spaces, polygonal regions of interest (ROIs),
directional stop lines, lane structures, anchor strategies, and camera source identities.
"""

from enum import Enum
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field, model_validator


class AnchorStrategy(str, Enum):
    """Detection anchor strategy used to map bounding box to ground pavement."""
    TIRE_CONTACT = "TIRE_CONTACT"  # Bottom-center ((x1+x2)/2, y2) on road plane (best for oblique angles)
    CENTROID = "CENTROID"          # Geometric center ((x1+x2)/2, (y1+y2)/2) (best for steep overhead views)


class CalibrationReadiness(str, Enum):
    """Camera geometry calibration readiness level from Task 0 audit."""
    READY = "READY"          # Sufficient visual evidence for full ROI & lane calibration
    PARTIAL = "PARTIAL"      # Partial geometry visible; some components cannot be calibrated
    NOT_READY = "NOT_READY"  # Insufficient visual evidence; out-of-frame geometry
    DUPLICATE = "DUPLICATE"  # Shared/replayed video stream; not an independent camera


class LaneType(str, Enum):
    """Functional traffic movement lane classification."""
    THROUGH = "THROUGH"
    LEFT_TURN = "LEFT_TURN"
    RIGHT_TURN = "RIGHT_TURN"
    U_TURN = "U_TURN"
    SHARED_THROUGH_RIGHT = "SHARED_THROUGH_RIGHT"
    SHARED_THROUGH_LEFT = "SHARED_THROUGH_LEFT"
    TRANSIT_ONLY = "TRANSIT_ONLY"
    EMERGENCY_ONLY = "EMERGENCY_ONLY"


class NormalizedPoint(BaseModel):
    """2D point in normalized image coordinates [0.0, 1.0]."""
    x: float = Field(..., ge=0.0, le=1.0, description="Normalized X coordinate in range [0.0, 1.0]")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalized Y coordinate in range [0.0, 1.0]")

    def to_pixel(self, width: int, height: int) -> Tuple[int, int]:
        """Converts normalized point to integer pixel coordinates given frame dimensions."""
        if width <= 0 or height <= 0:
            raise ValueError(f"Frame dimensions must be positive, got {width}x{height}")
        px = int(round(self.x * (width - 1)))
        py = int(round(self.y * (height - 1)))
        return max(0, min(width - 1, px)), max(0, min(height - 1, py))

    def distance_to(self, other: "NormalizedPoint") -> float:
        """Euclidean distance in normalized coordinate space."""
        return float(((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5)


class NormalizedPolygon(BaseModel):
    """Polygonal region of interest defined by cyclic normalized vertices."""
    points: List[NormalizedPoint] = Field(..., min_length=3, description="List of vertices in cyclic order")

    def to_pixel_polygon(self, width: int, height: int) -> List[Tuple[int, int]]:
        """Converts polygon vertices to pixel coordinates for OpenCV operations."""
        return [p.to_pixel(width, height) for p in self.points]


class CameraSourceIdentity(BaseModel):
    """Physical video source identity, cryptographic hash, and duplication status."""
    video_filename: str
    source_path: str
    md5_checksum: str
    is_live_stream: bool = False
    is_duplicate: bool = False
    duplicate_of_camera_id: Optional[str] = None
    is_independent_observation: bool = True  # Must be False for duplicates to prevent double-counting


class StopLineConfig(BaseModel):
    """Directed stop-line threshold segment at approach mouth."""
    line_id: str
    p1: Optional[NormalizedPoint] = None
    p2: Optional[NormalizedPoint] = None
    normal_vector: Optional[List[float]] = None  # [nx, ny] normalized authorized crossing vector
    tolerance_norm: float = Field(default=0.025, ge=0.001, le=0.10, description="Normalized crossing buffer")
    is_enabled: bool = True
    is_calibrated: bool = False
    approach_id: Optional[str] = None
    associated_movements: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_endpoints_when_calibrated(self) -> "StopLineConfig":
        if self.is_calibrated:
            if self.p1 is None or self.p2 is None:
                raise ValueError("Both p1 and p2 endpoints must be defined when is_calibrated is True")
            if self.p1.x == self.p2.x and self.p1.y == self.p2.y:
                raise ValueError("StopLine endpoints p1 and p2 cannot be coincident")
        return self


class LaneConfig(BaseModel):
    """Individual approach lane configuration supporting single or shared movements."""
    lane_id: str
    lane_number: int = Field(..., ge=1, description="1-indexed lane from leftmost curb in LHT")
    lane_type: LaneType = LaneType.THROUGH
    permitted_movements: List[str] = Field(..., min_length=1, description="List of permitted movements, e.g. ['W_TO_E', 'W_TO_S']")
    polygon: Optional[NormalizedPolygon] = None
    is_calibrated: bool = False


class ApproachConfig(BaseModel):
    """Intersection approach leg configuration."""
    approach_id: str
    intersection_id: str
    direction: str  # NORTH, SOUTH, EAST, WEST
    queue_region: Optional[NormalizedPolygon] = None
    associated_lane_ids: List[str] = Field(default_factory=list)
    stop_line_id: Optional[str] = None
    permitted_movements: List[str] = Field(default_factory=list)
    is_calibrated: bool = False


class CameraGeometryConfig(BaseModel):
    """Complete declarative geometry configuration for a single camera view."""
    camera_id: str
    intersection_id: str
    schema_version: str = "1.0.0"
    source_identity: CameraSourceIdentity
    reference_resolution: List[int] = Field(..., min_length=2, max_length=2, description="[width, height]")
    coordinate_system: str = "NORMALIZED_IMAGE_COORDINATES_0_TO_1"
    anchor_strategy: AnchorStrategy = AnchorStrategy.TIRE_CONTACT
    readiness_status: CalibrationReadiness = CalibrationReadiness.NOT_READY
    is_calibrated: bool = False
    approach: Optional[ApproachConfig] = None
    lanes: List[LaneConfig] = Field(default_factory=list)
    stop_line: Optional[StopLineConfig] = None
    conflict_zone: Optional[NormalizedPolygon] = None
    departure_zone: Optional[NormalizedPolygon] = None
    notes: str = ""
