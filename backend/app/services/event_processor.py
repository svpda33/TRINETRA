"""Multi-Event Priority Conflict Resolution Engine."""

import logging
from typing import List, Dict, Any, Tuple
from app.models.priority import PriorityCategory
from app.config import settings

logger = logging.getLogger("syncsignal.event_processor")

class EventProcessorService:
    """Evaluates competing priority events and resolves multi-intersection signal actions."""

    def resolve_conflicts(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Sorts active events by priority rank and determines winning preemption plan.
        Priority Hierarchy:
          1. EMERGENCY_VEHICLE (Rank 1)
          2. VULNERABLE_ROAD_USER (Rank 2)
          3. WANTED_VEHICLE (Rank 3)
          4. ACCIDENT (Rank 4)
          5. TRANSIT (Rank 5)
          6. SURGE_CORRIDOR (Rank 6)
        """
        if not events:
            return {
                "winning_event": None,
                "action": "BASELINE_COORDINATED_TIMERS",
                "resolution": "No priority events active. Standard 90s signal cycle."
            }

        # Rank lookup
        def get_rank(evt):
            cat = evt.get("category", "NORMAL")
            return settings.PRIORITY_HIERARCHY.get(cat, {}).get("rank", 99)

        sorted_events = sorted(events, key=get_rank)
        winner = sorted_events[0]
        winner_cat = winner.get("category")

        if winner_cat == "EMERGENCY_VEHICLE":
            return {
                "winning_event": winner,
                "action": "EMERGENCY_GREEN_WAVE_PREEMPTION",
                "resolution": f"Resolved Priority 1 (EMERGENCY_VEHICLE). Preempting all cross-street signals along corridor. Opposing traffic held at RED."
            }
        elif winner_cat == "VULNERABLE_ROAD_USER":
            return {
                "winning_event": winner,
                "action": "PEDESTRIAN_CROSSING_EXTENSION",
                "resolution": f"Resolved Priority 2 (VULNERABLE_ROAD_USER). Pedestrian walk phase extended by +25 seconds. All vehicle approaches locked RED."
            }
        elif winner_cat == "WANTED_VEHICLE":
            return {
                "winning_event": winner,
                "action": "POLICE_CONTAINMENT_TRAP",
                "resolution": f"Resolved Priority 3 (WANTED_VEHICLE). Downstream signal nodes set to ALL_RED containment grid."
            }

        return {
            "winning_event": winner,
            "action": "STANDARD_PRIORITY_OVERRIDE",
            "resolution": f"Resolved Priority {get_rank(winner)} ({winner_cat}). Signal timing adjusted."
        }

event_processor = EventProcessorService()
