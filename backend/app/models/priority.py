"""Priority level domain models and enumerations."""

from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional

class PriorityCategory(str, Enum):
    """Enumeration of traffic network priority levels in descending order of precedence."""
    EMERGENCY_VEHICLE = "EMERGENCY_VEHICLE"      # Priority 1
    VULNERABLE_ROAD_USER = "VULNERABLE_ROAD_USER"  # Priority 2
    WANTED_VEHICLE = "WANTED_VEHICLE"              # Priority 3
    ACCIDENT = "ACCIDENT"                          # Priority 4
    TRANSIT = "TRANSIT"                            # Priority 5
    SURGE_CORRIDOR = "SURGE_CORRIDOR"              # Priority 6
    NORMAL = "NORMAL"                              # Default operation

class PriorityItem(BaseModel):
    """Model representing a priority level definition."""
    category: PriorityCategory
    rank: int = Field(..., ge=1, le=6, description="Priority rank where 1 is highest priority")
    name: str
    description: str

class PriorityResolutionRule(BaseModel):
    """Rule defining how two competing events are resolved."""
    higher_priority: PriorityCategory
    lower_priority: PriorityCategory
    action: str
    reason: str
