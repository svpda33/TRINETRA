"""AI Reasoning & Coordination Layer (Featherless API Integration).

Architectural Rule:
The LLM NEVER directly controls traffic signals.
The AI coordinator computes multi-intersection reasoning proposals, which MUST be evaluated
by DeterministicSafetyValidator before any signal modification is executed.
"""

import os
import json
import logging
import urllib.request
from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.safety_validator import safety_validator
from app.services.simulation_engine import simulation_engine
from app.models.intersection import DirectionPhase, SignalColor

logger = logging.getLogger("syncsignal.ai")

class AICoordinatorService:
    """Orchestrates AI multi-intersection contextual reasoning using Featherless API."""

    @property
    def api_key(self) -> str:
        return settings.FEATHERLESS_API_KEY or os.getenv("FEATHERLESS_API_KEY", "")

    @property
    def model(self) -> str:
        return settings.FEATHERLESS_MODEL or os.getenv("FEATHERLESS_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct")

    def is_configured(self) -> bool:
        """Returns True if a valid Featherless API key is provided."""
        key = self.api_key
        return bool(key and key.strip())

    async def compute_reasoning_plan(self) -> Dict[str, Any]:
        """
        Analyzes current network state across I1 & I2, queries Featherless API (if configured),
        and validates proposal via Safety Layer.
        
        Strict Security Rule:
        If no FEATHERLESS_API_KEY is configured, return an honest 'AI SERVICE NOT CONFIGURED'
        status. Do NOT generate fake AI responses.
        """
        if not self.is_configured():
            logger.info("Featherless API key is missing/unconfigured. Returning AI SERVICE NOT CONFIGURED error.")
            return {
                "status": "unconfigured",
                "featherless_api_active": False,
                "error": "AI SERVICE NOT CONFIGURED",
                "message": "FEATHERLESS_API_KEY environment variable is not configured. Please set a valid FEATHERLESS_API_KEY in .env to enable autonomous AI coordination.",
                "llm_model": self.model
            }

        topology = simulation_engine.get_topology()
        active_events = simulation_engine.active_events
        
        # Build structured network telemetry state payload
        prompt_data = {
            "network_nodes": [
                {
                    "node_id": node.intersection_id,
                    "name": node.name,
                    "active_approach": node.active_approach,
                    "current_phase": node.current_phase,
                    "priority": node.current_priority,
                    "queue_density": [q.model_dump() for q in node.queue_density] if hasattr(node, "queue_density") else []
                }
                for node in topology.intersections
            ],
            "active_incidents": [e.model_dump() for e in active_events if e.is_active]
        }

        try:
            ai_res = await self._call_featherless_api(prompt_data)
        except Exception as e:
            logger.error(f"Featherless API call failed: {e}")
            return {
                "status": "failed",
                "featherless_api_active": True,
                "error": "AI OPTIMIZATION FAILED",
                "message": f"Featherless API request encountered an error: {str(e)}",
                "llm_model": self.model
            }

        # Validate AI proposed plan through Deterministic Safety Layer
        proposed_approach = ai_res.get("approach", "NORTH").upper()
        proposed_ids = {
            "NORTH": ["N_TO_S", "N_TO_E", "N_TO_W"],
            "SOUTH": ["S_TO_N", "S_TO_E", "S_TO_W"],
            "EAST": ["E_TO_W", "E_TO_N", "E_TO_S"],
            "WEST": ["W_TO_E", "W_TO_N", "W_TO_S"],
        }.get(proposed_approach, ["N_TO_S", "N_TO_E", "N_TO_W"])

        is_safe, safety_msg, conflicting_pairs, resolved_phase = safety_validator.validate_signal_plan(proposed_ids)

        return {
            "status": "success",
            "featherless_api_active": True,
            "llm_model": self.model,
            "decision": ai_res.get("decision", "EMERGENCY_CORRIDOR" if active_events else "DYNAMIC_DENSITY_REBALANCE"),
            "priority": ai_res.get("priority", "P1" if active_events else "NORMAL"),
            "source_intersection": ai_res.get("source_intersection", "I1"),
            "approach": proposed_approach,
            "target_intersections": ai_res.get("target_intersections", ["I1", "I2"]),
            "recommended_actions": ai_res.get("recommended_actions", [
                "Safely terminate current phase",
                "Execute yellow clearance",
                "Execute all-red clearance",
                f"Activate {proposed_approach} approach",
                "Coordinate downstream intersection"
            ]),
            "reason": ai_res.get("reason", "Optimal traffic flow coordination based on current network telemetry."),
            "safety_validation": {
                "is_approved": is_safe,
                "verdict": safety_msg,
                "rule_enforced": "RULE #1: Exclusive Approach & Geometrical Conflict Validation Layer"
            },
            "execution_plan": f"Approved transition to {proposed_approach} approach on {ai_res.get('source_intersection', 'I1')} via yellow clearance." if is_safe else "Plan REJECTED by Deterministic Safety Layer. Maintaining safe fallback phase."
        }

    async def _call_featherless_api(self, prompt_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calls Featherless API chat completion endpoint."""
        url = "https://api.featherless.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "SyncSignal",
            "User-Agent": "SyncSignal/1.0"
        }
        
        system_instructions = (
            "You are the SyncSignal Autonomous Traffic Coordinator AI Agent. "
            "Analyze live intersection telemetry for nodes I1 and I2. "
            "Respond ONLY with a JSON object containing keys: "
            "decision, priority, source_intersection, approach, target_intersections, recommended_actions (array of strings), reason."
        )
        
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": json.dumps(prompt_data)}
            ],
            "temperature": 0.2
        }

        req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            content = res_data['choices'][0]['message']['content']
            # Parse JSON from choice content
            cleaned = content.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())

ai_coordinator = AICoordinatorService()
