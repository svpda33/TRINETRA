"""GIS Spatial Topology & Real-Time Map Telemetry API endpoints for NexTrAI."""

from fastapi import APIRouter
from app.services.gis_engine import gis_engine
from app.services.simulation_engine import simulation_engine

router = APIRouter(prefix="/gis", tags=["GIS Spatial Engine"])

@router.get("/topology")
async def get_gis_topology():
    """
    Returns GIS topology, junction coordinates, camera placements,
    and road segment distances along the Hyderabad Smart IT Corridor.
    """
    return {
        "status": "success",
        "data": gis_engine.get_topology_payload()
    }

@router.get("/map-telemetry")
async def get_map_telemetry():
    """
    Returns unified real-time GIS map telemetry for the interactive Hyderabad Traffic Map:
    - 4 Intersections (I1 - I4) with coordinates, active phase, elapsed time, queue counts, congestion levels
    - 8 Cameras with approach directions, GPS offsets, feed status, and clear 'RECORDED_CCTV_REPLAY' provenance
    - Corridor links (active monitored I1-I2 segment and planned I2-I3, I3-I4 extensions)
    """
    topology = simulation_engine.get_topology()
    active_events = simulation_engine.active_events
    cameras = gis_engine.get_camera_nodes()

    # Build live intersection node telemetry
    intersections_data = []
    for node in topology.intersections:
        c_state = simulation_engine.controller_state.get(node.intersection_id, {})
        phase_state = c_state.get("phase_state", "GREEN")
        elapsed = c_state.get("state_elapsed", 0)
        duration = c_state.get("green_duration", 30)
        densities = c_state.get("densities", {})
        total_veh = sum(densities.values()) if densities else 0

        # Congestion rating
        if total_veh > 120:
            congestion_rating = "CRITICAL"
        elif total_veh > 70:
            congestion_rating = "HEAVY"
        elif total_veh > 35:
            congestion_rating = "MODERATE"
        else:
            congestion_rating = "LOW"

        # Check emergency priority state
        has_emergency = any(
            getattr(e, "intersection_id", "") == node.intersection_id and getattr(e, "is_active", True)
            for e in active_events
        )

        intersections_data.append({
            "intersection_id": node.intersection_id,
            "name": node.name,
            "latitude": node.latitude,
            "longitude": node.longitude,
            "active_approach": node.active_approach,
            "phase_state": phase_state,
            "state_elapsed": elapsed,
            "green_duration": duration,
            "remaining_seconds": max(0, duration - elapsed) if phase_state == "GREEN" else (3 - elapsed if phase_state == "YELLOW" else max(0, 2 - elapsed)),
            "queues": densities,
            "total_vehicles": total_veh,
            "congestion_rating": congestion_rating,
            "emergency_preemption_active": has_emergency,
            "permitted_movements": node.permitted_movements,
            "other_approaches_status": getattr(node, "other_approaches_status", "ALL OTHER APPROACHES RED")
        })

    # Enrich camera feeds with live queue counts for their approach
    enriched_cameras = []
    for cam in cameras:
        cam_copy = dict(cam)
        i_id = cam_copy["intersection_id"]
        dir_name = cam_copy["direction"]
        c_state = simulation_engine.controller_state.get(i_id, {})
        cam_copy["current_approach_queue"] = c_state.get("densities", {}).get(dir_name, 0)
        cam_copy["is_active_approach"] = (
            simulation_engine.intersections[i_id].active_approach == dir_name
            if i_id in simulation_engine.intersections else False
        )
        enriched_cameras.append(cam_copy)

    # Corridor route metadata
    corridors = [
        {
            "corridor_id": "CORR_I1_I2",
            "name": "Cyber Towers - Mindspace Arterial Segment",
            "status": "ACTIVE_MONITORED",
            "from_node": "I1",
            "to_node": "I2",
            "path": [[17.4504, 78.3808], [17.4428, 78.3813]],
            "distance_meters": 850,
            "flow_speed_kmh": 41.5,
            "travel_time_seconds": 74,
            "green_wave_active": True
        },
        {
            "corridor_id": "CORR_I2_I3",
            "name": "Mindspace - Bio-Diversity Link",
            "status": "PLANNED_EXPANSION",
            "from_node": "I2",
            "to_node": "I3",
            "path": [[17.4428, 78.3813], [17.4325, 78.3728]],
            "distance_meters": 1400,
            "flow_speed_kmh": 48.0,
            "travel_time_seconds": 105,
            "green_wave_active": False
        },
        {
            "corridor_id": "CORR_I3_I4",
            "name": "Bio-Diversity - Gachibowli Link",
            "status": "PLANNED_EXPANSION",
            "from_node": "I3",
            "to_node": "I4",
            "path": [[17.4325, 78.3728], [17.4401, 78.3489]],
            "distance_meters": 2600,
            "flow_speed_kmh": 55.0,
            "travel_time_seconds": 170,
            "green_wave_active": False
        }
    ]

    return {
        "status": "success",
        "timestamp": simulation_engine.controller_state.get("I1", {}).get("state_elapsed", 0),
        "intersections": intersections_data,
        "cameras": enriched_cameras,
        "corridors": corridors,
        "active_events_count": len([e for e in active_events if getattr(e, "is_active", True)])
    }
