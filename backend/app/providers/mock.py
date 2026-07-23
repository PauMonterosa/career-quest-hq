from typing import Any
from .base import AgentModelProvider


class MockAgentModelProvider(AgentModelProvider):
    def complete(self, *, skill: str, context: dict[str, Any]) -> dict[str, Any]:
        return {"provider": "mock", "skill": skill, "context_items": len(context)}

