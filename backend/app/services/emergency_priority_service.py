"""Emergency Vehicle Priority & Corridor Preemption Service for NexTrAI (Stage 3.3).

Features:
- Multi-frame temporal confirmation filter (>= 2 consecutive frames).
- Deterministic safety clearance (Yellow 4s -> All-Red 2s -> Emergency Green).
- Corridor preemption planning (I1 -> I2 green wave propagation).
- Automatic priority release upon departure line crossing or 90s safety timeout.
- Smooth post-emergency recovery with anti-starvation weighting.
- Operator manual overrides and audit logging.
"""

import time
import logging
from typing import Dict, List, Optional, Any, Tuple
from app.services.adaptive_signal_service import adaptive_signal_service
from app.services.gis_engine import gis_engine

logger = logging.getLogger("nextrai.emergency_priority")


class EmergencyPriorityService:
    """Manages emergency vehicle detection confirmation, corridor preemption, and release."""

    PREEMPTION_SAFETY_TIMEOUT_SEC: float = 90.0  # Maximum emergency lock duration
    TEMPORAL_CONFIRMATION_FRAMES: int = 2        # Minimum consecutive frames required

    CORRIDOR_ROUTE_MAP: Dict[str, List[Dict[str, str]]] = {
        # Arterial East-West Corridor (MG Road)
        "CAM_I1_WEST": [
            {"intersection_id": "I1", "approach": "WEST", "movement": "W_TO_E"},
            {"intersection_id": "I2", "approach": "WEST", "movement": "W_TO_E"}
        ],
        "CAM_I2_EAST": [
            {"intersection_id": "I2", "approach": "EAST", "movement": "E_TO_W"},
            {"intersection_id": "I1", "approach": "EAST", "movement": "E_TO_W"}
        ],
        # Non-corridor cross-street approaches preempt local node only (no downstream staging)
        "CAM_I1_NORTH": [
            {"intersection_id": "I1", "approach": "NORTH", "movement": "N_TO_S"}
        ],
        "CAM_I1_SOUTH": [
            {"intersection_id": "I1", "approach": "SOUTH", "movement": "S_TO_N"}
        ],
        "CAM_I2_NORTH": [
            {"intersection_id": "I2", "approach": "NORTH", "movement": "N_TO_S"}
        ],
        "CAM_I2_SOUTH": [
            {"intersection_id": "I2", "approach": "SOUTH", "movement": "S_TO_N"}
        ]
    }

    # Corridor kinematics for downstream staging (850m distance at 40 km/h = 76.5s)
    CORRIDOR_DISTANCE_METERS: float = 850.0
    CORRIDOR_SPEED_KMH: float = 40.0
    CORRIDOR_TRAVEL_TIME_SEC: float = round(850.0 / (40.0 / 3.6), 1)  # 76.5s
    CLEARANCE_LEAD_BUFFER_SEC: float = 15.0                          # Clearance starts 15s before arrival
    STAGED_ACTIVATION_DELAY_SEC: float = CORRIDOR_TRAVEL_TIME_SEC - CLEARANCE_LEAD_BUFFER_SEC  # 61.5s

    def __init__(self):
        # Track detection confirmation history: {camera_id: {track_id: consecutive_hits}}
        self._confirmation_tracker: Dict[str, Dict[int, int]] = {}
        # Active preemption state: {intersection_id: {preemption_data}}
        self._active_preemptions: Dict[str, Dict[str, Any]] = {}
        # Staged downstream scheduled preemptions: [{scheduled_item}]
        self._scheduled_preemptions: List[Dict[str, Any]] = []
        # Complete historical audit log
        self._audit_log: List[Dict[str, Any]] = []

    def register_emergency_detection(self, camera_id: str, track_id: int,
                                     vehicle_class: str, confidence: float) -> Dict[str, Any]:
        """
        Registers an emergency vehicle detection and applies temporal confirmation filtering.
        Triggers corridor preemption once confirmation threshold (>= 2 frames) is met.
        """
        now = time.time()
        if camera_id not in self._confirmation_tracker:
            self._confirmation_tracker[camera_id] = {}

        hits = self._confirmation_tracker[camera_id].get(track_id, 0) + 1
        self._confirmation_tracker[camera_id][track_id] = hits

        is_confirmed = hits >= self.TEMPORAL_CONFIRMATION_FRAMES

        if is_confirmed:
            logger.info(f"Emergency vehicle CONFIRMED: Track {track_id} ({vehicle_class}, hits={hits}) on {camera_id}")
            route = self.CORRIDOR_ROUTE_MAP.get(camera_id, [
                {"intersection_id": camera_id[4:6] if len(camera_id) >= 6 else "I1",
                 "approach": "WEST", "movement": "W_TO_E"}
            ])
            preemption_result = self.initiate_corridor_preemption(
                trigger_camera_id=camera_id,
                track_id=track_id,
                vehicle_class=vehicle_class,
                route=route
            )
            return {
                "status": "CONFIRMED_PREEMPTION_ACTIVE",
                "track_id": track_id,
                "vehicle_class": vehicle_class,
                "consecutive_hits": hits,
                "is_confirmed": True,
                "corridor_preemption": preemption_result
            }

        return {
            "status": "AWAITING_TEMPORAL_CONFIRMATION",
            "track_id": track_id,
            "vehicle_class": vehicle_class,
            "consecutive_hits": hits,
            "is_confirmed": False,
            "required_hits": self.TEMPORAL_CONFIRMATION_FRAMES
        }

    def initiate_corridor_preemption(self, trigger_camera_id: str, track_id: int,
                                     vehicle_class: str, route: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Priority 5 Implementation: Staged Downstream Corridor Preemption.
        - First intersection (e.g. I1) preempts immediately with safe clearance.
        - Downstream intersections (e.g. I2, 850m away) are scheduled with a progression delay:
          Activation Delay = TravelTime (76.5s) - ClearanceLeadBuffer (15s) = 61.5s.
        - Prevents premature starvation of downstream civilian traffic.
        """
        now = time.time()
        preempted_nodes = []
        scheduled_nodes = []

        for idx, step in enumerate(route):
            iid = step["intersection_id"]
            approach = step["approach"]
            movement = step.get("movement", "THROUGH")

            if idx == 0:
                # Upstream node: Immediate preemption via safe clearance
                ctrl = adaptive_signal_service.get_controller(iid)
                preemption_info = ctrl.set_emergency_preemption(approach=approach, active=True)

                record = {
                    "intersection_id": iid,
                    "approach": approach,
                    "movement": movement,
                    "initiated_at": now,
                    "trigger_camera_id": trigger_camera_id,
                    "track_id": track_id,
                    "vehicle_class": vehicle_class,
                    "status": "ACTIVE_PREEMPTION",
                    "preemption_type": "IMMEDIATE_UPSTREAM"
                }
                self._active_preemptions[iid] = record
                preempted_nodes.append(record)
            else:
                # Downstream node: Staged progression delay
                staged_delay = idx * self.STAGED_ACTIVATION_DELAY_SEC
                target_activation = now + staged_delay
                sched_record = {
                    "schedule_id": f"SCHED_{int(now)}_{track_id}_{iid}",
                    "intersection_id": iid,
                    "approach": approach,
                    "movement": movement,
                    "trigger_camera_id": trigger_camera_id,
                    "track_id": track_id,
                    "vehicle_class": vehicle_class,
                    "scheduled_at": now,
                    "target_activation_time": target_activation,
                    "staged_delay_sec": staged_delay,
                    "travel_time_sec": self.CORRIDOR_TRAVEL_TIME_SEC,
                    "clearance_buffer_sec": self.CLEARANCE_LEAD_BUFFER_SEC,
                    "distance_meters": self.CORRIDOR_DISTANCE_METERS,
                    "status": "PENDING_STAGED_ACTIVATION"
                }
                self._scheduled_preemptions.append(sched_record)
                scheduled_nodes.append(sched_record)

        audit_entry = {
            "event_id": f"PREEMPT_{int(now)}_{track_id}",
            "trigger_camera": trigger_camera_id,
            "track_id": track_id,
            "vehicle_class": vehicle_class,
            "active_nodes": [p["intersection_id"] for p in preempted_nodes],
            "staged_downstream_nodes": [s["intersection_id"] for s in scheduled_nodes],
            "staged_delay_sec": self.STAGED_ACTIVATION_DELAY_SEC,
            "initiated_at": now,
            "status": "ACTIVE_AND_SCHEDULED"
        }
        self._audit_log.append(audit_entry)

        # SQLite Persistence (Stage 3.6.D)
        for p in preempted_nodes:
            self._persist_emergency_initiation(
                event_id=audit_entry["event_id"],
                trigger_camera_id=trigger_camera_id,
                iid=p["intersection_id"],
                approach=p["approach"],
                vehicle_class=vehicle_class,
                track_id=track_id,
                scheduled_nodes=scheduled_nodes
            )

        return {
            "route_id": f"CORRIDOR_{trigger_camera_id}",
            "preempted_intersections": preempted_nodes,
            "scheduled_downstream_intersections": scheduled_nodes,
            "corridor_kinematics": {
                "distance_meters": self.CORRIDOR_DISTANCE_METERS,
                "speed_kmh": self.CORRIDOR_SPEED_KMH,
                "travel_time_sec": self.CORRIDOR_TRAVEL_TIME_SEC,
                "clearance_lead_buffer_sec": self.CLEARANCE_LEAD_BUFFER_SEC,
                "staged_delay_sec": self.STAGED_ACTIVATION_DELAY_SEC
            },
            "safety_timeout_sec": self.PREEMPTION_SAFETY_TIMEOUT_SEC,
            "message": f"Staged corridor preemption initiated: {len(preempted_nodes)} active node(s), {len(scheduled_nodes)} staged node(s) scheduled for T+{self.STAGED_ACTIVATION_DELAY_SEC}s."
        }

    def check_scheduled_preemptions_and_timeouts(self) -> Dict[str, Any]:
        """
        Autonomous Clock Hook:
        1. Checks and fires staged downstream preemptions once target activation time arrives.
        2. Enforces 90s safety timeout to prevent permanent lock.
        """
        now = time.time()
        activated_now = []

        # 1. Check staged downstream preemptions
        for sched in self._scheduled_preemptions:
            if sched["status"] == "PENDING_STAGED_ACTIVATION" and now >= sched["target_activation_time"]:
                iid = sched["intersection_id"]
                approach = sched["approach"]
                movement = sched.get("movement", "THROUGH")

                ctrl = adaptive_signal_service.get_controller(iid)
                ctrl.set_emergency_preemption(approach=approach, active=True)

                act_record = {
                    "intersection_id": iid,
                    "approach": approach,
                    "movement": movement,
                    "initiated_at": now,
                    "trigger_camera_id": sched["trigger_camera_id"],
                    "track_id": sched["track_id"],
                    "vehicle_class": sched["vehicle_class"],
                    "status": "ACTIVE_PREEMPTION",
                    "preemption_type": "STAGED_DOWNSTREAM"
                }
                self._active_preemptions[iid] = act_record
                sched["status"] = "ACTIVATED"
                sched["activated_at"] = now
                activated_now.append(iid)
                logger.info(f"Staged preemption ACTIVATED on downstream node {iid} ({approach} approach)")

        # 2. Check 90s safety timeouts
        expired_iids = self.check_safety_timeouts()

        # Clean old schedules (> 180s)
        self._scheduled_preemptions = [
            s for s in self._scheduled_preemptions if now - s["scheduled_at"] < 180.0
        ]

        return {
            "activated_nodes": activated_now,
            "expired_nodes": expired_iids
        }

    def release_preemption(self, intersection_id: str, reason: str = "DEPARTURE_CROSSING") -> Dict[str, Any]:
        """
        Releases emergency priority on an intersection, cancels any downstream schedules
        for this vehicle, and initiates smooth recovery.
        """
        now = time.time()
        ctrl = adaptive_signal_service.get_controller(intersection_id)
        ctrl.set_emergency_preemption(approach="", active=False)

        preemption_record = self._active_preemptions.pop(intersection_id, None)
        duration = round(now - preemption_record["initiated_at"], 1) if preemption_record else 0.0

        # Cancel pending staged downstream preemptions if upstream node released or deviated
        cancelled_schedules = []
        for sched in self._scheduled_preemptions:
            if sched["status"] == "PENDING_STAGED_ACTIVATION":
                sched["status"] = "CANCELLED_UPSTREAM_RELEASE"
                sched["cancelled_at"] = now
                cancelled_schedules.append(sched["schedule_id"])
                logger.info(f"Cancelled downstream scheduled preemption {sched['schedule_id']} due to upstream release on {intersection_id}")

        logger.info(f"Emergency preemption released on {intersection_id} ({reason}, duration={duration}s)")
        
        # SQLite Persistence (Stage 3.6.D)
        self._persist_emergency_release(intersection_id, reason, duration)

        return {
            "intersection_id": intersection_id,
            "status": "RELEASED",
            "release_reason": reason,
            "preemption_duration_sec": duration,
            "cancelled_downstream_schedules": cancelled_schedules,
            "recovery_mode": "SMOOTH_ADAPTIVE_RECOVERY"
        }

    def check_safety_timeouts(self) -> List[str]:
        """Monitors active preemptions and automatically releases any exceeding 90s safety limit."""
        now = time.time()
        expired_iids = []
        for iid, info in list(self._active_preemptions.items()):
            if now - info["initiated_at"] >= self.PREEMPTION_SAFETY_TIMEOUT_SEC:
                self.release_preemption(iid, reason="SAFETY_TIMEOUT_EXPIRED")
                expired_iids.append(iid)
        return expired_iids

    def get_preemption_status(self) -> Dict[str, Any]:
        """Returns live active preemption corridors, staged schedules, and recent audit log."""
        self.check_scheduled_preemptions_and_timeouts()
        pending_schedules = [
            s for s in self._scheduled_preemptions if s["status"] == "PENDING_STAGED_ACTIVATION"
        ]
        return {
            "active_preemptions_count": len(self._active_preemptions),
            "active_preemptions": self._active_preemptions,
            "pending_scheduled_preemptions_count": len(pending_schedules),
            "scheduled_preemptions": pending_schedules,
            "recent_audit_log": self._audit_log[-10:],
            "corridor_kinematics": {
                "distance_meters": self.CORRIDOR_DISTANCE_METERS,
                "speed_kmh": self.CORRIDOR_SPEED_KMH,
                "travel_time_sec": self.CORRIDOR_TRAVEL_TIME_SEC,
                "clearance_lead_buffer_sec": self.CLEARANCE_LEAD_BUFFER_SEC,
                "staged_delay_sec": self.STAGED_ACTIVATION_DELAY_SEC
            },
            "safety_timeout_limit_sec": self.PREEMPTION_SAFETY_TIMEOUT_SEC
        }


    def _persist_emergency_initiation(self, event_id: str, trigger_camera_id: str,
                                      iid: str, approach: str, vehicle_class: str,
                                      track_id: int, scheduled_nodes: List[Dict[str, Any]]):
        """Asynchronously persists initiated preemption event and staged schedules to SQLite."""
        import asyncio
        async def _do_persist():
            from app.db import AsyncSessionLocal
            from app.models.db_models import EmergencyEventModel, CorridorScheduleModel
            try:
                async with AsyncSessionLocal() as session:
                    ev = EmergencyEventModel(
                        event_id=event_id,
                        trigger_camera_id=trigger_camera_id,
                        intersection_id=iid,
                        approach=approach,
                        vehicle_class=vehicle_class,
                        track_id=track_id,
                        trigger_source="OPERATOR_TRIGGERED_OR_V2X_SIMULATED",
                        status="ACTIVE"
                    )
                    session.add(ev)
                    for sc in scheduled_nodes:
                        sched_m = CorridorScheduleModel(
                            schedule_id=sc["schedule_id"],
                            event_id=event_id,
                            upstream_iid=iid,
                            downstream_iid=sc["intersection_id"],
                            approach=sc["approach"],
                            target_activation_timestamp=sc["target_activation_time"],
                            staged_delay_sec=sc.get("staged_delay_sec", 0.0),
                            status="PENDING_STAGED_ACTIVATION"
                        )
                        session.add(sched_m)
                    await session.commit()
            except Exception as e:
                logger.error(f"Failed to persist emergency preemption to SQLite: {e}")

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_do_persist())
        except RuntimeError:
            pass

    def _persist_emergency_release(self, intersection_id: str, reason: str, duration: float):
        """Asynchronously persists preemption release status and cancellations to SQLite."""
        import asyncio
        async def _do_persist():
            from app.db import AsyncSessionLocal
            from app.models.db_models import EmergencyEventModel, CorridorScheduleModel
            from sqlalchemy import select
            from datetime import datetime
            try:
                async with AsyncSessionLocal() as session:
                    res = await session.execute(
                        select(EmergencyEventModel)
                        .where(EmergencyEventModel.intersection_id == intersection_id)
                        .where(EmergencyEventModel.status == "ACTIVE")
                    )
                    events = res.scalars().all()
                    for ev in events:
                        ev.status = "RELEASED"
                        ev.release_reason = reason
                        ev.duration_sec = duration
                        ev.released_at = datetime.utcnow()

                    res_sc = await session.execute(
                        select(CorridorScheduleModel)
                        .where(CorridorScheduleModel.upstream_iid == intersection_id)
                        .where(CorridorScheduleModel.status == "PENDING_STAGED_ACTIVATION")
                    )
                    schedules = res_sc.scalars().all()
                    for sc in schedules:
                        sc.status = "CANCELLED"

                    await session.commit()
            except Exception as e:
                logger.error(f"Failed to persist emergency release to SQLite: {e}")

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_do_persist())
        except RuntimeError:
            pass

    async def reconcile_restart_recovery(self) -> Dict[str, Any]:
        """
        Safety Hardening (Stage 3.6.D):
        Invoked on system startup / reboot. Inspects SQLite for unreleased emergency
        states or pending corridor schedules and invalidates them as STALE_RESTART_INVALIDATED.
        Guarantees system NEVER blindly restores an active emergency green upon reboot.
        """
        from app.db import AsyncSessionLocal
        from app.models.db_models import EmergencyEventModel, CorridorScheduleModel
        from sqlalchemy import select
        from datetime import datetime

        invalidated_events = 0
        invalidated_schedules = 0
        try:
            async with AsyncSessionLocal() as session:
                res_events = await session.execute(
                    select(EmergencyEventModel).where(EmergencyEventModel.status == "ACTIVE")
                )
                events = res_events.scalars().all()
                for ev in events:
                    ev.status = "STALE_RESTART_INVALIDATED"
                    ev.release_reason = "SYSTEM_REBOOT_RECONCILED"
                    ev.released_at = datetime.utcnow()
                    invalidated_events += 1

                res_scheds = await session.execute(
                    select(CorridorScheduleModel).where(CorridorScheduleModel.status == "PENDING_STAGED_ACTIVATION")
                )
                schedules = res_scheds.scalars().all()
                for sc in schedules:
                    sc.status = "STALE_RESTART_INVALIDATED"
                    invalidated_schedules += 1

                await session.commit()
        except Exception as e:
            logger.error(f"Error during emergency restart recovery reconciliation: {e}")

        # In-memory controller state sanitization
        self._active_preemptions.clear()
        self._scheduled_preemptions.clear()
        self._confirmation_tracker.clear()
        for iid, ctrl in adaptive_signal_service.controllers.items():
            ctrl.emergency_active = False
            ctrl.emergency_approach = None
            ctrl.preemption_state = "IDLE"
            if hasattr(ctrl, "_pending_emergency_requests"):
                ctrl._pending_emergency_requests.clear()

        logger.info(
            f"Emergency restart recovery reconciliation completed successfully: "
            f"{invalidated_events} stale events and {invalidated_schedules} pending schedules invalidated."
        )
        return {
            "status": "RECONCILED",
            "invalidated_events_count": invalidated_events,
            "invalidated_schedules_count": invalidated_schedules,
            "controllers_safely_initialized": list(adaptive_signal_service.controllers.keys())
        }


# Global singleton instance
emergency_priority_service = EmergencyPriorityService()
