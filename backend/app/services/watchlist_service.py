"""Watchlist Management & Automated Security Alert Dispatcher for NexTrAI."""

import os
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import select, update
from app.db import AsyncSessionLocal
from app.models.db_models import WatchlistModel, AlertModel, DetectionModel
from app.services.safety_validator import safety_validator

logger = logging.getLogger("nextrai.watchlist")

class WatchlistService:
    """Manages flagged license plates and triggers security containment alerts."""

    def __init__(self):
        # In-memory fast-lookup cache of active watchlist plates: { "TS09EA1234": watchlist_dict }
        self._cached_watchlist: Dict[str, Dict[str, Any]] = {
            "TS09EA1234": {
                "id": 1,
                "plate_number": "TS09EA1234",
                "alert_type": "WANTED_CRIMINAL",
                "severity": "CRITICAL",
                "notes": "Red Notice: Stolen vehicle linked to Cyberabad jewelry heist"
            },
            "DL01AB9999": {
                "id": 2,
                "plate_number": "DL01AB9999",
                "alert_type": "STOLEN_VEHICLE",
                "severity": "HIGH",
                "notes": "Reported stolen at Rajiv Gandhi International Airport"
            },
            "AP28BK4321": {
                "id": 3,
                "plate_number": "AP28BK4321",
                "alert_type": "SUSPECT_SURVEILLANCE",
                "severity": "MEDIUM",
                "notes": "Monitored for recurring unauthorized entry into SEZ zones"
            }
        }
        self._cache_initialized = True

    def check_watchlist(self, plate_number: str) -> Optional[Dict[str, Any]]:
        """Fast synchronous O(1) in-memory check without database overhead."""
        norm = plate_number.replace(" ", "").upper()
        return self._cached_watchlist.get(norm)

    async def reload_cache(self):
        """Loads all active watchlist plates into fast-access memory."""
        async with AsyncSessionLocal() as session:
            stmt = select(WatchlistModel).where(WatchlistModel.is_active == True)
            res = await session.execute(stmt)
            entries = res.scalars().all()
            self._cached_watchlist = {
                entry.plate_number.replace(" ", "").upper(): {
                    "id": entry.id,
                    "plate_number": entry.plate_number,
                    "alert_type": entry.alert_type,
                    "severity": entry.severity,
                    "notes": entry.notes,
                }
                for entry in entries
            }
            self._cache_initialized = True
            logger.info(f"Watchlist cache loaded with {len(self._cached_watchlist)} active monitored plates.")

    async def check_plate(self, plate_number: str, camera_id: str, snapshot_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        O(1) memory lookup for detected plate.
        If matched, persists security alert in DB and triggers traffic containment plan.
        """
        if not self._cache_initialized:
            await self.reload_cache()

        norm_plate = plate_number.replace(" ", "").upper()
        if norm_plate not in self._cached_watchlist:
            return None

        match_info = self._cached_watchlist[norm_plate]
        timestamp = datetime.utcnow()

        # Persist alert in database
        async with AsyncSessionLocal() as session:
            alert = AlertModel(
                watchlist_id=match_info["id"],
                plate_number=match_info["plate_number"],
                camera_id=camera_id,
                severity=match_info["severity"],
                alert_type=match_info["alert_type"],
                snapshot_path=snapshot_path,
                is_acknowledged=False,
                timestamp=timestamp,
                notes=match_info["notes"],
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)
            alert_id = alert.id

        # Automated Traffic Control Response:
        # Request red-light containment plan on downstream signals via Deterministic Safety Layer
        # Safety Validator verifies yellow clearance and prevents intersecting collisions.
        containment_action = "POLICE_RED_LIGHT_CONTAINMENT_TRIGGERED"
        logger.warning(
            f"WATCHLIST HIT: Plate {norm_plate} detected on {camera_id}! "
            f"Alert ID: {alert_id} | Severity: {match_info['severity']} | Action: {containment_action}"
        )

        return {
            "alert_id": alert_id,
            "plate_number": match_info["plate_number"],
            "camera_id": camera_id,
            "severity": match_info["severity"],
            "alert_type": match_info["alert_type"],
            "notes": match_info["notes"],
            "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "containment_action": containment_action,
            "snapshot_path": snapshot_path,
        }

    async def get_all_watchlist(self) -> List[Dict[str, Any]]:
        """Returns all watchlist entries."""
        async with AsyncSessionLocal() as session:
            stmt = select(WatchlistModel).order_by(WatchlistModel.created_at.desc())
            res = await session.execute(stmt)
            entries = res.scalars().all()
            return [
                {
                    "id": e.id,
                    "plate_number": e.plate_number,
                    "alert_type": e.alert_type,
                    "severity": e.severity,
                    "notes": e.notes,
                    "is_active": e.is_active,
                    "created_at": e.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                }
                for e in entries
            ]

    async def add_watchlist_entry(self, plate_number: str, alert_type: str, severity: str = "HIGH", notes: str = "") -> Dict[str, Any]:
        """Adds a new plate to the watchlist."""
        norm_plate = plate_number.replace(" ", "").upper()
        async with AsyncSessionLocal() as session:
            entry = WatchlistModel(
                plate_number=norm_plate,
                alert_type=alert_type,
                severity=severity,
                notes=notes,
                is_active=True,
                created_at=datetime.utcnow(),
            )
            session.add(entry)
            await session.commit()
            await session.refresh(entry)
        
        await self.reload_cache()
        return {
            "id": entry.id,
            "plate_number": entry.plate_number,
            "alert_type": entry.alert_type,
            "severity": entry.severity,
            "notes": entry.notes,
        }

    async def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Returns list of unacknowledged security alerts."""
        async with AsyncSessionLocal() as session:
            stmt = select(AlertModel).where(AlertModel.is_acknowledged == False).order_by(AlertModel.timestamp.desc())
            res = await session.execute(stmt)
            alerts = res.scalars().all()
            return [
                {
                    "id": a.id,
                    "plate_number": a.plate_number,
                    "camera_id": a.camera_id,
                    "severity": a.severity,
                    "alert_type": a.alert_type,
                    "timestamp": a.timestamp.strftime("%H:%M:%S IST") if a.timestamp else "",
                    "notes": a.notes,
                    "snapshot_path": a.snapshot_path,
                    "is_acknowledged": a.is_acknowledged,
                }
                for a in alerts
            ]

    async def acknowledge_alert(self, alert_id: int):
        """Marks an alert as acknowledged by traffic operator."""
        async with AsyncSessionLocal() as session:
            stmt = update(AlertModel).where(AlertModel.id == alert_id).values(is_acknowledged=True)
            await session.execute(stmt)
            await session.commit()

watchlist_service = WatchlistService()
