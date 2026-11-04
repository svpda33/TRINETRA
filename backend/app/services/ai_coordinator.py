"""AI Reasoning & Coordination Layer for NexTrAI.

Architectural Rule:
The LLM NEVER directly controls traffic signals.
The AI coordinator computes multi-intersection reasoning proposals, which MUST be evaluated
by DeterministicSafetyValidator before any signal modification is executed.
"""

import logging
from typing import Dict, Any
from app.services.gemini_service import gemini_traffic_service

logger = logging.getLogger("nextrai.ai")

class AICoordinatorService:
    """Orchestrates AI multi-intersection contextual reasoning using Google Gemini AI."""

    @property
    def api_key(self) -> str:
        return gemini_traffic_service.api_key

    @property
    def model(self) -> str:
        return gemini_traffic_service.configured_model

    def is_configured(self) -> bool:
        """Returns True if a valid Gemini API key is configured."""
        return gemini_traffic_service.is_configured()

    async def compute_reasoning_plan(self) -> Dict[str, Any]:
        """
        Analyzes current network state across I1 & I2 using Gemini AI,
        and validates proposal via Deterministic Safety Layer.
        """
        return await gemini_traffic_service.compute_reasoning_plan()

ai_coordinator = AICoordinatorService()
