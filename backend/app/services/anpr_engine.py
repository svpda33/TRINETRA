"""Real ANPR & License Plate Recognition Pipeline using EasyOCR and OpenCV."""

import os
import cv2
import time
import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from app.services.plate_validator import plate_validator
from app.services.watchlist_service import watchlist_service
from app.services.trajectory_engine import trajectory_engine
from app.db import SNAPSHOTS_DIR

logger = logging.getLogger("nextrai.anpr")

class ANPREngine:
    """Detects, crops, enhances, and recognizes Indian vehicle registration plates."""

    def __init__(self):
        self._reader = None
        self._is_reader_initialized = False

    def get_ocr_reader(self):
        """Lazy-loads EasyOCR model weights into memory."""
        if not self._is_reader_initialized or self._reader is None:
            logger.info("Initializing EasyOCR Reader (English Alphanumeric)...")
            import easyocr
            self._reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            self._is_reader_initialized = True
            logger.info("EasyOCR Reader loaded and ready.")
        return self._reader

    def enhance_plate_image(self, plate_crop: np.ndarray) -> np.ndarray:
        """
        Applies image preprocessing: Grayscale, Bilateral Filter, CLAHE, and adaptive thresholding
        to optimize character contrast under adverse lighting and glare.
        """
        if plate_crop is None or plate_crop.size == 0:
            return plate_crop

        # 1. Resize if too small (minimum height 40px for OCR accuracy)
        h, w = plate_crop.shape[:2]
        if h < 40 or w < 120:
            scale = max(40.0 / max(1, h), 120.0 / max(1, w))
            plate_crop = cv2.resize(plate_crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        # 2. Convert to Grayscale
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY) if len(plate_crop.shape) == 3 else plate_crop

        # 3. Bilateral Filter: Smooth texture while keeping character edges crisp
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)

        # 4. CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)

        return enhanced

    def extract_plate_candidate(self, vehicle_crop: np.ndarray) -> Optional[np.ndarray]:
        """
        Extracts license plate candidate from the bottom 45% of vehicle bounding box.
        Uses morphological operations to locate high-density rectangular character zones.
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return None

        h, w = vehicle_crop.shape[:2]
        # Focus on lower portion where license plate resides
        lower_y = int(h * 0.50)
        lower_crop = vehicle_crop[lower_y:h, 0:w]
        
        lh, lw = lower_crop.shape[:2]
        if lh < 20 or lw < 40:
            return lower_crop

        gray = cv2.cvtColor(lower_crop, cv2.COLOR_BGR2GRAY)
        
        # Morphological gradient to highlight edges of plate characters
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
        morph = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
        _, thresh = cv2.threshold(morph, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        best_crop = None
        best_score = 0.0

        for c in contours:
            x, y, cw, ch = cv2.boundingRect(c)
            aspect_ratio = float(cw) / max(1, float(ch))
            
            # Indian plates generally have aspect ratio 2.5 : 1 to 5.5 : 1
            if 2.2 <= aspect_ratio <= 5.8 and cw > (lw * 0.20) and ch > 14:
                area = cw * ch
                if area > best_score:
                    best_score = area
                    pad_x = int(cw * 0.05)
                    pad_y = int(ch * 0.05)
                    x1 = max(0, x - pad_x)
                    y1 = max(0, y - pad_y)
                    x2 = min(lw, x + cw + pad_x)
                    y2 = min(lh, y + ch + pad_y)
                    best_crop = lower_crop[y1:y2, x1:x2]

        return best_crop if best_crop is not None else lower_crop

    def read_plate(self, plate_img: np.ndarray) -> Tuple[str, float]:
        """
        Runs EasyOCR on enhanced plate image.
        Returns: (raw_ocr_text, confidence)
        """
        if plate_img is None or plate_img.size == 0:
            return "", 0.0

        reader = self.get_ocr_reader()
        enhanced = self.enhance_plate_image(plate_img)

        # Allowlist restricted to Indian alphanumeric characters
        results = reader.readtext(
            enhanced,
            allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
            paragraph=False,
            detail=1
        )

        if not results:
            return "", 0.0

        # Combine text segments ordered by horizontal X position
        sorted_results = sorted(results, key=lambda r: r[0][0][0])
        raw_text = "".join([r[1] for r in sorted_results])
        avg_conf = sum([float(r[2]) for r in sorted_results]) / len(sorted_results)

        return raw_text, avg_conf

    async def process_vehicle_anpr(
        self,
        camera_id: str,
        frame: np.ndarray,
        vehicle_det: Dict[str, Any],
        speed_kmh: float = 45.0,
        heading: str = "EASTBOUND"
    ) -> Optional[Dict[str, Any]]:
        """
        End-to-end pipeline:
        1. Crop vehicle
        2. Extract plate region
        3. Run EasyOCR
        4. Validate with Indian HSRP rules
        5. Save snapshot crop to disk
        6. Store sighting in DB & Trajectory
        7. Cross-reference Watchlist for automated security containment alert
        """
        x1, y1, x2, y2 = vehicle_det["bbox"]
        v_crop = frame[y1:y2, x1:x2]
        if v_crop.size == 0:
            return None

        plate_candidate = self.extract_plate_candidate(v_crop)
        if plate_candidate is None:
            plate_candidate = v_crop

        raw_text, ocr_conf = self.read_plate(plate_candidate)
        val_result = plate_validator.validate(raw_text, ocr_conf)

        if not val_result["is_valid"] and ocr_conf < 0.40:
            return None

        plate_num = val_result["plate_number"]
        timestamp_str = time.strftime("%Y%m%d_%H%M%S")
        snapshot_filename = f"{plate_num}_{camera_id}_{timestamp_str}.jpg"
        snapshot_path = os.path.join(SNAPSHOTS_DIR, snapshot_filename)
        web_snapshot_url = f"/snapshots/{snapshot_filename}"

        # Save plate crop to disk
        try:
            cv2.imwrite(snapshot_path, plate_candidate)
        except Exception as e:
            logger.warning(f"Failed to write plate snapshot {snapshot_path}: {e}")
            web_snapshot_url = None

        # Record sighting in database and trajectory engine
        await trajectory_engine.record_sighting(
            camera_id=camera_id,
            plate_number=plate_num,
            vehicle_class=vehicle_det.get("class_label", "CAR"),
            ocr_confidence=val_result["confidence"],
            speed_kmh=speed_kmh,
            snapshot_path=web_snapshot_url,
            heading=heading,
            track_id=vehicle_det.get("track_id", 1)
        )

        # Check against Watchlist
        watchlist_hit = await watchlist_service.check_plate(
            plate_number=plate_num,
            camera_id=camera_id,
            snapshot_path=web_snapshot_url
        )

        return {
            "plate_number": plate_num,
            "formatted_plate": val_result["formatted_plate"],
            "state_name": val_result.get("state_name", "Unknown"),
            "confidence": val_result["confidence"],
            "plate_type": val_result.get("plate_type", "STANDARD_HSRP"),
            "vehicle_class": vehicle_det.get("class_label", "CAR"),
            "camera_id": camera_id,
            "speed_kmh": speed_kmh,
            "heading": heading,
            "snapshot_url": web_snapshot_url,
            "watchlist_alert": watchlist_hit,
        }

anpr_engine = ANPREngine()
