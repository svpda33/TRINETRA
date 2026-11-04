"""Geometry configuration service & declarative registry for NexTrAI (Stage 3.1).

Loads and manages camera-specific spatial schemas, lane configurations,
duplicate camera detection, and independent observation filtering.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from app.models.geometry import (
    CameraGeometryConfig, CalibrationReadiness, AnchorStrategy
)

logger = logging.getLogger("nextrai.geometry")

DEFAULT_GEOMETRY_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "config", "geometry")
)


class GeometryService:
    """Manages declarative geometry configurations across all intersection cameras."""

    def __init__(self, config_dir: str = DEFAULT_GEOMETRY_DIR):
        self.config_dir = config_dir
        self._configs: Dict[str, CameraGeometryConfig] = {}
        self.load_all_configs()

    def load_all_configs(self, config_dir: Optional[str] = None) -> int:
        """Loads and validates all camera geometry JSON files in config directory."""
        target_dir = config_dir or self.config_dir
        if not os.path.exists(target_dir):
            logger.warning(f"Geometry config directory not found: {target_dir}")
            return 0

        loaded = 0
        for filename in sorted(os.listdir(target_dir)):
            if filename.endswith(".json") and filename.startswith("CAM_"):
                filepath = os.path.join(target_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        raw_data = json.load(f)
                    cfg = CameraGeometryConfig.model_validate(raw_data)
                    self._configs[cfg.camera_id] = cfg
                    loaded += 1
                except Exception as e:
                    logger.error(f"Failed to load geometry config from {filename}: {e}")

        logger.info(f"Loaded {loaded} camera geometry configuration(s) from {target_dir}")
        return loaded

    def get_camera_geometry(self, camera_id: str) -> Optional[CameraGeometryConfig]:
        """Returns geometry configuration for a specific camera ID."""
        return self._configs.get(camera_id)

    def get_all_geometries(self) -> Dict[str, CameraGeometryConfig]:
        """Returns all loaded camera geometry configurations."""
        return self._configs.copy()

    def get_independent_cameras(self, intersection_id: Optional[str] = None) -> List[CameraGeometryConfig]:
        """
        Returns list of cameras providing genuine independent visual observations.
        Excludes duplicates (e.g. CAM_I2_WEST) to prevent double-counting.
        """
        result = []
        for cfg in self._configs.values():
            if not cfg.source_identity.is_independent_observation or cfg.source_identity.is_duplicate:
                continue
            if intersection_id and cfg.intersection_id != intersection_id:
                continue
            result.append(cfg)
        return result

    def get_anchor_strategy(self, camera_id: str) -> AnchorStrategy:
        """Returns configured detection anchor strategy (TIRE_CONTACT vs CENTROID) for a camera."""
        cfg = self.get_camera_geometry(camera_id)
        if cfg:
            return cfg.anchor_strategy
        return AnchorStrategy.TIRE_CONTACT

    def get_calibration_summary(self) -> Dict[str, Any]:
        """Returns aggregate calibration readiness summary across all cameras."""
        summary = {
            "total_cameras": len(self._configs),
            "independent_cameras": len(self.get_independent_cameras()),
            "by_readiness": {
                CalibrationReadiness.READY.value: 0,
                CalibrationReadiness.PARTIAL.value: 0,
                CalibrationReadiness.NOT_READY.value: 0,
                CalibrationReadiness.DUPLICATE.value: 0
            },
            "calibrated_count": sum(1 for c in self._configs.values() if c.is_calibrated)
        }
        for cfg in self._configs.values():
            status_str = cfg.readiness_status.value
            summary["by_readiness"][status_str] = summary["by_readiness"].get(status_str, 0) + 1
        return summary


geometry_service = GeometryService()
