from typing import Any
from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AgentOut(ORMModel):
    id: str
    name: str
    role: str
    personality: str
    current_room: str
    current_task: str | None
    status: str
    task_queue: list[Any]
    last_result: dict[str, Any] | None
    avatar: dict[str, Any]


class TaskCreate(BaseModel):
    skill: str


class TaskResultOut(BaseModel):
    task_id: int
    agent_id: str
    skill: str
    status: str
    requires_approval: bool
    is_mock: bool
    result: dict[str, Any]

