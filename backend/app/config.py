"""Centralized Application Configuration & Priority Hierarchy Settings."""

import os
import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Dict, Any, Union
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

class Settings(BaseSettings):
    """System settings loaded from environment variables."""
    PROJECT_NAME: str = "Trinetra"
    PROJECT_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    PRIORITY_HIERARCHY: Dict[str, Dict[str, Any]] = {
        "EMERGENCY_VEHICLE": {
            "rank": 1,
            "name": "Emergency Vehicle Corridor",
            "description": "Preempt signals for active ambulances, fire engines, and rescue vehicles."
        },
        "VULNERABLE_ROAD_USER": {
            "rank": 2,
            "name": "Vulnerable Road User Protection",
            "description": "Dynamic pedestrian and cyclist crossing extension."
        },
        "WANTED_VEHICLE": {
            "rank": 3,
            "name": "Police Chase / Wanted Vehicle Containment",
            "description": "Watchlist red-light containment grids for suspect vehicles."
        },
        "ACCIDENT": {
            "rank": 4,
            "name": "Accident Auto-Response",
            "description": "Incident area lockdown and emergency clearance routing."
        },
        "TRANSIT": {
            "rank": 5,
            "name": "Multi-Modal Transit Priority",
            "description": "Green-wave extension for delayed public buses and transit."
        },
        "SURGE_CORRIDOR": {
            "rank": 6,
            "name": "VIP / Mass-Evacuation Surge Corridor",
            "description": "Corridor coordination for motorcades or high-density evacuations."
        }
    }

    FEATHERLESS_API_KEY: str = os.getenv("FEATHERLESS_API_KEY", "")
    FEATHERLESS_MODEL: str = os.getenv("FEATHERLESS_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct")

    # Configurable Dynamic Traffic Signal Timing (in seconds)
    MIN_GREEN_TIME: int = 10
    MAX_GREEN_TIME: int = 45
    YELLOW_TIME: int = 3
    ALL_RED_TIME: int = 2

    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://*.vercel.app",
        "https://*.railway.app",
        "*"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v or v == "*":
                return ["*"]
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return [str(item).strip() for item in v]
        return ["*"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
