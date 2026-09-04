"""Real-Time Signal Coordination & Movement Simulation Engine."""

import asyncio
import time
import logging
from typing import List, Dict, Any, Optional, Set
from app.models.intersection import (
    Intersection, SignalState, SignalColor, DirectionPhase,
    QueueDensity, CongestionLevel, ActiveEvent, NetworkTopology, DetailedMovementState
)
from app.models.priority import PriorityCategory
from app.services.safety_validator import safety_validator
from app.services.event_processor import event_processor
from app.config import settings

logger = logging.getLogger("syncsignal.simulation")

class SimulationEngine:
    """Manages real-time dynamic signal cycle progression, vehicle density timing, and network coordination across I1 & I2."""

    def __init__(self):
        self.is_running: bool = False
        self.active_events: List[ActiveEvent] = []
        self.listeners: Set[asyncio.Queue] = set()
        self._task: Optional[asyncio.Task] = None
        
        # Intersections I1 and I2 ONLY
        self.intersections: Dict[str, Intersection] = {
            "I1": Intersection(
                intersection_id="I1",
                name="Main St & 1st Ave",
                latitude=37.7749,
                longitude=-122.4194,
                signal_state=SignalState(),
                current_phase=DirectionPhase.NORTH_APPROACH,
                active_approach="NORTH",
                permitted_movements=["N → S", "N → E", "N → W"],
                active_movements=["N → S", "N → E", "N → W"],
                active_movement_ids=["N_TO_S", "N_TO_E", "N_TO_W"],
                active_movement_group="NORTH APPROACH GREEN PHASE",
                other_approaches_status="SOUTH: RED | EAST: RED | WEST: RED",
                queue_density=[
                    QueueDensity(direction="NORTH_SOUTH", vehicle_count=22, average_speed_kmh=35.0, congestion_level=CongestionLevel.HIGH),
                    QueueDensity(direction="EAST_WEST", vehicle_count=8, average_speed_kmh=42.0, congestion_level=CongestionLevel.LOW),
                ],
                neighboring_intersections=["I2"],
                active_events=[],
                current_priority=PriorityCategory.NORMAL
            ),
            "I2": Intersection(
                intersection_id="I2",
                name="Main St & 2nd Ave",
                latitude=37.7759,
                longitude=-122.4184,
                signal_state=SignalState(),
                current_phase=DirectionPhase.SOUTH_APPROACH,
                active_approach="SOUTH",
                permitted_movements=["S → N", "S → E", "S → W"],
                active_movements=["S → N", "S → E", "S → W"],
                active_movement_ids=["S_TO_N", "S_TO_E", "S_TO_W"],
                active_movement_group="SOUTH APPROACH GREEN PHASE",
                other_approaches_status="NORTH: RED | EAST: RED | WEST: RED",
                queue_density=[
                    QueueDensity(direction="NORTH_SOUTH", vehicle_count=18, average_speed_kmh=22.0, congestion_level=CongestionLevel.MEDIUM),
                    QueueDensity(direction="EAST_WEST", vehicle_count=14, average_speed_kmh=30.0, congestion_level=CongestionLevel.LOW),
                ],
                neighboring_intersections=["I1"],
                active_events=[],
                current_priority=PriorityCategory.NORMAL
            ),
        }
        
        # State tracking for dynamic density signal controller per intersection
        self.approaches_order = ["NORTH", "SOUTH", "EAST", "WEST"]
        self.controller_state: Dict[str, Dict[str, Any]] = {
            "I1": {
                "approach_idx": 0,           # Start on NORTH
                "phase_state": "GREEN",       # GREEN, YELLOW, ALL_RED
                "state_elapsed": 0,           # seconds spent in current phase_state
                "green_duration": 30,         # dynamically calculated based on approach density
                "densities": {"NORTH": 75, "SOUTH": 20, "EAST": 50, "WEST": 15}
            },
            "I2": {
                "approach_idx": 1,           # Start on SOUTH
                "phase_state": "GREEN",
                "state_elapsed": 0,
                "green_duration": 25,
                "densities": {"NORTH": 30, "SOUTH": 65, "EAST": 20, "WEST": 40}
            }
        }

    def _calc_green_duration(self, density_percent: float) -> int:
        """Calculates dynamic green duration from approach vehicle density score (10s to 45s)."""
        min_g = settings.MIN_GREEN_TIME
        max_g = settings.MAX_GREEN_TIME
        ratio = max(0.0, min(1.0, density_percent / 100.0))
        return int(min_g + ratio * (max_g - min_g))

    def get_topology(self) -> NetworkTopology:
        corridors = []
        active_emergencies = [e for e in self.active_events if e.is_active and e.category == PriorityCategory.EMERGENCY_VEHICLE]

        if active_emergencies:
            corridors.append({
                "corridor_id": "GREEN_WAVE_01",
                "name": "MAIN STREET TRAFFIC CORRIDOR (NODES I1 ↔ I2)",
                "nodes": ["I1", "I2"],
                "status": "ACTIVE_PROTECTED_CORRIDOR"
            })
        else:
            corridors.append({
                "corridor_id": "MAIN_CORRIDOR",
                "name": "MAIN STREET TRAFFIC CORRIDOR (NODES I1 ↔ I2)",
                "nodes": ["I1", "I2"],
                "status": "BIDIRECTIONAL REAL-TIME TELEMETRY"
            })
            
        return NetworkTopology(
            intersections=list(self.intersections.values()),
            total_intersections=len(self.intersections),
            active_corridors=corridors
        )

    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.listeners.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.listeners.discard(queue)

    async def broadcast_state(self):
        state_data = self.get_topology().model_dump()
        for q in list(self.listeners):
            try:
                await q.put(state_data)
            except Exception:
                pass

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._run_loop())

    def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _run_loop(self):
        while self.is_running:
            try:
                await asyncio.sleep(1.0)
                self._tick()
                await self.broadcast_state()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}")

    def _tick(self):
        from app.services.cv_detector import cv_detector

        # Advance YOLO frame-by-frame tracking & corridor state
        tracking_data = cv_detector.tick_tracking()

        active_emergencies = [e for e in self.active_events if e.is_active and e.category == PriorityCategory.EMERGENCY_VEHICLE]

        # Auto-trigger tracking if emergency event exists but tracker is idle
        if active_emergencies and not cv_detector.is_tracking_active():
            evt = active_emergencies[0]
            t_node = getattr(evt, "target_node", "I1") or "I1"
            t_app = getattr(evt, "approach", "NORTH") or "NORTH"
            tracking_data = cv_detector.start_ambulance_tracking(f"CAM_{t_node}_{t_app}")

        active_dict_list = [e.model_dump() for e in self.active_events if e.is_active]
        conflict_res = event_processor.resolve_conflicts(active_dict_list)
        winning_action = conflict_res.get("action")

        for node_id, node in self.intersections.items():
            ctrl = self.controller_state[node_id]
            ctrl["state_elapsed"] += 1
            elapsed = ctrl["state_elapsed"]
            phase_state = ctrl["phase_state"]

            ai_proposed_ids = []
            yellow_ids = []
            ai_log_context = "Dynamic Density Signal Cycle"

            # Resolve per-node emergency preemption target approach from tracking telemetry
            node_emergency_approach = None

            if tracking_data:
                stage = tracking_data.get("corridor_stage")
                if stage == "APPROACHING_I1" and node_id == "I1":
                    node_emergency_approach = tracking_data.get("approach", "NORTH")
                elif stage in ("TRANSITIONING_TO_I2", "APPROACHING_I2"):
                    if node_id == "I2":
                        node_emergency_approach = "WEST"
                    elif node_id == "I1":
                        node_emergency_approach = None
            elif active_emergencies:
                evt = active_emergencies[0]
                t_node = getattr(evt, "target_node", "I1") or "I1"
                if t_node == node_id or node_id == "I1":
                    node_emergency_approach = getattr(evt, "approach", "NORTH") or "NORTH"

            if node_emergency_approach:
                target_approach = node_emergency_approach
                node.current_priority = PriorityCategory.EMERGENCY_VEHICLE
                
                # Directly align signal controller to emergency approach on GREEN so green light starts with ambulance video
                ctrl["approach_idx"] = self.approaches_order.index(target_approach)
                ctrl["phase_state"] = "GREEN"
                phase_state = "GREEN"

                ai_proposed_ids = {
                    "NORTH": ["N_TO_S", "N_TO_E", "N_TO_W"],
                    "SOUTH": ["S_TO_N", "S_TO_E", "S_TO_W"],
                    "EAST": ["E_TO_W", "E_TO_N", "E_TO_S"],
                    "WEST": ["W_TO_E", "W_TO_N", "W_TO_S"],
                }.get(target_approach, ["N_TO_S", "N_TO_E", "N_TO_W"])
                ai_log_context = f"P1 Emergency Preemption Active: Node {node_id} ({target_approach} Approach) Green Wave Authorized"

            else:
                # Normal Dynamic Density-Based Signal Cycle Progression
                node.current_priority = PriorityCategory.NORMAL
                curr_approach = self.approaches_order[ctrl["approach_idx"]]
                current_density = ctrl["densities"].get(curr_approach, 40)
                ctrl["green_duration"] = self._calc_green_duration(current_density)
                target_green = ctrl["green_duration"]

                if phase_state == "GREEN":
                    if elapsed >= target_green:
                        ctrl["phase_state"] = "YELLOW"
                        ctrl["state_elapsed"] = 0
                        phase_state = "YELLOW"
                        yellow_ids = {
                            "NORTH": ["N_TO_S", "N_TO_E", "N_TO_W"],
                            "SOUTH": ["S_TO_N", "S_TO_E", "S_TO_W"],
                            "EAST": ["E_TO_W", "E_TO_N", "E_TO_S"],
                            "WEST": ["W_TO_E", "W_TO_N", "W_TO_S"],
                        }.get(curr_approach, [])
                    else:
                        ai_proposed_ids = {
                            "NORTH": ["N_TO_S", "N_TO_E", "N_TO_W"],
                            "SOUTH": ["S_TO_N", "S_TO_E", "S_TO_W"],
                            "EAST": ["E_TO_W", "E_TO_N", "E_TO_S"],
                            "WEST": ["W_TO_E", "W_TO_N", "W_TO_S"],
                        }.get(curr_approach, [])
                        ai_log_context = f"Dynamic Density Cycle: {curr_approach} Approach (Density: {current_density}%, Green: {target_green}s)"

                elif phase_state == "YELLOW":
                    if elapsed >= settings.YELLOW_TIME:
                        ctrl["phase_state"] = "ALL_RED"
                        ctrl["state_elapsed"] = 0
                        phase_state = "ALL_RED"
                        ai_proposed_ids = []
                    else:
                        yellow_ids = {
                            "NORTH": ["N_TO_S", "N_TO_E", "N_TO_W"],
                            "SOUTH": ["S_TO_N", "S_TO_E", "S_TO_W"],
                            "EAST": ["E_TO_W", "E_TO_N", "E_TO_S"],
                            "WEST": ["W_TO_E", "W_TO_N", "W_TO_S"],
                        }.get(curr_approach, [])
                        ai_log_context = f"Yellow Clearance Transition: {curr_approach} Approach"

                elif phase_state == "ALL_RED":
                    if elapsed >= settings.ALL_RED_TIME:
                        ctrl["approach_idx"] = (ctrl["approach_idx"] + 1) % 4
                        next_approach = self.approaches_order[ctrl["approach_idx"]]
                        ctrl["green_duration"] = self._calc_green_duration(ctrl["densities"].get(next_approach, 40))
                        ctrl["phase_state"] = "GREEN"
                        ctrl["state_elapsed"] = 0
                        phase_state = "GREEN"
                        curr_approach = next_approach
                        ai_proposed_ids = {
                            "NORTH": ["N_TO_S", "N_TO_E", "N_TO_W"],
                            "SOUTH": ["S_TO_N", "S_TO_E", "S_TO_W"],
                            "EAST": ["E_TO_W", "E_TO_N", "E_TO_S"],
                            "WEST": ["W_TO_E", "W_TO_N", "W_TO_S"],
                        }.get(curr_approach, [])
                        ai_log_context = f"Dynamic Density Cycle: {curr_approach} Approach Started"
                    else:
                        ai_proposed_ids = []
                        ai_log_context = "All-Red Clearance Buffer Active"

            # Deterministic Movement Safety Validator Execution
            is_safe, val_msg, conflicting_pairs, resolved_phase = safety_validator.validate_signal_plan(ai_proposed_ids)

            approved_ids = resolved_phase.get("movement_ids", [])
            approved_labels = resolved_phase.get("movements", [])
            node.current_phase = resolved_phase.get("phase", DirectionPhase.NORTH_APPROACH)
            node.active_approach = self.approaches_order[ctrl["approach_idx"]] if phase_state == "GREEN" else "NONE"
            node.permitted_movements = approved_labels
            node.active_movement_ids = approved_ids
            node.active_movements = approved_labels
            node.yellow_movements = [safety_validator.ID_TO_LABEL.get(m, m) for m in yellow_ids]
            node.active_movement_group = resolved_phase.get("name", f"{node.active_approach} APPROACH GREEN PHASE")
            node.other_approaches_status = resolved_phase.get("other_approaches_status", "OTHER APPROACHES: RED")
            node.is_clearance_active = (len(approved_ids) == 0 and len(yellow_ids) == 0)
            node.safety_validation_status = "VALIDATED" if is_safe else "REJECTED → FALLBACK APPLIED"
            node.conflict_check_detail = val_msg
            
            # Expose dynamic timing state on node metadata
            curr_app = self.approaches_order[ctrl["approach_idx"]]
            tot_dur = ctrl["green_duration"] if phase_state == "GREEN" else (settings.YELLOW_TIME if phase_state == "YELLOW" else settings.ALL_RED_TIME)
            rem_sec = max(0, tot_dur - ctrl["state_elapsed"])
            
            node.timer_state = phase_state
            node.timer_remaining = rem_sec
            node.timer_total = tot_dur
            node.approach_densities = ctrl["densities"]
            
            proposed_str = ", ".join(ai_proposed_ids) if ai_proposed_ids else ("YELLOW_TRANSITION" if yellow_ids else "ALL_RED_CLEARANCE")
            node.ai_recommendation_trace = f"{ai_log_context} → Proposed: [{proposed_str}] → Validator: {'APPROVED' if is_safe else 'REJECTED'}"

            # Update 12-movement lamp states
            det = DetailedMovementState()
            det.n_to_s = SignalColor.YELLOW if "N_TO_S" in yellow_ids else (SignalColor.GREEN if "N_TO_S" in approved_ids else SignalColor.RED)
            det.n_to_e = SignalColor.YELLOW if "N_TO_E" in yellow_ids else (SignalColor.GREEN if "N_TO_E" in approved_ids else SignalColor.RED)
            det.n_to_w = SignalColor.YELLOW if "N_TO_W" in yellow_ids else (SignalColor.GREEN if "N_TO_W" in approved_ids else SignalColor.RED)

            det.s_to_n = SignalColor.YELLOW if "S_TO_N" in yellow_ids else (SignalColor.GREEN if "S_TO_N" in approved_ids else SignalColor.RED)
            det.s_to_e = SignalColor.YELLOW if "S_TO_E" in yellow_ids else (SignalColor.GREEN if "S_TO_E" in approved_ids else SignalColor.RED)
            det.s_to_w = SignalColor.YELLOW if "S_TO_W" in yellow_ids else (SignalColor.GREEN if "S_TO_W" in approved_ids else SignalColor.RED)

            det.e_to_w = SignalColor.YELLOW if "E_TO_W" in yellow_ids else (SignalColor.GREEN if "E_TO_W" in approved_ids else SignalColor.RED)
            det.e_to_n = SignalColor.YELLOW if "E_TO_N" in yellow_ids else (SignalColor.GREEN if "E_TO_N" in approved_ids else SignalColor.RED)
            det.e_to_s = SignalColor.YELLOW if "E_TO_S" in yellow_ids else (SignalColor.GREEN if "E_TO_S" in approved_ids else SignalColor.RED)

            det.w_to_e = SignalColor.YELLOW if "W_TO_E" in yellow_ids else (SignalColor.GREEN if "W_TO_E" in approved_ids else SignalColor.RED)
            det.w_to_n = SignalColor.YELLOW if "W_TO_N" in yellow_ids else (SignalColor.GREEN if "W_TO_N" in approved_ids else SignalColor.RED)
            det.w_to_s = SignalColor.YELLOW if "W_TO_S" in yellow_ids else (SignalColor.GREEN if "W_TO_S" in approved_ids else SignalColor.RED)

            det.pedestrian = SignalColor.GREEN if "PEDESTRIAN_WALK" in approved_ids else SignalColor.RED

            node.signal_state.detailed_movements = det

            # Synchronize direction indicators
            node.signal_state.movements.n_to_s = det.n_to_s
            node.signal_state.movements.s_to_n = det.s_to_n
            node.signal_state.movements.e_to_w = det.e_to_w
            node.signal_state.movements.w_to_e = det.w_to_e
            node.signal_state.movements.pedestrian = det.pedestrian

            node.signal_state.north_south = det.n_to_s
            node.signal_state.east_west = det.e_to_w
            node.signal_state.pedestrian = det.pedestrian

    def trigger_event(self, category: str, target_node: str = "I1", approach: str = "NORTH") -> ActiveEvent:
        cat_enum = PriorityCategory(category)
        timestamp_str = time.strftime("%H:%M:%S IST")
        
        event_titles = {
            PriorityCategory.EMERGENCY_VEHICLE: f"Ambulance #102 Approaching from {approach}",
            PriorityCategory.VULNERABLE_ROAD_USER: "Pedestrian Crowd Crossing Intersection",
            PriorityCategory.WANTED_VEHICLE: "ANPR Match: Flagged Suspect Vehicle",
            PriorityCategory.ACCIDENT: "Two-Vehicle Collision in Intersection Box",
            PriorityCategory.TRANSIT: "Express City Bus #45 Extended Priority Request",
            PriorityCategory.SURGE_CORRIDOR: "VIP Evacuation Motorcade Green Wave",
        }
        
        event = ActiveEvent(
            event_id=f"EVT-{int(time.time())}",
            category=cat_enum,
            title=event_titles.get(cat_enum, "Simulated Traffic Incident"),
            description=f"Priority {cat_enum.value} detected at {target_node} ({approach} Approach). Coordinated signal preemption requested.",
            timestamp=timestamp_str,
            source=f"CAM_{target_node}_{approach}",
            is_active=True
        )
        setattr(event, "approach", approach)
        setattr(event, "target_node", target_node)
        
        self.active_events.insert(0, event)
        if target_node in self.intersections:
            self.intersections[target_node].active_events.insert(0, event)
            self.intersections[target_node].current_priority = cat_enum

        if cat_enum == PriorityCategory.EMERGENCY_VEHICLE:
            from app.services.cv_detector import cv_detector
            cv_detector.start_ambulance_tracking(f"CAM_{target_node}_{approach}")

        logger.info(f"Triggered priority event {event.event_id}: {event.category} at {target_node} ({approach})")
        return event

    def clear_events(self):
        from app.services.cv_detector import cv_detector
        cv_detector.clear_detections()

        self.active_events.clear()
        for node_id, node in self.intersections.items():
            node.active_events.clear()
            node.current_priority = PriorityCategory.NORMAL
            node.current_phase = DirectionPhase.NORTH_APPROACH
            node.active_approach = "NORTH"
            node.permitted_movements = ["N → S", "N → E", "N → W"]
            ctrl = self.controller_state[node_id]
            ctrl["phase_state"] = "GREEN"
            ctrl["state_elapsed"] = 0
            ctrl["approach_idx"] = 0
        logger.info("Cleared all simulation events.")

simulation_engine = SimulationEngine()
