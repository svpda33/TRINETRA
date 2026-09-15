"""Spatial-Temporal Vehicle Trajectory Reconstruction Engine for NexTrAI."""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models.db_models import DetectionModel, CameraModel
from app.services.gis_engine import gis_engine

logger = logging.getLogger("nextrai.trajectory")

class TrajectoryEngine:
    """Reconstructs city-wide vehicle journeys across geographically distributed cameras."""

    async def record_sighting(
        self,
        camera_id: str,
        plate_number: str,
        vehicle_class: str = "CAR",
        ocr_confidence: float = 0.90,
        speed_kmh: float = 40.0,
        snapshot_path: Optional[str] = None,
        heading: str = "EASTBOUND",
        track_id: int = 1
    ) -> Dict[str, Any]:
        """Persists an ANPR sighting event and links it to vehicle trajectory."""
        norm_plate = plate_number.replace(" ", "").upper()
        now = datetime.utcnow()

        async with AsyncSessionLocal() as session:
            detection = DetectionModel(
                camera_id=camera_id,
                track_id=track_id,
                vehicle_class=vehicle_class,
                plate_number=norm_plate,
                ocr_confidence=round(ocr_confidence, 3),
                speed_kmh=round(speed_kmh, 1),
                heading=heading,
                snapshot_path=snapshot_path,
                timestamp=now,
            )
            session.add(detection)
            await session.commit()
            await session.refresh(detection)
            det_id = detection.id

        return {
            "detection_id": det_id,
            "plate_number": norm_plate,
            "camera_id": camera_id,
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "vehicle_class": vehicle_class,
            "confidence": ocr_confidence,
        }

    async def get_vehicle_trajectory(self, plate_number: str) -> Optional[Dict[str, Any]]:
        """
        Reconstructs full spatial-temporal trajectory for a query license plate.
        Calculates inter-camera travel times, point-to-point speeds, and sequence hops.
        """
        norm_plate = plate_number.replace(" ", "").upper()

        async with AsyncSessionLocal() as session:
            stmt = (
                select(DetectionModel)
                .where(DetectionModel.plate_number == norm_plate)
                .order_by(DetectionModel.timestamp.asc())
            )
            res = await session.execute(stmt)
            sightings = res.scalars().all()

        if not sightings:
            return None

        # Build trajectory hops
        hops = []
        total_distance = 0.0
        coords_path = []

        for i, s in enumerate(sightings):
            parts = s.camera_id.split("_")
            j_id = parts[1] if len(parts) > 1 and parts[1] in gis_engine.JUNCTIONS else s.camera_id[:2]
            cam_info = gis_engine.JUNCTIONS.get(j_id, {})
            lat = cam_info.get("latitude", 17.4504)
            lon = cam_info.get("longitude", 78.3808)
            coords_path.append([lat, lon])

            hop_data = {
                "sequence_index": i + 1,
                "camera_id": s.camera_id,
                "intersection_name": cam_info.get("name", s.camera_id),
                "timestamp": s.timestamp.strftime("%H:%M:%S IST") if s.timestamp else "",
                "raw_timestamp": s.timestamp.isoformat() if s.timestamp else "",
                "latitude": lat,
                "longitude": lon,
                "speed_kmh": s.speed_kmh,
                "heading": s.heading,
                "vehicle_class": s.vehicle_class,
                "ocr_confidence": s.ocr_confidence,
                "snapshot_path": s.snapshot_path,
                "travel_time_seconds": 0,
                "segment_distance_meters": 0.0,
            }

            if i > 0:
                prev_s = sightings[i - 1]
                prev_parts = prev_s.camera_id.split("_")
                prev_j = prev_parts[1] if len(prev_parts) > 1 and prev_parts[1] in gis_engine.JUNCTIONS else prev_s.camera_id[:2]
                delta_t = (s.timestamp - prev_s.timestamp).total_seconds() if (s.timestamp and prev_s.timestamp) else 0
                dist = gis_engine.get_corridor_distance(prev_j, j_id)
                
                hop_data["travel_time_seconds"] = max(1, int(delta_t))
                hop_data["segment_distance_meters"] = dist
                total_distance += dist

                # Computed corridor speed = dist (m) / delta_t (s) * 3.6 (km/h)
                if delta_t > 0:
                    calculated_speed = round((dist / delta_t) * 3.6, 1)
                    hop_data["corridor_speed_kmh"] = calculated_speed

            hops.append(hop_data)

        first_seen = sightings[0].timestamp
        last_seen = sightings[-1].timestamp
        total_duration_sec = (last_seen - first_seen).total_seconds() if (last_seen and first_seen) else 0

        avg_speed = round((total_distance / max(1, total_duration_sec)) * 3.6, 1) if total_duration_sec > 0 else hops[-1]["speed_kmh"]

        last_parts = sightings[-1].camera_id.split("_")
        last_j = last_parts[1] if len(last_parts) > 1 and last_parts[1] in gis_engine.JUNCTIONS else sightings[-1].camera_id[:2]

        return {
            "plate_number": norm_plate,
            "formatted_plate": f"{norm_plate[:2]} {norm_plate[2:4]} {norm_plate[4:-4]} {norm_plate[-4:]}" if len(norm_plate) >= 9 else norm_plate,
            "vehicle_class": sightings[-1].vehicle_class,
            "total_sightings": len(sightings),
            "first_seen": first_seen.strftime("%H:%M:%S IST") if first_seen else "",
            "last_seen": last_seen.strftime("%H:%M:%S IST") if last_seen else "",
            "last_seen_camera": sightings[-1].camera_id,
            "current_location": gis_engine.JUNCTIONS.get(last_j, {}).get("name", sightings[-1].camera_id),
            "total_distance_meters": round(total_distance, 1),
            "average_speed_kmh": avg_speed,
            "path_coordinates": coords_path,
            "hops": hops,
            "snapshots": [h["snapshot_path"] for h in hops if h["snapshot_path"]],
        }

    async def get_recent_active_plates(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Returns most recently spotted vehicles across all cameras."""
        async with AsyncSessionLocal() as session:
            stmt = (
                select(DetectionModel)
                .order_by(DetectionModel.timestamp.desc())
                .limit(limit)
            )
            res = await session.execute(stmt)
            recent = res.scalars().all()

            return [
                {
                    "detection_id": r.id,
                    "plate_number": r.plate_number,
                    "camera_id": r.camera_id,
                    "vehicle_class": r.vehicle_class,
                    "ocr_confidence": r.ocr_confidence,
                    "speed_kmh": r.speed_kmh,
                    "heading": r.heading,
                    "snapshot_path": r.snapshot_path,
                    "timestamp": r.timestamp.strftime("%H:%M:%S IST") if r.timestamp else "",
                }
                for r in recent
            ]

trajectory_engine = TrajectoryEngine()
