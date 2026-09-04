"""Intersection network topology endpoints."""

from fastapi import APIRouter
from typing import List
from app.models.intersection import (
    Intersection, SignalState, SignalColor, DirectionPhase, 
    QueueDensity, CongestionLevel, NetworkTopology
)
from app.models.priority import PriorityCategory

router = APIRouter(prefix="/intersections", tags=["Intersections Network"])

# Sample baseline topology: I1 <-> I2 <-> I3 <-> I4
# Representative simulation configuration data (NOT fake live events)
SAMPLE_INTERSECTIONS: List[Intersection] = [
    Intersection(
        intersection_id="I1",
        name="Main St & 1st Ave",
        latitude=37.7749,
        longitude=-122.4194,
        signal_state=SignalState(north_south=SignalColor.GREEN, east_west=SignalColor.RED),
        current_phase=DirectionPhase.NORTH_APPROACH,
        active_approach="NORTH",
        permitted_movements=["N → S", "N → E", "N → W"],
        active_movements=["N → S", "N → E", "N → W"],
        active_movement_ids=["N_TO_S", "N_TO_E", "N_TO_W"],
        active_movement_group="NORTH APPROACH GREEN PHASE",
        other_approaches_status="SOUTH: RED | EAST: RED | WEST: RED",
        queue_density=[
            QueueDensity(direction="NORTH_SOUTH", vehicle_count=12, average_speed_kmh=35.0, congestion_level=CongestionLevel.LOW),
            QueueDensity(direction="EAST_WEST", vehicle_count=8, average_speed_kmh=42.0, congestion_level=CongestionLevel.LOW),
        ],
        neighboring_intersections=["I2"],
        active_events=[],
        current_priority=PriorityCategory.NORMAL
    ),
    Intersection(
        intersection_id="I2",
        name="Main St & 2nd Ave",
        latitude=37.7759,
        longitude=-122.4184,
        signal_state=SignalState(north_south=SignalColor.RED, east_west=SignalColor.GREEN),
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
        neighboring_intersections=["I1", "I3"],
        active_events=[],
        current_priority=PriorityCategory.NORMAL
    ),
    Intersection(
        intersection_id="I3",
        name="Main St & 3rd Ave",
        latitude=37.7769,
        longitude=-122.4174,
        signal_state=SignalState(north_south=SignalColor.GREEN, east_west=SignalColor.RED),
        current_phase=DirectionPhase.EAST_APPROACH,
        active_approach="EAST",
        permitted_movements=["E → W", "E → N", "E → S"],
        active_movements=["E → W", "E → N", "E → S"],
        active_movement_ids=["E_TO_W", "E_TO_N", "E_TO_S"],
        active_movement_group="EAST APPROACH GREEN PHASE",
        other_approaches_status="NORTH: RED | SOUTH: RED | WEST: RED",
        queue_density=[
            QueueDensity(direction="NORTH_SOUTH", vehicle_count=24, average_speed_kmh=15.0, congestion_level=CongestionLevel.HIGH),
            QueueDensity(direction="EAST_WEST", vehicle_count=10, average_speed_kmh=38.0, congestion_level=CongestionLevel.LOW),
        ],
        neighboring_intersections=["I2", "I4"],
        active_events=[],
        current_priority=PriorityCategory.NORMAL
    ),
    Intersection(
        intersection_id="I4",
        name="Main St & 4th Ave",
        latitude=37.7779,
        longitude=-122.4164,
        signal_state=SignalState(north_south=SignalColor.RED, east_west=SignalColor.GREEN),
        current_phase=DirectionPhase.WEST_APPROACH,
        active_approach="WEST",
        permitted_movements=["W → E", "W → N", "W → S"],
        active_movements=["W → E", "W → N", "W → S"],
        active_movement_ids=["W_TO_E", "W_TO_N", "W_TO_S"],
        active_movement_group="WEST APPROACH GREEN PHASE",
        other_approaches_status="NORTH: RED | SOUTH: RED | EAST: RED",
        queue_density=[
            QueueDensity(direction="NORTH_SOUTH", vehicle_count=9, average_speed_kmh=40.0, congestion_level=CongestionLevel.LOW),
            QueueDensity(direction="EAST_WEST", vehicle_count=11, average_speed_kmh=36.0, congestion_level=CongestionLevel.LOW),
        ],
        neighboring_intersections=["I3"],
        active_events=[],
        current_priority=PriorityCategory.NORMAL
    ),
]

@router.get("", response_model=NetworkTopology)
async def get_network_topology():
    """
    Retrieve current traffic signal network configuration & topology (I1 <-> I2 <-> I3 <-> I4).
    """
    return NetworkTopology(
        intersections=SAMPLE_INTERSECTIONS,
        total_intersections=len(SAMPLE_INTERSECTIONS),
        active_corridors=[]
    )

@router.get("/{intersection_id}", response_model=Intersection)
async def get_intersection_by_id(intersection_id: str):
    """
    Retrieve specific intersection topology and signal state by ID.
    """
    for node in SAMPLE_INTERSECTIONS:
        if node.intersection_id.upper() == intersection_id.upper():
            return node
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Intersection {intersection_id} not found in topology.")
