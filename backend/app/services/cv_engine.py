"""Real YOLOv8 Computer Vision Pipeline & Multi-Object Tracker (IoU MOT) for NexTrAI."""

import os
import cv2
import numpy as np
import logging
from typing import List, Dict, Any, Tuple, Optional
from collections import deque
from ultralytics import YOLO

logger = logging.getLogger("nextrai.cv")

def compute_iou(box1: List[int], box2: List[int]) -> float:
    """Computes Intersection-over-Union (IoU) between two bounding boxes [x1, y1, x2, y2]."""
    xA = max(box1[0], box2[0])
    yA = max(box1[1], box2[1])
    xB = min(box1[2], box2[2])
    yB = min(box1[3], box2[3])

    inter_w = max(0, xB - xA)
    inter_h = max(0, yB - yA)
    inter_area = inter_w * inter_h

    area1 = max(0, box1[2] - box1[0]) * max(0, box1[3] - box1[1])
    area2 = max(0, box2[2] - box2[0]) * max(0, box2[3] - box2[1])
    union_area = area1 + area2 - inter_area

    if union_area <= 0:
        return 0.0
    return float(inter_area / union_area)


class TrackedObject:
    """Represents a persistent vehicle tracked across consecutive video frames."""

    def __init__(self, track_id: int, bbox: List[int], class_label: str, confidence: float):
        self.track_id = track_id
        self.bbox = bbox
        self.class_label = class_label
        self.confidence = confidence
        self.hits = 1
        self.time_since_update = 0
        self.history: deque = deque(maxlen=30)  # Stores last 30 centroid positions
        cx = (bbox[0] + bbox[2]) // 2
        cy = (bbox[1] + bbox[3]) // 2
        self.history.append((cx, cy))
        self.velocity = (0.0, 0.0)

    def predict(self) -> List[int]:
        """Predicts expected bounding box based on estimated velocity."""
        vx, vy = self.velocity
        x1, y1, x2, y2 = self.bbox
        return [int(x1 + vx), int(y1 + vy), int(x2 + vx), int(y2 + vy)]

    def update(self, new_bbox: List[int], new_conf: float):
        """Updates track state with newly matched detection."""
        old_cx = (self.bbox[0] + self.bbox[2]) // 2
        old_cy = (self.bbox[1] + self.bbox[3]) // 2
        new_cx = (new_bbox[0] + new_bbox[2]) // 2
        new_cy = (new_bbox[1] + new_bbox[3]) // 2

        # Smooth velocity with exponential moving average
        cur_vx = float(new_cx - old_cx)
        cur_vy = float(new_cy - old_cy)
        self.velocity = (
            0.6 * self.velocity[0] + 0.4 * cur_vx,
            0.6 * self.velocity[1] + 0.4 * cur_vy
        )

        self.bbox = new_bbox
        self.confidence = new_conf
        self.hits += 1
        self.time_since_update = 0
        self.history.append((new_cx, new_cy))

    def mark_missed(self):
        """Increments frame missed counter."""
        self.time_since_update += 1


class IoUMultiObjectTracker:
    """
    Genuine Multi-Object Tracker (IoU MOT) maintaining persistent IDs across video frames.
    Associates predicted bounding boxes with YOLO detections using maximum IoU bipartite matching.
    """

    def __init__(self, iou_threshold: float = 0.25, max_lost_frames: int = 12, start_id: int = 101):
        self.iou_threshold = iou_threshold
        self.max_lost_frames = max_lost_frames
        self.next_track_id = start_id
        self.tracks: Dict[int, TrackedObject] = {}

    def update(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Matches frame detections to active tracks and spawns new tracks for unmatched vehicles.
        Returns list of active tracked vehicle dictionaries.
        """
        active_track_ids = list(self.tracks.keys())
        predicted_boxes = {tid: self.tracks[tid].predict() for tid in active_track_ids}

        matched_tracks = set()
        matched_detections = set()

        # Compute IoU matching matrix (greedy match highest IoU first)
        matches = []
        for d_idx, det in enumerate(detections):
            d_box = det["bbox"]
            for tid in active_track_ids:
                iou = compute_iou(predicted_boxes[tid], d_box)
                if iou >= self.iou_threshold:
                    matches.append((iou, tid, d_idx))

        # Sort matches by highest IoU descending
        matches.sort(key=lambda m: m[0], reverse=True)

        for iou, tid, d_idx in matches:
            if tid in matched_tracks or d_idx in matched_detections:
                continue
            # Associate track with detection
            det = detections[d_idx]
            self.tracks[tid].update(det["bbox"], det["confidence"])
            matched_tracks.add(tid)
            matched_detections.add(d_idx)

        # Unmatched existing tracks: increment missed counter
        for tid in active_track_ids:
            if tid not in matched_tracks:
                self.tracks[tid].mark_missed()

        # Remove dead tracks that exceeded max_lost_frames
        dead_ids = [tid for tid, trk in self.tracks.items() if trk.time_since_update > self.max_lost_frames]
        for tid in dead_ids:
            del self.tracks[tid]

        # Spawn new tracks for unmatched high-confidence detections
        for d_idx, det in enumerate(detections):
            if d_idx not in matched_detections and det["confidence"] >= 0.35:
                new_id = self.next_track_id
                self.next_track_id += 1
                new_track = TrackedObject(
                    track_id=new_id,
                    bbox=det["bbox"],
                    class_label=det["class_label"],
                    confidence=det["confidence"]
                )
                self.tracks[new_id] = new_track

        # Build output list of confirmed active tracks
        results = []
        for tid, trk in self.tracks.items():
            if trk.time_since_update == 0:  # Currently visible in this frame
                cx = (trk.bbox[0] + trk.bbox[2]) // 2
                cy = (trk.bbox[1] + trk.bbox[3]) // 2
                vx, vy = trk.velocity
                heading = "SOUTHBOUND" if vy > 0 else "NORTHBOUND"
                if abs(vx) > abs(vy):
                    heading = "EASTBOUND" if vx > 0 else "WESTBOUND"

                results.append({
                    "tracker_id": tid,
                    "class_label": trk.class_label,
                    "confidence": round(trk.confidence, 3),
                    "bbox": trk.bbox,
                    "centroid": [cx, cy],
                    "velocity": [round(vx, 1), round(vy, 1)],
                    "heading": heading,
                    "hits": trk.hits
                })

        return results


class CVEngine:
    """YOLOv8-powered vehicle detection, classification, and multi-camera MOT tracker."""

    # Urban vehicle class mappings from COCO
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
        
        # Multi-Object Tracker per camera feed
        self._trackers: Dict[str, IoUMultiObjectTracker] = {}

    def get_model(self) -> YOLO:
        """Lazy-loads YOLO model weights."""
        if not self._is_loaded or self._model is None:
            logger.info(f"Loading YOLO model weights ({self.model_name})...")
            self._model = YOLO(self.model_name)
            self._is_loaded = True
        return self._model

    def get_tracker(self, camera_id: str) -> IoUMultiObjectTracker:
        """Returns or instantiates persistent tracker for a camera."""
        if camera_id not in self._trackers:
            self._trackers[camera_id] = IoUMultiObjectTracker(start_id=101)
        return self._trackers[camera_id]

    def detect_vehicles(self, frame: np.ndarray, conf_threshold: float = 0.30) -> List[Dict[str, Any]]:
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

            # Keep strictly inside image bounds
            x1 = max(0, min(w - 1, x1))
            y1 = max(0, min(h - 1, y1))
            x2 = max(0, min(w - 1, x2))
            y2 = max(0, min(h - 1, y2))

            if x2 <= x1 or y2 <= y1:
                continue

            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            bw = x2 - x1
            bh = y2 - y1

            v_class = self.VEHICLE_CLASSES[cls_id]
            # Heuristic for Indian 3-wheeler auto-rickshaws
            if v_class == "CAR" and 0.6 < (bw / max(1, bh)) < 1.15 and bw < (w * 0.28):
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

    def detect_and_track(self, camera_id: str, frame: np.ndarray, conf_threshold: float = 0.30) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
        """
        End-to-end frame processing:
        1. YOLO inference for raw vehicle detections
        2. Multi-Object Tracking (IoU MOT) association for persistent vehicle IDs (101, 102...)
        3. Approach modal breakdown counts
        """
        raw_dets = self.detect_vehicles(frame, conf_threshold)
        tracker = self.get_tracker(camera_id)
        tracked_objects = tracker.update(raw_dets)

        class_counts: Dict[str, int] = {}
        for obj in tracked_objects:
            lbl = obj["class_label"]
            class_counts[lbl] = class_counts.get(lbl, 0) + 1

        return tracked_objects, class_counts

cv_engine = CVEngine()
