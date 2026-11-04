"""Spatial Geometry Service for NexTrAI (Stage 3.1).

Performs spatial association between tracked vehicle bounding boxes and physical
roadway geometry:
- Normalized anchor point projection (TIRE_CONTACT vs CENTROID).
- Point-in-polygon containment testing.
- Lane assignment and approach queue aggregation.
- Directed stop-line crossing detection using segment intersection and vector normals.
- Event deduplication and approach pressure calculation.
"""

import time
import logging
from typing import Dict, List, Optional, Tuple, Any, Set
from app.models.geometry import (
    NormalizedPoint, NormalizedPolygon, StopLineConfig,
    LaneConfig, CameraGeometryConfig, AnchorStrategy
)
from app.services.geometry_service import GeometryService

logger = logging.getLogger("nextrai.spatial_geometry")


def point_in_polygon(point: NormalizedPoint, polygon: NormalizedPolygon) -> bool:
    """
    Ray-casting algorithm to determine if a normalized 2D point lies inside a cyclic polygon.
    Returns True if inside or on boundary, False otherwise.
    """
    if not polygon or len(polygon.points) < 3:
        return False

    px, py = point.x, point.y
    inside = False
    pts = polygon.points
    n = len(pts)

    j = n - 1
    for i in range(n):
        xi, yi = pts[i].x, pts[i].y
        xj, yj = pts[j].x, pts[j].y

        # Check ray crossing
        if ((yi > py) != (yj > py)):
            denom = yj - yi
            if denom != 0:
                intersect_x = (xj - xi) * (py - yi) / denom + xi
                if px < intersect_x:
                    inside = not inside
        j = i

    return inside


def segments_intersect(p1: NormalizedPoint, p2: NormalizedPoint,
                       q1: NormalizedPoint, q2: NormalizedPoint) -> bool:
    """
    Tests whether line segment p1-p2 intersects line segment q1-q2.
    Uses 2D orientation / cross products.
    """
    def ccw(a: NormalizedPoint, b: NormalizedPoint, c: NormalizedPoint) -> float:
        return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x)

    d1 = ccw(p1, p2, q1)
    d2 = ccw(p1, p2, q2)
    d3 = ccw(q1, q2, p1)
    d4 = ccw(q1, q2, p2)

    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True

    # Collinear / touching segment check
    eps = 1e-6
    if abs(d1) < eps and _on_segment(p1, q1, p2): return True
    if abs(d2) < eps and _on_segment(p1, q2, p2): return True
    if abs(d3) < eps and _on_segment(q1, p1, q2): return True
    if abs(d4) < eps and _on_segment(q1, p2, q2): return True

    return False


def _on_segment(p: NormalizedPoint, q: NormalizedPoint, r: NormalizedPoint) -> bool:
    """Checks if point q lies on line segment p-r."""
    return (q.x <= max(p.x, r.x) and q.x >= min(p.x, r.x) and
            q.y <= max(p.y, r.y) and q.y >= min(p.y, r.y))


class SpatialGeometryService:
    """
    Orchestrates vehicle-to-lane spatial associations, stop-line crossings,
    and real-time queue demand telemetry.
    """

    DEFAULT_LANE_CAPACITY = 8  # Typical visual queue capacity per lane in camera perspective

    def __init__(self, geometry_service: Optional[GeometryService] = None):
        self.geometry_service = geometry_service or GeometryService()
        # Track previous positions for stop line crossing: {camera_id: {track_id: (NormalizedPoint, timestamp)}}
        self._track_history: Dict[str, Dict[int, Tuple[NormalizedPoint, float]]] = {}
        # Crossed tracks cache for deduplication: {camera_id: {(track_id, line_id): timestamp}}
        self._crossing_records: Dict[str, Dict[Tuple[int, str], float]] = {}
        # Cumulative crossings counter: {camera_id: int}
        self._crossing_counts: Dict[str, int] = {}
        # Recent crossing events list per camera
        self._recent_crossings: Dict[str, List[Dict[str, Any]]] = {}

    def compute_anchor_point(self, bbox: List[float], frame_w: int, frame_h: int,
                             strategy: AnchorStrategy = AnchorStrategy.TIRE_CONTACT) -> NormalizedPoint:
        """
        Calculates normalized road-plane contact point from bounding box coordinates.
        TIRE_CONTACT uses bottom-center ((x1+x2)/2, y2).
        CENTROID uses geometric center ((x1+x2)/2, (y1+y2)/2).
        """
        if frame_w <= 0 or frame_h <= 0:
            frame_w, frame_h = 1920, 1080

        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0 / frame_w
        cx_norm = max(0.0, min(1.0, cx))

        if strategy == AnchorStrategy.CENTROID:
            cy = (y1 + y2) / 2.0 / frame_h
        else:
            # TIRE_CONTACT: bottom-edge center
            cy = y2 / frame_h

        cy_norm = max(0.0, min(1.0, cy))
        return NormalizedPoint(x=cx_norm, y=cy_norm)

    def process_frame_spatial_telemetry(self, camera_id: str, tracked_vehicles: List[Dict[str, Any]],
                                       frame_w: int = 1920, frame_h: int = 1080) -> Dict[str, Any]:
        """
        Processes real tracked vehicles through the camera's physical geometry:
        1. Associates each vehicle with approach and specific lane.
        2. Detects directed stop-line crossings.
        3. Computes queue metrics and lane densities.
        """
        cfg = self.geometry_service.get_camera_geometry(camera_id)
        now = time.time()

        if not cfg or not cfg.is_calibrated:
            # Uncalibrated or duplicate camera fallback
            return {
                "camera_id": camera_id,
                "is_calibrated": False,
                "approach_id": cfg.approach.approach_id if cfg and cfg.approach else None,
                "direction": cfg.approach.direction if cfg and cfg.approach else "UNKNOWN",
                "queue_vehicle_count": len(tracked_vehicles),
                "lane_queues": {},
                "lane_densities": {},
                "stop_line_crossings_count": 0,
                "recent_crossings": [],
                "spatial_vehicles": []
            }

        strategy = cfg.anchor_strategy
        if camera_id not in self._track_history:
            self._track_history[camera_id] = {}
        if camera_id not in self._crossing_records:
            self._crossing_records[camera_id] = {}
        if camera_id not in self._crossing_counts:
            self._crossing_counts[camera_id] = 0
        if camera_id not in self._recent_crossings:
            self._recent_crossings[camera_id] = []

        history = self._track_history[camera_id]
        crossing_recs = self._crossing_records[camera_id]

        # Clean old crossing records (> 60s)
        self._crossing_records[camera_id] = {
            k: ts for k, ts in crossing_recs.items() if now - ts < 60.0
        }

        lane_counts: Dict[str, int] = {lane.lane_id: 0 for lane in cfg.lanes}
        queue_count = 0
        spatial_vehicles: List[Dict[str, Any]] = []
        current_active_ids: Set[int] = set()

        for v in tracked_vehicles:
            # Robust track ID resolution: cv_engine emits 'tracker_id', while some components use 'track_id'
            track_id = v.get("tracker_id") if v.get("tracker_id") is not None else v.get("track_id")
            if track_id is None:
                continue

            bbox = v.get("bbox", [0, 0, 0, 0])
            anchor = self.compute_anchor_point(bbox, frame_w, frame_h, strategy)
            current_active_ids.add(track_id)

            # Check queue containment
            in_queue = False
            if cfg.approach and cfg.approach.queue_region:
                in_queue = point_in_polygon(anchor, cfg.approach.queue_region)

            # Check lane containment
            assigned_lane_id: Optional[str] = None
            assigned_lane_type: Optional[str] = None
            for lane in cfg.lanes:
                if lane.polygon and point_in_polygon(anchor, lane.polygon):
                    assigned_lane_id = lane.lane_id
                    assigned_lane_type = lane.lane_type.value
                    lane_counts[lane.lane_id] += 1
                    # If inside a calibrated lane, consider in queue
                    in_queue = True
                    break

            if in_queue:
                queue_count += 1

            # Check stop-line crossing
            if cfg.stop_line and cfg.stop_line.is_calibrated and track_id in history:
                prev_anchor, prev_ts = history[track_id]
                rec_key = (track_id, cfg.stop_line.line_id)

                # Deduplicate: trigger only once per track per line
                if rec_key not in self._crossing_records[camera_id]:
                    p1 = cfg.stop_line.p1
                    p2 = cfg.stop_line.p2
                    if p1 and p2 and segments_intersect(prev_anchor, anchor, p1, p2):
                        # Verify direction vector: (curr - prev) dot normal > 0
                        dx = anchor.x - prev_anchor.x
                        dy = anchor.y - prev_anchor.y
                        normal = cfg.stop_line.normal_vector or [0.0, -1.0]
                        dot_prod = dx * normal[0] + dy * normal[1]

                        if dot_prod > 0.005:  # Authorized forward crossing with positive directional projection
                            self._crossing_records[camera_id][rec_key] = now
                            self._crossing_counts[camera_id] += 1
                            crossing_event = {
                                "track_id": track_id,
                                "class_label": v.get("class_label", "VEHICLE"),
                                "line_id": cfg.stop_line.line_id,
                                "timestamp": now,
                                "speed_est": round(((dx**2 + dy**2)**0.5) / max(0.01, now - prev_ts) * 100, 1),
                                "is_authorized": True
                            }
                            self._recent_crossings[camera_id].append(crossing_event)
                            if len(self._recent_crossings[camera_id]) > 20:
                                self._recent_crossings[camera_id].pop(0)
                            logger.info(f"Stop line crossed: Track {track_id} on {cfg.stop_line.line_id}")

            # Update history for next frame
            history[track_id] = (anchor, now)

            spatial_vehicles.append({
                "track_id": track_id,
                "tracker_id": track_id,
                "class_label": v.get("class_label", "VEHICLE"),
                "confidence": v.get("confidence", 0.0),
                "bbox": bbox,
                "anchor_norm": {"x": round(anchor.x, 4), "y": round(anchor.y, 4)},
                "assigned_lane_id": assigned_lane_id,
                "assigned_lane_type": assigned_lane_type,
                "is_in_queue": in_queue
            })

        # Evict tracks that are no longer active
        self._track_history[camera_id] = {
            tid: val for tid, val in history.items() if tid in current_active_ids
        }

        # Calculate lane densities
        lane_densities = {}
        for lane in cfg.lanes:
            cnt = lane_counts.get(lane.lane_id, 0)
            density = min(100.0, round((cnt / self.DEFAULT_LANE_CAPACITY) * 100.0, 1))
            lane_densities[lane.lane_id] = density

        return {
            "camera_id": camera_id,
            "intersection_id": cfg.intersection_id,
            "is_calibrated": True,
            "approach_id": cfg.approach.approach_id if cfg.approach else None,
            "direction": cfg.approach.direction if cfg.approach else "UNKNOWN",
            "queue_vehicle_count": queue_count,
            "lane_queues": lane_counts,
            "lane_densities": lane_densities,
            "stop_line_crossings_count": self._crossing_counts.get(camera_id, 0),
            "recent_crossings": self._recent_crossings.get(camera_id, [])[-5:],
            "spatial_vehicles": spatial_vehicles,
            "timestamp": now
        }

    def get_intersection_approach_demand(self, intersection_id: str,
                                        camera_telemetries: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregates approach demand across independent cameras for an intersection.
        Stage 4.A & 4.C: Reports observed vehicle counts, queue counts, estimated queue meters,
        lane-level densities, stop-line crossings, and explicit data availability provenance.
        """
        now = time.time()
        approaches: Dict[str, Dict[str, Any]] = {
            "NORTH": {"queue": 0, "estimated_queue_meters": 0.0, "observed_vehicles": 0, "lanes": {}, "lane_densities": {}, "stop_line_crossings": 0, "active_cameras": [], "is_data_available": False, "data_quality": "DATA_UNAVAILABLE"},
            "SOUTH": {"queue": 0, "estimated_queue_meters": 0.0, "observed_vehicles": 0, "lanes": {}, "lane_densities": {}, "stop_line_crossings": 0, "active_cameras": [], "is_data_available": False, "data_quality": "DATA_UNAVAILABLE"},
            "EAST": {"queue": 0, "estimated_queue_meters": 0.0, "observed_vehicles": 0, "lanes": {}, "lane_densities": {}, "stop_line_crossings": 0, "active_cameras": [], "is_data_available": False, "data_quality": "DATA_UNAVAILABLE"},
            "WEST": {"queue": 0, "estimated_queue_meters": 0.0, "observed_vehicles": 0, "lanes": {}, "lane_densities": {}, "stop_line_crossings": 0, "active_cameras": [], "is_data_available": False, "data_quality": "DATA_UNAVAILABLE"}
        }

        independent_cfgs = self.geometry_service.get_independent_cameras(intersection_id)
        independent_cam_ids = {c.camera_id for c in independent_cfgs}

        total_intersection_queue = 0
        total_observed_vehicles = 0
        has_any_live_data = False

        for cam_id, telem in camera_telemetries.items():
            if cam_id not in independent_cam_ids:
                continue

            direction = telem.get("direction", "UNKNOWN").upper()
            if direction in approaches:
                q_count = telem.get("queue_vehicle_count", 0)
                obs_count = len(telem.get("spatial_vehicles", []))
                crossings = telem.get("stop_line_crossings_count", 0)
                lanes = telem.get("lane_queues", {})
                densities = telem.get("lane_densities", {})

                telem_ts = telem.get("timestamp", 0)
                is_fresh = (now - telem_ts) < 30.0 if telem_ts > 0 else False
                has_spatial_data = telem.get("is_calibrated", False) and (is_fresh or obs_count > 0 or len(lanes) > 0)

                approaches[direction]["queue"] += q_count
                approaches[direction]["estimated_queue_meters"] = round(approaches[direction]["queue"] * 6.5, 1)
                approaches[direction]["observed_vehicles"] += obs_count
                approaches[direction]["stop_line_crossings"] += crossings
                approaches[direction]["active_cameras"].append(cam_id)
                approaches[direction]["lanes"].update(lanes)
                approaches[direction]["lane_densities"].update(densities)

                if has_spatial_data:
                    approaches[direction]["is_data_available"] = True
                    approaches[direction]["data_quality"] = "ACTIVE_REPLAY_STREAM" if is_fresh else "CACHED_BATCH"
                    has_any_live_data = True

                total_intersection_queue += q_count
                total_observed_vehicles += obs_count

        return {
            "intersection_id": intersection_id,
            "total_queue": total_intersection_queue,
            "total_observed_vehicles": total_observed_vehicles,
            "total_estimated_queue_meters": round(total_intersection_queue * 6.5, 1),
            "is_data_available": has_any_live_data,
            "data_quality": "ACTIVE_REPLAY_STREAM" if has_any_live_data else "DATA_UNAVAILABLE",
            "approaches": approaches,
            "timestamp": now
        }


# Global singleton instance
spatial_geometry_service = SpatialGeometryService()
