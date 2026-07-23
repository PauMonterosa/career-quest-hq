from abc import ABC, abstractmethod
from typing import Any


class AgentModelProvider(ABC):
    @abstractmethod
    def complete(self, *, skill: str, context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

