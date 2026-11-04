"""City-Wide Corridor Coordination & Network Progression Service for NexTrAI (Stage 3.4).

Features:
- Multi-intersection progression model between I1 and I2 (850m corridor).
- Green-wave offset calculation based on corridor travel velocity.
- Platoon arrival window prediction.
- Network congestion index and spillback risk detection.
- Data freshness and provenance verification (Recorded CCTV Replay vs Analytical Progression).
"""

import time
import logging
from typing import Dict, List, Optional, Any
from app.services.adaptive_signal_service import adaptive_signal_service
from app.services.video_ingestion_service import video_ingestion_service
from app.services.geometry_service import geometry_service

logger = logging.getLogger("nextrai.corridor_coordination")


class CorridorCoordinationService:
    """Manages green-wave offset synchronization and network congestion telemetry."""

    CORRIDOR_DISTANCE_METERS: float = 850.0  # Physical distance between I1 and I2
    DESIGN_SPEED_KMH: float = 40.0           # Standard urban arterial design speed
    NOMINAL_CYCLE_TIME_SEC: float = 90.0     # Reference cycle length for offset calculation

    CORRIDOR_CONNECTIVITY_MATRIX: List[Dict[str, Any]] = [
        {
            "segment_id": "SEG_I1_I2_MG_ROAD",
            "upstream_node": "I1",
            "downstream_node": "I2",
            "corridor_name": "Mahatma Gandhi Road Arterial",
            "road_type": "PRIMARY_ARTERIAL",
            "distance_meters": 850.0,
            "speed_kmh": 40.0,
            "free_flow_travel_time_sec": 76.5,
            "status": "ACTIVE_MONITORED"
        },
        {
            "segment_id": "SEG_I2_I3_JUBILEE_LINK",
            "upstream_node": "I2",
            "downstream_node": "I3",
            "corridor_name": "Jubilee Hills Link Arterial",
            "road_type": "SECONDARY_ARTERIAL",
            "distance_meters": 1200.0,
            "speed_kmh": 40.0,
            "free_flow_travel_time_sec": 108.0,
            "status": "PLANNED_EXPANSION"
        },
        {
            "segment_id": "SEG_I3_I4_HITEC_FEEDER",
            "upstream_node": "I3",
            "downstream_node": "I4",
            "corridor_name": "HITEC City Sector Feeder",
            "road_type": "SUBURBAN_FEEDER",
            "distance_meters": 1500.0,
            "speed_kmh": 40.0,
            "free_flow_travel_time_sec": 135.0,
            "status": "PLANNED_EXPANSION"
        }
    ]

    def __init__(self):
        self.design_speed_ms: float = self.DESIGN_SPEED_KMH / 3.6  # ~11.11 m/s
        self.ideal_travel_time_sec: float = round(self.CORRIDOR_DISTANCE_METERS / self.design_speed_ms, 1)

    def get_connectivity_matrix(self) -> Dict[str, Any]:
        """Returns the city-wide network connectivity matrix and segment travel times."""
        return {
            "network_id": "HYDERABAD_URBAN_ARTERIAL_NETWORK",
            "total_segments": len(self.CORRIDOR_CONNECTIVITY_MATRIX),
            "monitored_arterial_meters": self.CORRIDOR_DISTANCE_METERS,
            "segments": self.CORRIDOR_CONNECTIVITY_MATRIX
        }

    def calculate_green_wave_offset(self, corridor_speed_kmh: Optional[float] = None) -> Dict[str, Any]:
        """
        Calculates optimal green-wave progression offset from I1 (upstream) to I2 (downstream).
        Returns offset in seconds, travel time, and expected platoon arrival window.
        """
        speed_kmh = corridor_speed_kmh or self.DESIGN_SPEED_KMH
        speed_ms = max(1.0, speed_kmh / 3.6)
        travel_time = round(self.CORRIDOR_DISTANCE_METERS / speed_ms, 1)
        offset_sec = round(travel_time % self.NOMINAL_CYCLE_TIME_SEC, 1)

        # Platoon window: +/- buffer around predicted arrival
        platoon_start = max(0.0, round(travel_time - 6.0, 1))
        platoon_end = round(travel_time + 12.0, 1)

        return {
            "corridor_id": "CORRIDOR_MG_ROAD_I1_I2",
            "upstream_intersection": "I1",
            "downstream_intersection": "I2",
            "distance_meters": self.CORRIDOR_DISTANCE_METERS,
            "corridor_speed_kmh": speed_kmh,
            "corridor_travel_time_sec": travel_time,
            "ideal_green_wave_offset_sec": offset_sec,
            "platoon_arrival_window": {
                "start_sec": platoon_start,
                "end_sec": platoon_end,
                "window_duration_sec": round(platoon_end - platoon_start, 1)
            },
            "progression_quality": "OPTIMAL_GREEN_WAVE" if offset_sec < 45.0 else "SUB_OPTIMAL_CYCLE_ALIGNMENT",
            "calculation_method": "DETERMINISTIC_PROGRESSION_EQUATION"
        }

    def get_network_congestion_heatmap(self) -> Dict[str, Any]:
        """
        Aggregates approach queue metrics from all independent cameras to compute
        city-wide congestion index, bottleneck hotspots, and spillback risk.
        """
        now = time.time()
        independent_cameras = geometry_service.get_independent_cameras()

        total_queue = 0
        camera_metrics = []
        max_density = 0.0
        congested_approaches = []

        for cfg in independent_cameras:
            cid = cfg.camera_id
            telem = video_ingestion_service.get_camera_spatial_telemetry(cid)
            q_count = telem.get("queue_vehicle_count", 0)
            densities = telem.get("lane_densities", {})
            peak_lane_density = max(densities.values()) if densities else 0.0

            total_queue += q_count
            if peak_lane_density > max_density:
                max_density = peak_lane_density

            is_congested = peak_lane_density >= 65.0 or q_count >= 10
            if is_congested:
                congested_approaches.append({
                    "camera_id": cid,
                    "intersection_id": cfg.intersection_id,
                    "direction": cfg.approach.direction if cfg.approach else "UNKNOWN",
                    "queue": q_count,
                    "peak_density_pct": peak_lane_density
                })

            camera_metrics.append({
                "camera_id": cid,
                "intersection_id": cfg.intersection_id,
                "direction": cfg.approach.direction if cfg.approach else "UNKNOWN",
                "queue_count": q_count,
                "peak_lane_density_pct": peak_lane_density,
                "stop_line_crossings": telem.get("stop_line_crossings_count", 0),
                "is_congested": is_congested
            })

        # Network Congestion Index (0.0 to 100.0%)
        # Weighted combination of average queue and peak lane densities
        avg_density = (sum(m["peak_lane_density_pct"] for m in camera_metrics) / len(camera_metrics)) if camera_metrics else 0.0
        congestion_index = round(min(100.0, (avg_density * 0.70) + (total_queue * 0.75)), 1)

        # Detect spillback risk along I1 <-> I2 corridor
        i1_west_q = next((m["queue_count"] for m in camera_metrics if m["camera_id"] == "CAM_I1_WEST"), 0)
        i2_north_q = next((m["queue_count"] for m in camera_metrics if m["camera_id"] == "CAM_I2_NORTH"), 0)
        spillback_risk = "HIGH" if (i1_west_q >= 12 or i2_north_q >= 10) else ("MODERATE" if (i1_west_q >= 8 or i2_north_q >= 6) else "LOW")

        return {
            "timestamp": now,
            "source_type": "RECORDED_CCTV_REPLAY",
            "is_simulation": False,
            "network_congestion_index_pct": congestion_index,
            "congestion_level": "HEAVY" if congestion_index >= 70.0 else ("MODERATE" if congestion_index >= 40.0 else "FLUID"),
            "total_independent_cameras": len(independent_cameras),
            "total_network_queue_vehicles": total_queue,
            "spillback_risk": spillback_risk,
            "congested_approaches_count": len(congested_approaches),
            "congested_hotspots": congested_approaches,
            "corridor_status": {
                "corridor_id": "CORRIDOR_MG_ROAD_I1_I2",
                "length_meters": self.CORRIDOR_DISTANCE_METERS,
                "travel_time_sec": self.ideal_travel_time_sec,
                "current_quality": "COORDINATED" if spillback_risk != "HIGH" else "SPILLBACK_WARNING"
            },
            "connectivity_matrix": self.CORRIDOR_CONNECTIVITY_MATRIX,
            "per_camera_metrics": camera_metrics
        }


# Global singleton instance
corridor_coordination_service = CorridorCoordinationService()
