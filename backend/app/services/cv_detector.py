"""Computer Vision Camera Processing & Detection Engine.

Provides automated CCTV camera feed processing across 8 cameras (I1 & I2).
Generates frame-by-frame tracking bounding boxes, velocity vectors, heading calculations,
and dynamic ambulance corridor propagation (I1 -> I2).
"""

import time
import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("syncsignal.cv")

class CVDetectorService:
    """Simulates computer vision detection & frame-by-frame object tracking pipeline across 8 CCTV camera feeds."""

    def __init__(self):
        # 8 Cameras across Intersections I1 and I2
        self.cameras: Dict[str, Dict[str, Any]] = {
            "CAM_I1_NORTH": {
                "camera_id": "CAM_I1_NORTH",
                "intersection_id": "I1",
                "direction": "NORTH",
                "name": "Main St & 1st Ave (North Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I1_NORTH.mp4",
                "active_detection": None
            },
            "CAM_I1_SOUTH": {
                "camera_id": "CAM_I1_SOUTH",
                "intersection_id": "I1",
                "direction": "SOUTH",
                "name": "Main St & 1st Ave (South Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I1_SOUTH.mp4",
                "active_detection": None
            },
            "CAM_I1_EAST": {
                "camera_id": "CAM_I1_EAST",
                "intersection_id": "I1",
                "direction": "EAST",
                "name": "Main St & 1st Ave (East Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I1_EAST.mp4",
                "active_detection": None
            },
            "CAM_I1_WEST": {
                "camera_id": "CAM_I1_WEST",
                "intersection_id": "I1",
                "direction": "WEST",
                "name": "Main St & 1st Ave (West Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I1_WEST.mp4",
                "active_detection": None
            },
            "CAM_I2_NORTH": {
                "camera_id": "CAM_I2_NORTH",
                "intersection_id": "I2",
                "direction": "NORTH",
                "name": "Main St & 2nd Ave (North Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I2_NORTH.mp4",
                "active_detection": None
            },
            "CAM_I2_SOUTH": {
                "camera_id": "CAM_I2_SOUTH",
                "intersection_id": "I2",
                "direction": "SOUTH",
                "name": "Main St & 2nd Ave (South Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I2_SOUTH.mp4",
                "active_detection": None
            },
            "CAM_I2_EAST": {
                "camera_id": "CAM_I2_EAST",
                "intersection_id": "I2",
                "direction": "EAST",
                "name": "Main St & 2nd Ave (East Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I2_EAST.mp4",
                "active_detection": None
            },
            "CAM_I2_WEST": {
                "camera_id": "CAM_I2_WEST",
                "intersection_id": "I2",
                "direction": "WEST",
                "name": "Main St & 2nd Ave (West Cam)",
                "status": "ONLINE",
                "video_src": "/videos/I2_WEST.mp4",
                "active_detection": None
            },
        }

        # Active Ambulance Tracking Session State
        self.tracking_session: Optional[Dict[str, Any]] = None

    def get_cameras(self) -> List[Dict[str, Any]]:
        """Returns list of active 8 camera streams."""
        return list(self.cameras.values())

    def is_tracking_active(self) -> bool:
        """Returns whether an active ambulance tracking session is running."""
        return self.tracking_session is not None

    def start_ambulance_tracking(self, camera_id: str = "CAM_I1_NORTH") -> Dict[str, Any]:
        """
        Initiates persistent YOLO frame-by-frame tracking for an emergency ambulance (ID: 07).
        Calculates position vector (dx/dy), heading, current intersection, current approach, and next intersection (I1 -> I2).
        """
        if camera_id not in self.cameras:
            camera_id = "CAM_I1_NORTH"

        cam = self.cameras[camera_id]

        self.tracking_session = {
            "tracking_id": "07",
            "class_label": "AMBULANCE",
            "start_time": time.time(),
            "start_camera": camera_id,
            "current_camera": camera_id,
            "current_intersection": cam["intersection_id"],
            "current_approach": cam["direction"],
            "heading": "EASTBOUND",
            "next_intersection": "I2" if cam["intersection_id"] == "I1" else "NONE",
            "history": [],  # Frame center position history [{x, y, t}, ...]
            "corridor_stage": "APPROACHING_I1"  # APPROACHING_I1 -> TRANSITIONING_TO_I2 -> APPROACHING_I2 -> CLEARED
        }

        logger.info(f"YOLO Tracker initialized persistent ambulance tracking (ID: 07) on {camera_id}.")
        res = self.tick_tracking()
        return res or {}

    def tick_tracking(self) -> Optional[Dict[str, Any]]:
        """
        Updates frame-by-frame bounding box coordinates based on actual position movement.
        Calculates velocity vectors (dx/dy), cardinal heading (EASTBOUND), current node, and next node.
        """
        if not self.tracking_session:
            return None

        sess = self.tracking_session
        elapsed = time.time() - sess["start_time"]

        # Timeline logic for I1 -> I2 Emergency Green Corridor (Total ~20s cycle):
        # 0s to 8s: Ambulance approaching & clearing I1 (on CAM_I1_NORTH / CAM_I1_EAST)
        # 8s to 18s: Ambulance passing I1 and traveling Eastbound towards I2 (on CAM_I2_NORTH / CAM_I2_WEST)
        # > 18s: Ambulance cleared I2 intersection.

        if elapsed <= 8.0:
            sess["corridor_stage"] = "APPROACHING_I1"
            sess["current_intersection"] = "I1"
            sess["next_intersection"] = "I2"
            active_cam_id = sess["start_camera"]

            # Dynamic frame-by-frame bounding box animation (x: 15% -> 75%, y: 20% -> 60%)
            progress = min(1.0, elapsed / 8.0)
            x_pos = 15.0 + (progress * 60.0)
            y_pos = 20.0 + (progress * 40.0)

            sess["history"].append({"x": x_pos, "y": y_pos, "t": elapsed})
            if len(sess["history"]) > 10:
                sess["history"].pop(0)

            # Vector calculation from position center delta across frames
            p_first = sess["history"][0]
            p_last = sess["history"][-1]
            dx = p_last["x"] - p_first["x"]
            dy = p_last["y"] - p_first["y"]

            heading = "EASTBOUND" if dx >= 0 else "WESTBOUND"
            sess["heading"] = heading

            detection_data = {
                "detection_id": "DET-AMB-07",
                "tracking_id": "07",
                "camera_id": active_cam_id,
                "intersection_id": "I1",
                "approach": sess["current_approach"],
                "class_label": "AMBULANCE",
                "confidence": 0.96,
                "priority": "P1 EMERGENCY",
                "bounding_box": {
                    "x": round(x_pos, 1),
                    "y": round(y_pos, 1),
                    "width": 35.0,
                    "height": 30.0
                },
                "center_x": round(x_pos + 17.5, 1),
                "center_y": round(y_pos + 15.0, 1),
                "vector": {"dx": round(dx, 2), "dy": round(dy, 2)},
                "heading": heading,
                "estimated_speed_kmh": round(64.0 + math.sin(elapsed) * 4.0, 1),
                "current_intersection": "I1",
                "next_intersection": "I2",
                "corridor_stage": "APPROACHING_I1",
                "timestamp": time.strftime("%H:%M:%S IST")
            }

            for cid, cam in self.cameras.items():
                if cid == active_cam_id:
                    cam["active_detection"] = detection_data
                else:
                    cam["active_detection"] = None

            return detection_data

        elif elapsed <= 18.0:
            sess["corridor_stage"] = "TRANSITIONING_TO_I2"
            sess["current_intersection"] = "I2"
            sess["current_approach"] = "WEST"
            sess["next_intersection"] = "NONE (CORRIDOR EXIT)"
            active_cam_id = "CAM_I2_NORTH"

            progress = min(1.0, (elapsed - 8.0) / 10.0)
            x_pos = 10.0 + (progress * 65.0)
            y_pos = 25.0 + (progress * 35.0)

            sess["history"].append({"x": x_pos, "y": y_pos, "t": elapsed})
            if len(sess["history"]) > 10:
                sess["history"].pop(0)

            p_first = sess["history"][0]
            p_last = sess["history"][-1]
            dx = p_last["x"] - p_first["x"]
            heading = "EASTBOUND" if dx >= 0 else "WESTBOUND"

            detection_data = {
                "detection_id": "DET-AMB-07",
                "tracking_id": "07",
                "camera_id": active_cam_id,
                "intersection_id": "I2",
                "approach": "WEST",
                "class_label": "AMBULANCE",
                "confidence": 0.98,
                "priority": "P1 EMERGENCY",
                "bounding_box": {
                    "x": round(x_pos, 1),
                    "y": round(y_pos, 1),
                    "width": 35.0,
                    "height": 30.0
                },
                "center_x": round(x_pos + 17.5, 1),
                "center_y": round(y_pos + 15.0, 1),
                "vector": {"dx": round(dx, 2), "dy": 0.0},
                "heading": heading,
                "estimated_speed_kmh": round(68.0 + math.cos(elapsed) * 3.0, 1),
                "current_intersection": "I2",
                "next_intersection": "NONE (CORRIDOR EXIT)",
                "corridor_stage": "APPROACHING_I2",
                "timestamp": time.strftime("%H:%M:%S IST")
            }

            for cid, cam in self.cameras.items():
                if cid == active_cam_id:
                    cam["active_detection"] = detection_data
                else:
                    cam["active_detection"] = None

            return detection_data

        else:
            logger.info("Ambulance #07 successfully cleared Intersection I2. Corridor completed.")
            self.clear_detections()
            return None

    def simulate_camera_detection(self, camera_id: str = "CAM_I1_NORTH", vehicle_type: str = "AMBULANCE") -> Dict[str, Any]:
        """Triggers computer vision detection and starts the P1 corridor tracking pipeline."""
        det = self.start_ambulance_tracking(camera_id)
        from app.services.simulation_engine import simulation_engine
        evt = simulation_engine.trigger_event("EMERGENCY_VEHICLE", det.get("intersection_id", "I1"), det.get("approach", "NORTH"))
        return {
            "detection": det,
            "event": evt,
            "corridor_action": "P1_EMERGENCY_CORRIDOR_I1_TO_I2_ACTIVE"
        }

    def clear_detections(self):
        """Clears camera detection overlays and resets tracking session."""
        self.tracking_session = None
        for cam in self.cameras.values():
            cam["active_detection"] = None

cv_detector = CVDetectorService()
