"""Deterministic 12-Movement Safety & Priority Validation Layer.

Architectural Rule:
The LLM / AI coordinator NEVER directly controls hardware signals.
Every proposed signal modification passes through this deterministic conflict validator.
Conflicting movements (e.g. S_TO_E left turn vs N_TO_S opposing straight) are REJECTED,
logging exact conflicting pairs and returning a safe fallback phase.
"""

from typing import Dict, Any, Tuple, List, Set
from app.models.intersection import SignalColor, DirectionPhase

class SafetyValidationError(Exception):
    """Exception raised when a signal transition violates safety constraints."""
    pass

class DeterministicSafetyValidator:
    """Validates proposed AI signal control decisions against immutable physical safety rules."""

    MIN_YELLOW_DURATION_SECONDS: int = 4
    MIN_ALL_RED_CLEARANCE_SECONDS: int = 2
    MIN_GREEN_DURATION_SECONDS: int = 10

    # Exhaustive Geometrical Conflict Matrix for 12 Vehicle Movements + Pedestrian Walk
    # Geometrical Conflict Matrix enforcing Exclusive Approach Control.
    # Every movement from an approach conflicts with ALL movements from all other approaches.
    FULL_MOVEMENT_CONFLICTS: Dict[str, Set[str]] = {
        # North Approach Movements (Conflict with all South, East, West movements)
        "N_TO_S": {"S_TO_N", "S_TO_E", "S_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},
        "N_TO_E": {"S_TO_N", "S_TO_E", "S_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},
        "N_TO_W": {"S_TO_N", "S_TO_E", "S_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},

        # South Approach Movements (Conflict with all North, East, West movements)
        "S_TO_N": {"N_TO_S", "N_TO_E", "N_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},
        "S_TO_E": {"N_TO_S", "N_TO_E", "N_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},
        "S_TO_W": {"N_TO_S", "N_TO_E", "N_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},

        # East Approach Movements (Conflict with all North, South, West movements)
        "E_TO_W": {"N_TO_S", "N_TO_E", "N_TO_W", "S_TO_N", "S_TO_E", "S_TO_W", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},
        "E_TO_N": {"N_TO_S", "N_TO_E", "N_TO_W", "S_TO_N", "S_TO_E", "S_TO_W", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},
        "E_TO_S": {"N_TO_S", "N_TO_E", "N_TO_W", "S_TO_N", "S_TO_E", "S_TO_W", "W_TO_E", "W_TO_N", "W_TO_S", "PEDESTRIAN_WALK"},

        # West Approach Movements (Conflict with all North, South, East movements)
        "W_TO_E": {"N_TO_S", "N_TO_E", "N_TO_W", "S_TO_N", "S_TO_E", "S_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "PEDESTRIAN_WALK"},
        "W_TO_N": {"N_TO_S", "N_TO_E", "N_TO_W", "S_TO_N", "S_TO_E", "S_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "PEDESTRIAN_WALK"},
        "W_TO_S": {"N_TO_S", "N_TO_E", "N_TO_W", "S_TO_N", "S_TO_E", "S_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "PEDESTRIAN_WALK"},

        # Pedestrian Walk (Conflicts with all vehicle movements)
        "PEDESTRIAN_WALK": {"N_TO_S", "N_TO_E", "N_TO_W", "S_TO_N", "S_TO_E", "S_TO_W", "E_TO_W", "E_TO_N", "E_TO_S", "W_TO_E", "W_TO_N", "W_TO_S"},
    }

    # Notation translation lookup
    ID_TO_LABEL: Dict[str, str] = {
        "N_TO_S": "N → S",
        "N_TO_E": "N → E",
        "N_TO_W": "N → W",
        "S_TO_N": "S → N",
        "S_TO_E": "S → E",
        "S_TO_W": "S → W",
        "E_TO_W": "E → W",
        "E_TO_N": "E → N",
        "E_TO_S": "E → S",
        "W_TO_E": "W → E",
        "W_TO_N": "W → N",
        "W_TO_S": "W → S",
        "PEDESTRIAN_WALK": "PEDESTRIAN_WALK",
    }

    # Predefined Safe Protected Movement Phases (Exclusive Approach 3-Movement Control)
    PREDEFINED_PHASES: Dict[str, Dict[str, Any]] = {
        "NORTH_APPROACH": {
            "name": "NORTH APPROACH GREEN PHASE",
            "approach": "NORTH",
            "movement_ids": ["N_TO_S", "N_TO_E", "N_TO_W"],
            "movements": ["N → S", "N → E", "N → W"],
            "other_approaches_status": "SOUTH: RED | EAST: RED | WEST: RED",
            "phase": DirectionPhase.NORTH_APPROACH,
        },
        "SOUTH_APPROACH": {
            "name": "SOUTH APPROACH GREEN PHASE",
            "approach": "SOUTH",
            "movement_ids": ["S_TO_N", "S_TO_E", "S_TO_W"],
            "movements": ["S → N", "S → E", "S → W"],
            "other_approaches_status": "NORTH: RED | EAST: RED | WEST: RED",
            "phase": DirectionPhase.SOUTH_APPROACH,
        },
        "EAST_APPROACH": {
            "name": "EAST APPROACH GREEN PHASE",
            "approach": "EAST",
            "movement_ids": ["E_TO_W", "E_TO_N", "E_TO_S"],
            "movements": ["E → W", "E → N", "E → S"],
            "other_approaches_status": "NORTH: RED | SOUTH: RED | WEST: RED",
            "phase": DirectionPhase.EAST_APPROACH,
        },
        "WEST_APPROACH": {
            "name": "WEST APPROACH GREEN PHASE",
            "approach": "WEST",
            "movement_ids": ["W_TO_E", "W_TO_N", "W_TO_S"],
            "movements": ["W → E", "W → N", "W → S"],
            "other_approaches_status": "NORTH: RED | SOUTH: RED | EAST: RED",
            "phase": DirectionPhase.WEST_APPROACH,
        },
        "PEDESTRIAN_EXCLUSIVE": {
            "name": "Protected Pedestrian Walk Phase",
            "approach": "PEDESTRIAN",
            "movement_ids": ["PEDESTRIAN_WALK"],
            "movements": ["PEDESTRIAN_WALK"],
            "other_approaches_status": "ALL VEHICLE APPROACHES: RED",
            "phase": DirectionPhase.PEDESTRIAN_EXCLUSIVE,
        },
        "ALL_RED_CLEARANCE": {
            "name": "CLEARANCE / ALL RED LOCK",
            "approach": "NONE",
            "movement_ids": [],
            "movements": [],
            "other_approaches_status": "ALL APPROACHES: RED",
            "phase": DirectionPhase.ALL_RED_CLEARANCE,
        }
    }

    def validate_signal_plan(self, proposed_movement_ids: List[str]) -> Tuple[bool, str, List[str], Dict[str, Any]]:
        """
        Validates proposed green movements against Exclusive Approach 3-Movement Control Rules.
        
        Returns:
            Tuple[bool, str, List[str], Dict]:
            (is_safe, validation_message, conflicting_pairs, resolved_safe_phase)
        """
        proposed_set = set(proposed_movement_ids)
        conflicting_pairs = []

        # Rule 1: ONLY ONE APPROACH MAY BE ACTIVE AT A TIME
        approach_groups = {
            "NORTH": {"N_TO_S", "N_TO_E", "N_TO_W"},
            "SOUTH": {"S_TO_N", "S_TO_E", "S_TO_W"},
            "EAST": {"E_TO_W", "E_TO_N", "E_TO_S"},
            "WEST": {"W_TO_E", "W_TO_N", "W_TO_S"},
        }

        active_approaches = []
        for app_name, app_movements in approach_groups.items():
            if proposed_set.intersection(app_movements):
                active_approaches.append(app_name)

        if len(active_approaches) > 1:
            return (
                False,
                f"REJECTED: Movements from multiple approaches [{', '.join(active_approaches)}] requested simultaneously. Rule 1: ONLY ONE APPROACH MAY BE ACTIVE AT A TIME.",
                [f"Approach {a1} ↔ Approach {a2}" for i, a1 in enumerate(active_approaches) for a2 in active_approaches[i+1:]],
                self.PREDEFINED_PHASES["ALL_RED_CLEARANCE"]
            )

        # Rule 2 & 3: Check geometrical crossing conflicts
        for m1 in proposed_set:
            conflicts = self.FULL_MOVEMENT_CONFLICTS.get(m1, set())
            for m2 in proposed_set:
                if m2 in conflicts and m1 != m2:
                    lbl1 = self.ID_TO_LABEL.get(m1, m1)
                    lbl2 = self.ID_TO_LABEL.get(m2, m2)
                    pair_str = f"{lbl1} ↔ {lbl2}"
                    if pair_str not in conflicting_pairs:
                        conflicting_pairs.append(pair_str)

        if conflicting_pairs:
            conflict_summary = ", ".join(conflicting_pairs)
            return (
                False,
                f"REJECTED: Conflicting movement pair(s) detected [{conflict_summary}]. Safety validator prevented collision.",
                conflicting_pairs,
                self.PREDEFINED_PHASES["ALL_RED_CLEARANCE"]
            )

        # Match exact approach phases
        if proposed_set.issubset({"N_TO_S", "N_TO_E", "N_TO_W"}) and proposed_set:
            return True, "VALIDATED: Exclusive North Approach Active. Approved N → S, N → E, N → W.", [], self.PREDEFINED_PHASES["NORTH_APPROACH"]
        elif proposed_set.issubset({"S_TO_N", "S_TO_E", "S_TO_W"}) and proposed_set:
            return True, "VALIDATED: Exclusive South Approach Active. Approved S → N, S → E, S → W.", [], self.PREDEFINED_PHASES["SOUTH_APPROACH"]
        elif proposed_set.issubset({"E_TO_W", "E_TO_N", "E_TO_S"}) and proposed_set:
            return True, "VALIDATED: Exclusive East Approach Active. Approved E → W, E → N, E → S.", [], self.PREDEFINED_PHASES["EAST_APPROACH"]
        elif proposed_set.issubset({"W_TO_E", "W_TO_N", "W_TO_S"}) and proposed_set:
            return True, "VALIDATED: Exclusive West Approach Active. Approved W → E, W → N, W → S.", [], self.PREDEFINED_PHASES["WEST_APPROACH"]
        elif proposed_set == {"PEDESTRIAN_WALK"}:
            return True, "VALIDATED: Protected Pedestrian Walk Phase.", [], self.PREDEFINED_PHASES["PEDESTRIAN_EXCLUSIVE"]
        elif not proposed_set:
            return True, "VALIDATED: All Red Clearance State.", [], self.PREDEFINED_PHASES["ALL_RED_CLEARANCE"]

        labels = [self.ID_TO_LABEL.get(m, m) for m in sorted(proposed_set)]
        return True, f"VALIDATED: Exclusive single approach safe movements [{', '.join(labels)}].", [], {
            "name": f"Protected Approach Phase ({', '.join(labels)})",
            "approach": active_approaches[0] if active_approaches else "NONE",
            "movement_ids": list(proposed_set),
            "movements": labels,
            "other_approaches_status": "OTHER APPROACHES: RED",
            "phase": DirectionPhase.NORTH_APPROACH if "NORTH" in active_approaches else DirectionPhase.ALL_RED_CLEARANCE
        }

    def validate_movement_set(self, proposed_movements: List[str]) -> Tuple[bool, str, Dict[str, Any]]:
        """Bridge wrapper translating human notation or IDs into validation result."""
        # Convert notation to IDs if needed
        inv_map = {v: k for k, v in self.ID_TO_LABEL.items()}
        ids = [inv_map.get(m, m) for m in proposed_movements]
        is_safe, msg, conflicts, resolved = self.validate_signal_plan(ids)
        return is_safe, msg, resolved

# Singleton instance
safety_validator = DeterministicSafetyValidator()
