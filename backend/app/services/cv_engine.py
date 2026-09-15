"""Real YOLOv8 Computer Vision Pipeline & Vehicle Detection Engine for NexTrAI."""

import os
import cv2
import numpy as np
import logging
from typing import List, Dict, Any, Tuple, Optional
from ultralytics import YOLO

logger = logging.getLogger("nextrai.cv")

class CVEngine:
    """YOLOv8-powered vehicle detection, classification, and queue density analyzer."""

    # COCO Class ID mappings for urban traffic
    VEHICLE_CLASSES = {
        2: "CAR",
        3: "MOTORCYCLE",
        5: "BUS",
        7: "TRUCK"
    }

    def __init__(self, model_name: str = "yolov8n.pt"):
        self.model_name = model_name
        self._model: Optional[YOLO] = None
        self._is_loaded = False
        
        # Simple centroid tracker state: { camera_id: { track_id: (cx, cy, last_seen) } }
        self._trackers: Dict[str, Dict[int, Dict[str, Any]]] = {}
        self._next_track_id: Dict[str, int] = {}

    def get_model(self) -> YOLO:
        """Lazy-loads YOLO model weights."""
        if not self._is_loaded or self._model is None:
            logger.info(f"Loading YOLO model weights ({self.model_name})...")
            self._model = YOLO(self.model_name)
            self._is_loaded = True
        return self._model

    def detect_vehicles(self, frame: np.ndarray, conf_threshold: float = 0.35) -> List[Dict[str, Any]]:
        """
        Runs YOLO inference on a single frame and extracts vehicle bounding boxes and classes.
        """
        if frame is None or frame.size == 0:
            return []

        model = self.get_model()
        results = model.predict(source=frame, conf=conf_threshold, verbose=False)
        
        detections = []
        if not results or len(results) == 0:
            return []

        h, w = frame.shape[:2]
        boxes = results[0].boxes

        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            if cls_id not in self.VEHICLE_CLASSES:
                continue

            conf = float(boxes.conf[i].item())
            xyxy = boxes.xyxy[i].cpu().numpy()
            x1, y1, x2, y2 = [int(v) for v in xyxy]

            # Keep inside image bounds
            x1 = max(0, min(w - 1, x1))
            y1 = max(0, min(h - 1, y1))
            x2 = max(0, min(w - 1, x2))
            y2 = max(0, min(h - 1, y2))

            if x2 <= x1 or y2 <= y1:
                continue

            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            v_class = self.VEHICLE_CLASSES[cls_id]
            # Heuristic for Indian auto-rickshaws: smaller width/height ratio than standard cars
            bw = x2 - x1
            bh = y2 - y1
            if v_class == "CAR" and 0.6 < (bw / max(1, bh)) < 1.1 and bw < (w * 0.25):
                v_class = "AUTO_RICKSHAW"

            detections.append({
                "class_label": v_class,
                "confidence": round(conf, 3),
                "bbox": [x1, y1, x2, y2],
                "centroid": [cx, cy],
                "width": bw,
                "height": bh,
                "aspect_ratio": round(bw / max(1, bh), 2)
            })

        return detections

    def track_and_count(self, camera_id: str, detections: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
        """
        Associates detections across consecutive frames via nearest centroid matching
        and computes approach vehicle counts.
        """
        if camera_id not in self._trackers:
            self._trackers[camera_id] = {}
            self._next_track_id[camera_id] = 1

        active_trackers = self._trackers[camera_id]
        updated_detections = []
        used_track_ids = set()

        for det in detections:
            cx, cy = det["centroid"]
            best_id = None
            best_dist = 65.0  # Max pixel distance for same vehicle across frames

            for tid, tinfo in active_trackers.items():
                if tid in used_track_ids:
                    continue
                dist = np.hypot(cx - tinfo["cx"], cy - tinfo["cy"])
                if dist < best_dist:
                    best_dist = dist
                    best_id = tid

            if best_id is None:
                best_id = self._next_track_id[camera_id]
                self._next_track_id[camera_id] += 1

            used_track_ids.add(best_id)
            active_trackers[best_id] = {
                "cx": cx,
                "cy": cy,
                "class_label": det["class_label"]
            }

            det["track_id"] = best_id
            updated_detections.append(det)

        # Count vehicle types in current frame
        class_counts: Dict[str, int] = {}
        for d in updated_detections:
            lbl = d["class_label"]
            class_counts[lbl] = class_counts.get(lbl, 0) + 1

        return updated_detections, class_counts

cv_engine = CVEngine()
