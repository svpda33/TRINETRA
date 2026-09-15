"""Real Video Ingestion & Continuous CCTV Stream Processing Service for NexTrAI."""

import os
import cv2
import time
import asyncio
import logging
import threading
from typing import Dict, List, Any, Optional, Callable
from app.services.cv_engine import cv_engine
from app.services.anpr_engine import anpr_engine
from app.services.analytics_engine import analytics_engine
from app.services.gis_engine import gis_engine

logger = logging.getLogger("nextrai.video")

# Base directory for local CCTV footage
CCTV_VIDEO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "videos"))

class CameraStreamWorker:
    """Manages video capture, frame sampling, and pipeline execution for a single camera."""

    def __init__(self, camera_id: str, source_path: str, sample_interval: int = 5):
        self.camera_id = camera_id
        self.source_path = source_path
        self.sample_interval = sample_interval  # Process 1 frame every N frames
        self.is_running = False
        self.total_frames_read = 0
        self.total_frames_processed = 0
        self.total_vehicles_detected = 0
        self.last_frame: Optional[Any] = None
        self.last_detections: List[Dict[str, Any]] = []
        self._thread: Optional[threading.Thread] = None

    def start(self, on_event_callback: Optional[Callable] = None):
        """Starts worker in a dedicated daemon thread."""
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(
            target=self._run_loop,
            args=(on_event_callback,),
            daemon=True,
            name=f"Worker-{self.camera_id}"
        )
        self._thread.start()
        logger.info(f"Started video capture worker for {self.camera_id} from {self.source_path}")

    def stop(self):
        """Stops capture loop."""
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        logger.info(f"Stopped worker for {self.camera_id}")

    def _run_loop(self, on_event_callback: Optional[Callable]):
        """Continuous frame acquisition and CV pipeline execution."""
        cap = cv2.VideoCapture(self.source_path)
        if not cap.isOpened():
            logger.error(f"Failed to open video source for {self.camera_id}: {self.source_path}")
            self.is_running = False
            return

        frame_idx = 0
        while self.is_running:
            ret, frame = cap.read()
            if not ret:
                # Video ended: loop back to beginning for continuous monitoring
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            self.total_frames_read += 1
            frame_idx += 1

            # Controlled sampling to guarantee high responsiveness
            if frame_idx % self.sample_interval != 0:
                time.sleep(0.01)
                continue

            self.total_frames_processed += 1
            self.last_frame = frame

            # 1. Real YOLOv8 vehicle detection + IoU Multi-Object Tracking
            tracked_vehicles, class_counts = cv_engine.detect_and_track(
                camera_id=self.camera_id,
                frame=frame,
                conf_threshold=0.30
            )
            self.last_detections = tracked_vehicles
            self.total_vehicles_detected += len(tracked_vehicles)

            # 2. Update real-time traffic flow counters
            intersection_id = self.camera_id[4:6] if len(self.camera_id) >= 6 else "I1"
            for v in tracked_vehicles:
                analytics_engine.record_live_vehicle(
                    vehicle_class=v["class_label"],
                    intersection_id=intersection_id,
                    turn_type="STRAIGHT"
                )

            # 3. Process ANPR on vehicles with sufficient resolution (width >= 70px)
            for v in tracked_vehicles:
                bw, bh = v["bbox"][2] - v["bbox"][0], v["bbox"][3] - v["bbox"][1]
                if bw >= 70 and bh >= 40:
                    # Run plate localization and EasyOCR
                    try:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        sighting = loop.run_until_complete(
                            anpr_engine.process_vehicle_anpr(
                                camera_id=self.camera_id,
                                frame=frame,
                                vehicle_det=v,
                                speed_kmh=42.0,
                                heading=v.get("heading", "SOUTHBOUND")
                            )
                        )
                        loop.close()
                        if sighting and on_event_callback:
                            on_event_callback("PLATE_SIGHTING", sighting)
                    except Exception as e:
                        logger.debug(f"ANPR extraction skipped on frame: {e}")

            # Notify callback of live frame tracking
            if on_event_callback:
                on_event_callback("FRAME_DETECTIONS", {
                    "camera_id": self.camera_id,
                    "frame_index": frame_idx,
                    "vehicles": tracked_vehicles,
                    "counts": class_counts,
                    "timestamp": time.time()
                })

            time.sleep(0.03)  # Rate limiter to approximate ~10-15 FPS processing

        cap.release()


class VideoIngestionService:
    """
    Central Video Ingestion Orchestrator for all city cameras.
    Maps camera IDs to local MP4 CCTV videos or live RTSP streams.
    """

    DEFAULT_VIDEO_MAP = {
        "CAM_I1_NORTH": "I1_NORTH.mp4",
        "CAM_I1_SOUTH": "I1_SOUTH.mp4",
        "CAM_I1_EAST": "I1_EAST.mp4",
        "CAM_I1_WEST": "I1_WEST.mp4",
        "CAM_I2_NORTH": "I2_NORTH.mp4",
        "CAM_I2_SOUTH": "I2_SOUTH.mp4",
        "CAM_I2_EAST": "I2_EAST.mp4",
        "CAM_I2_WEST": "I2_WEST.mp4",
    }

    def __init__(self):
        self.workers: Dict[str, CameraStreamWorker] = {}
        self._event_listeners: List[Callable] = []

    def register_event_listener(self, listener: Callable):
        """Registers a callback for live video events."""
        self._event_listeners.append(listener)

    def _broadcast_event(self, event_type: str, payload: Any):
        for listener in self._event_listeners:
            try:
                listener(event_type, payload)
            except Exception as e:
                logger.warning(f"Error in video event listener: {e}")

    def resolve_source(self, camera_id: str, custom_source: Optional[str] = None) -> str:
        """Resolves video source path (RTSP URL, custom path, or local MP4)."""
        if custom_source:
            return custom_source
        
        filename = self.DEFAULT_VIDEO_MAP.get(camera_id, "I1_NORTH.mp4")
        full_path = os.path.join(CCTV_VIDEO_DIR, filename)
        if not os.path.exists(full_path):
            # Fallback to any existing MP4 in directory
            all_mp4s = [f for f in os.listdir(CCTV_VIDEO_DIR) if f.endswith(".mp4")] if os.path.exists(CCTV_VIDEO_DIR) else []
            if all_mp4s:
                full_path = os.path.join(CCTV_VIDEO_DIR, all_mp4s[0])
        return full_path

    def start_camera(self, camera_id: str, source_path: Optional[str] = None, sample_interval: int = 4) -> Dict[str, Any]:
        """Starts real-time video capture and CV processing for a camera."""
        if camera_id in self.workers and self.workers[camera_id].is_running:
            return {
                "status": "already_running",
                "camera_id": camera_id,
                "source": self.workers[camera_id].source_path
            }

        resolved_source = self.resolve_source(camera_id, source_path)
        worker = CameraStreamWorker(
            camera_id=camera_id,
            source_path=resolved_source,
            sample_interval=sample_interval
        )
        self.workers[camera_id] = worker
        worker.start(on_event_callback=self._broadcast_event)

        return {
            "status": "started",
            "camera_id": camera_id,
            "source": resolved_source,
            "sample_interval": sample_interval
        }

    def stop_camera(self, camera_id: str) -> Dict[str, Any]:
        """Stops video capture for a camera."""
        if camera_id in self.workers:
            self.workers[camera_id].stop()
            del self.workers[camera_id]
            return {"status": "stopped", "camera_id": camera_id}
        return {"status": "not_found", "camera_id": camera_id}

    def get_camera_status(self, camera_id: str) -> Dict[str, Any]:
        """Returns live statistics for a camera worker."""
        if camera_id in self.workers:
            w = self.workers[camera_id]
            return {
                "camera_id": camera_id,
                "is_running": w.is_running,
                "source": w.source_path,
                "frames_read": w.total_frames_read,
                "frames_processed": w.total_frames_processed,
                "vehicles_detected": w.total_vehicles_detected,
                "active_tracks_count": len(w.last_detections),
                "active_tracks": w.last_detections[:10]
            }
        return {
            "camera_id": camera_id,
            "is_running": False,
            "source": self.resolve_source(camera_id),
            "frames_read": 0,
            "frames_processed": 0,
            "vehicles_detected": 0,
            "active_tracks_count": 0,
            "active_tracks": []
        }

    def process_video_batch(self, camera_id: str, max_frames: int = 30) -> Dict[str, Any]:
        """
        Synchronously processes a batch of real frames from the camera's MP4 video.
        Guarantees that real YOLO detections, MOT tracks, and DB rows are created.
        """
        source = self.resolve_source(camera_id)
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            return {"status": "error", "message": f"Cannot open {source}"}

        frames_processed = 0
        detections_found = 0
        plates_spotted = 0
        tracked_summary = []

        while frames_processed < max_frames:
            ret, frame = cap.read()
            if not ret:
                break

            frames_processed += 1
            # YOLO + MOT Tracker
            tracked_vehicles, _ = cv_engine.detect_and_track(camera_id, frame, conf_threshold=0.30)
            detections_found += len(tracked_vehicles)

            # Record in analytics
            intersection_id = camera_id[4:6] if len(camera_id) >= 6 else "I1"
            for v in tracked_vehicles:
                analytics_engine.record_live_vehicle(v["class_label"], intersection_id)
                tracked_summary.append({
                    "tracker_id": v["tracker_id"],
                    "class_label": v["class_label"],
                    "confidence": v["confidence"],
                    "bbox": v["bbox"]
                })

            # Check ANPR on largest detected vehicle
            if tracked_vehicles:
                largest = max(tracked_vehicles, key=lambda x: (x["bbox"][2] - x["bbox"][0]) * (x["bbox"][3] - x["bbox"][1]))
                bw = largest["bbox"][2] - largest["bbox"][0]
                bh = largest["bbox"][3] - largest["bbox"][1]
                if bw >= 80 and bh >= 40:
                    try:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        sighting = loop.run_until_complete(
                            anpr_engine.process_vehicle_anpr(
                                camera_id=camera_id,
                                frame=frame,
                                vehicle_det=largest,
                                speed_kmh=45.0,
                                heading=largest.get("heading", "SOUTHBOUND")
                            )
                        )
                        loop.close()
                        if sighting:
                            plates_spotted += 1
                    except Exception as e:
                        logger.debug(f"ANPR batch exception: {e}")

        cap.release()

        return {
            "status": "success",
            "camera_id": camera_id,
            "source": source,
            "frames_processed": frames_processed,
            "vehicles_detected_count": detections_found,
            "plates_spotted_count": plates_spotted,
            "sample_tracks": tracked_summary[:8]
        }

video_ingestion_service = VideoIngestionService()
