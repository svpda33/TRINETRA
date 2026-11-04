"""GIS Spatial Topology & Distance Matrix Engine for Hyderabad Smart Corridor."""

import math
from typing import Dict, List, Tuple, Any, Optional

class GISEngine:
    """Provides spatial calculations, junction coordinates, and camera topologies."""

    # Official Hyderabad Smart IT Corridor Junction Coordinates
    JUNCTIONS: Dict[str, Dict[str, Any]] = {
        "I1": {
            "intersection_id": "I1",
            "name": "Cyber Towers Junction",
            "locality": "Hitec City Core",
            "latitude": 17.4504,
            "longitude": 78.3808,
            "connected_to": ["I2"],
            "cameras": ["CAM_I1_NORTH", "CAM_I1_SOUTH", "CAM_I1_EAST", "CAM_I1_WEST"]
        },
        "I2": {
            "intersection_id": "I2",
            "name": "Hitec City / Mindspace Junction",
            "locality": "Mindspace SEZ",
            "latitude": 17.4428,
            "longitude": 78.3813,
            "connected_to": ["I1", "I3"],
            "cameras": ["CAM_I2_NORTH", "CAM_I2_SOUTH", "CAM_I2_EAST", "CAM_I2_WEST"]
        },
        "I3": {
            "intersection_id": "I3",
            "name": "Bio-Diversity Junction",
            "locality": "Raidurgam",
            "latitude": 17.4325,
            "longitude": 78.3728,
            "connected_to": ["I2", "I4"],
            "cameras": ["CAM_I3_NORTH", "CAM_I3_SOUTH", "CAM_I3_EAST", "CAM_I3_WEST"]
        },
        "I4": {
            "intersection_id": "I4",
            "name": "Gachibowli Junction",
            "locality": "ORR / Financial District Gate",
            "latitude": 17.4401,
            "longitude": 78.3489,
            "connected_to": ["I3"],
            "cameras": ["CAM_I4_NORTH", "CAM_I4_SOUTH", "CAM_I4_EAST", "CAM_I4_WEST"]
        }
    }

    # Calibrated Road Driving Distances along Corridor (in meters)
    ROAD_DISTANCES: Dict[Tuple[str, str], float] = {
        ("I1", "I2"): 850.0,
        ("I2", "I1"): 850.0,
        ("I2", "I3"): 1400.0,
        ("I3", "I2"): 1400.0,
        ("I3", "I4"): 2600.0,
        ("I4", "I3"): 2600.0,
        ("I1", "I3"): 2250.0,
        ("I3", "I1"): 2250.0,
        ("I1", "I4"): 4850.0,
        ("I4", "I1"): 4850.0,
    }

    @staticmethod
    def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Computes great-circle distance between two GPS coordinates in meters."""
        r = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return r * c

    @classmethod
    def get_corridor_distance(cls, from_node: str, to_node: str) -> float:
        """Returns calibrated driving distance in meters between two network nodes."""
        pair = (from_node.upper(), to_node.upper())
        if pair in cls.ROAD_DISTANCES:
            return cls.ROAD_DISTANCES[pair]
        
        # Fallback to Haversine
        n1 = cls.JUNCTIONS.get(from_node.upper())
        n2 = cls.JUNCTIONS.get(to_node.upper())
        if n1 and n2:
            return round(cls.haversine_distance_meters(n1["latitude"], n1["longitude"], n2["latitude"], n2["longitude"]), 1)
        return 1000.0

    @classmethod
    def get_topology_payload(cls) -> Dict[str, Any]:
        """Returns complete GIS topology model for Leaflet map hydration."""
        return {
            "city": "Hyderabad",
            "state": "Telangana",
            "corridor_name": "Hyderabad Smart IT Corridor (Cyber Towers - Gachibowli)",
            "center": {"latitude": 17.4440, "longitude": 78.3750, "zoom": 14},
            "junctions": list(cls.JUNCTIONS.values()),
            "corridor_segments": [
                {
                    "from_node": "I1",
                    "to_node": "I2",
                    "distance_meters": 850,
                    "speed_limit_kmh": 50,
                    "from_coords": [17.4504, 78.3808],
                    "to_coords": [17.4428, 78.3813]
                },
                {
                    "from_node": "I2",
                    "to_node": "I3",
                    "distance_meters": 1400,
                    "speed_limit_kmh": 60,
                    "from_coords": [17.4428, 78.3813],
                    "to_coords": [17.4325, 78.3728]
                },
                {
                    "from_node": "I3",
                    "to_node": "I4",
                    "distance_meters": 2600,
                    "speed_limit_kmh": 60,
                    "from_coords": [17.4325, 78.3728],
                    "to_coords": [17.4401, 78.3489]
                }
            ]
        }

    @classmethod
    def get_all_junctions(cls) -> List[Dict[str, Any]]:
        """Returns all corridor junctions as a list."""
        return list(cls.JUNCTIONS.values())

    @classmethod
    def get_corridor_total_length_meters(cls) -> float:
        """Returns total length of the continuous corridor in meters (I1 to I4)."""
        return sum(seg["distance_meters"] for seg in cls.get_topology_payload()["corridor_segments"])

    @classmethod
    def get_road_distance(cls, from_node: str, to_node: str) -> float:
        """Alias for get_corridor_distance."""
        return cls.get_corridor_distance(from_node, to_node)

    @classmethod
    def get_camera_nodes(cls) -> List[Dict[str, Any]]:
        """Returns coordinate metadata for all 8 corridor cameras with strict provenance and location confidence."""
        # Configured directional offsets (~60m-80m from intersection center) for spatial visualization
        return [
            {
                "camera_id": "CAM_I1_NORTH",
                "intersection_id": "I1",
                "direction": "NORTH",
                "name": "Cyber Towers North Approach",
                "latitude": 17.4510,
                "longitude": 78.3808,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~60m north of junction center)",
                "associated_intersection": "I1",
                "gps_verified": False,
                "video_file": "I1_NORTH.mp4",
                "video_src": "/videos/I1_NORTH.mp4"
            },
            {
                "camera_id": "CAM_I1_SOUTH",
                "intersection_id": "I1",
                "direction": "SOUTH",
                "name": "Cyber Towers South Approach",
                "latitude": 17.4498,
                "longitude": 78.3808,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~60m south of junction center)",
                "associated_intersection": "I1",
                "gps_verified": False,
                "video_file": "I1_SOUTH.mp4",
                "video_src": "/videos/I1_SOUTH.mp4"
            },
            {
                "camera_id": "CAM_I1_EAST",
                "intersection_id": "I1",
                "direction": "EAST",
                "name": "Cyber Towers East Approach",
                "latitude": 17.4504,
                "longitude": 78.3815,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~75m east of junction center)",
                "associated_intersection": "I1",
                "gps_verified": False,
                "video_file": "I1_EAST.mp4",
                "video_src": "/videos/I1_EAST.mp4"
            },
            {
                "camera_id": "CAM_I1_WEST",
                "intersection_id": "I1",
                "direction": "WEST",
                "name": "Cyber Towers West Approach",
                "latitude": 17.4504,
                "longitude": 78.3801,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~75m west of junction center)",
                "associated_intersection": "I1",
                "gps_verified": False,
                "video_file": "I1_WEST.mp4",
                "video_src": "/videos/I1_WEST.mp4"
            },
            {
                "camera_id": "CAM_I2_NORTH",
                "intersection_id": "I2",
                "direction": "NORTH",
                "name": "Mindspace North Approach",
                "latitude": 17.4435,
                "longitude": 78.3813,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~75m north of junction center)",
                "associated_intersection": "I2",
                "gps_verified": False,
                "video_file": "I2_NORTH.mp4",
                "video_src": "/videos/I2_NORTH.mp4"
            },
            {
                "camera_id": "CAM_I2_SOUTH",
                "intersection_id": "I2",
                "direction": "SOUTH",
                "name": "Mindspace South Approach",
                "latitude": 17.4421,
                "longitude": 78.3813,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~75m south of junction center)",
                "associated_intersection": "I2",
                "gps_verified": False,
                "video_file": "I2_SOUTH.mp4",
                "video_src": "/videos/I2_SOUTH.mp4"
            },
            {
                "camera_id": "CAM_I2_EAST",
                "intersection_id": "I2",
                "direction": "EAST",
                "name": "Mindspace East Approach",
                "latitude": 17.4428,
                "longitude": 78.3820,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~75m east of junction center)",
                "associated_intersection": "I2",
                "gps_verified": False,
                "video_file": "I2_EAST.mp4",
                "video_src": "/videos/I2_EAST.mp4"
            },
            {
                "camera_id": "CAM_I2_WEST",
                "intersection_id": "I2",
                "direction": "WEST",
                "name": "Mindspace West Approach",
                "latitude": 17.4428,
                "longitude": 78.3806,
                "status": "ONLINE",
                "source_type": "RECORDED_CCTV_REPLAY",
                "source_provenance": "RECORDED_CCTV_REPLAY",
                "telemetry_status": "ACTIVE_REPLAY_STREAM",
                "telemetry_freshness": "FRESH",
                "location_type": "APPROXIMATE_APPROACH_OFFSET",
                "location_confidence": "APPROXIMATE_APPROACH_OFFSET",
                "location_notes": "Approximate directional offset (~75m west of junction center)",
                "associated_intersection": "I2",
                "gps_verified": False,
                "video_file": "I2_WEST.mp4",
                "video_src": "/videos/I2_WEST.mp4"
            }
        ]

gis_engine = GISEngine()
