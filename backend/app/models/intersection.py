"""Intersection and Traffic Signal domain schemas with explicit 12-movement control."""

from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.models.priority import PriorityCategory

class SignalColor(str, Enum):
    """Signal light state colors."""
    RED = "RED"
    YELLOW = "YELLOW"
    GREEN = "GREEN"
    FLASHING_YELLOW = "FLASHING_YELLOW"
    ALL_RED = "ALL_RED"

class MovementID(str, Enum):
    """Machine-readable 12 vehicle movements + pedestrian walk."""
    # North Approach
    N_TO_S = "N_TO_S"  # North Straight (N → S)
    N_TO_E = "N_TO_E"  # North Right Turn (N → E)
    N_TO_W = "N_TO_W"  # North Left Turn (N → W)
    # South Approach
    S_TO_N = "S_TO_N"  # South Straight (S → N)
    S_TO_E = "S_TO_E"  # South Left Turn (S → E)
    S_TO_W = "S_TO_W"  # South Right Turn (S → W)
    # East Approach
    E_TO_W = "E_TO_W"  # East Straight (E → W)
    E_TO_N = "E_TO_N"  # East Left Turn (E → N)
    E_TO_S = "E_TO_S"  # East Right Turn (E → S)
    # West Approach
    W_TO_E = "W_TO_E"  # West Straight (W → E)
    W_TO_N = "W_TO_N"  # West Right Turn (W → N)
    W_TO_S = "W_TO_S"  # West Left Turn (W → S)
    # Pedestrian
    PEDESTRIAN_WALK = "PEDESTRIAN_WALK"

class DirectionPhase(str, Enum):
    """Active traffic movement phase groups."""
    NORTH_APPROACH = "NORTH_APPROACH"  # N → S, N → E, N → W
    SOUTH_APPROACH = "SOUTH_APPROACH"  # S → N, S → E, S → W
    EAST_APPROACH = "EAST_APPROACH"    # E → W, E → N, E → S
    WEST_APPROACH = "WEST_APPROACH"    # W → E, W → N, W → S
    PEDESTRIAN_EXCLUSIVE = "PEDESTRIAN_EXCLUSIVE"  # Pedestrian Walk
    ALL_RED_CLEARANCE = "ALL_RED_CLEARANCE"  # All RED clearance buffer

class CongestionLevel(str, Enum):
    """Lane queue congestion density levels."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class QueueDensity(BaseModel):
    """Queue and vehicle density metrics for an intersection approach."""
    direction: str
    vehicle_count: int = Field(default=0, ge=0)
    average_speed_kmh: float = Field(default=40.0, ge=0.0)
    congestion_level: CongestionLevel = CongestionLevel.LOW

class DetailedMovementState(BaseModel):
    """Explicit 12-movement signal lamp states."""
    n_to_s: SignalColor = SignalColor.GREEN
    n_to_e: SignalColor = SignalColor.GREEN
    n_to_w: SignalColor = SignalColor.GREEN

    s_to_n: SignalColor = SignalColor.RED
    s_to_e: SignalColor = SignalColor.RED
    s_to_w: SignalColor = SignalColor.RED

    e_to_w: SignalColor = SignalColor.RED
    e_to_n: SignalColor = SignalColor.RED
    e_to_s: SignalColor = SignalColor.RED

    w_to_e: SignalColor = SignalColor.RED
    w_to_n: SignalColor = SignalColor.RED
    w_to_s: SignalColor = SignalColor.RED

    pedestrian: SignalColor = SignalColor.RED

class MovementState(BaseModel):
    """Bridge for movement lamp states."""
    n_to_s: SignalColor = SignalColor.GREEN
    s_to_n: SignalColor = SignalColor.RED
    e_to_w: SignalColor = SignalColor.RED
    w_to_e: SignalColor = SignalColor.RED
    pedestrian: SignalColor = SignalColor.RED

class SignalState(BaseModel):
    """Current state of traffic signal lamps for directions and movements."""
    north_south: SignalColor = SignalColor.GREEN
    east_west: SignalColor = SignalColor.RED
    pedestrian: SignalColor = SignalColor.RED
    movements: MovementState = Field(default_factory=MovementState)
    detailed_movements: DetailedMovementState = Field(default_factory=DetailedMovementState)
    cycle_time_seconds: int = 90
    elapsed_time_seconds: int = 25

class ActiveEvent(BaseModel):
    """Structural definition of a traffic event attached to an intersection."""
    event_id: str
    category: PriorityCategory
    title: str
    description: str
    timestamp: str
    source: str
    is_active: bool = True

class Intersection(BaseModel):
    """Full representation of a traffic signal network node."""
    intersection_id: str = Field(..., description="Unique intersection identifier, e.g. I1")
    name: str = Field(..., description="Human readable crossroad name")
    latitude: float = Field(..., description="Geographic latitude")
    longitude: float = Field(..., description="Geographic longitude")
    signal_state: SignalState = Field(default_factory=SignalState)
    current_phase: DirectionPhase = DirectionPhase.NORTH_APPROACH
    active_approach: str = "NORTH"
    permitted_movements: List[str] = Field(default_factory=lambda: ["N → S", "N → E", "N → W"])
    active_movements: List[str] = Field(default_factory=lambda: ["N → S", "N → E", "N → W"])
    active_movement_ids: List[str] = Field(default_factory=lambda: ["N_TO_S", "N_TO_E", "N_TO_W"])
    yellow_movements: List[str] = Field(default_factory=list)
    active_movement_group: str = "NORTH APPROACH GREEN PHASE"
    other_approaches_status: str = "SOUTH: RED | EAST: RED | WEST: RED"
    is_clearance_active: bool = False
    safety_validation_status: str = "VALIDATED"
    conflict_check_detail: str = "CONFLICT CHECK: PASSED | CONFLICTING MOVEMENTS: NONE"
    ai_recommendation_trace: str = "AI Proposed: N_TO_S, S_TO_N → Validator: APPROVED"
    queue_density: List[QueueDensity] = Field(default_factory=list)
    neighboring_intersections: List[str] = Field(default_factory=list)
    active_events: List[ActiveEvent] = Field(default_factory=list)
    current_priority: PriorityCategory = PriorityCategory.NORMAL
    timer_state: str = "GREEN"
    timer_remaining: int = 25
    timer_total: int = 30
    approach_densities: Dict[str, int] = Field(default_factory=lambda: {"NORTH": 75, "SOUTH": 20, "EAST": 50, "WEST": 15})

class NetworkTopology(BaseModel):
    """Connected network topology model."""
    intersections: List[Intersection]
    total_intersections: int
    active_corridors: List[Dict[str, Any]] = Field(default_factory=list)
