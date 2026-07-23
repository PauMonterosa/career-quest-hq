from datetime import datetime
from sqlalchemy.orm import Session
from ..models import Agent, AgentResult, AgentTask
from .skills import SKILLS


class InvalidSkill(ValueError):
    pass


def execute_agent_task(db: Session, agent: Agent, skill: str) -> AgentTask:
    allowed = SKILLS.get(agent.id, {})
    if skill not in allowed:
        raise InvalidSkill(f"{agent.name} allows: {', '.join(allowed)}")
    destination, approval, is_mock, runner = allowed[skill]
    task = AgentTask(agent_id=agent.id, skill=skill, status="working", requires_approval=approval)
    agent.status = "working"
    agent.current_room = destination
    agent.current_task = skill
    db.add(task)
    db.flush()
    observe = {"agent": agent.name, "room": destination, "database_scope": skill}
    output = runner(db)
    task.status = "waiting_approval" if approval else "completed"
    task.completed_at = datetime.utcnow()
    result = AgentResult(task_id=task.id, observe=observe, plan={"selected_skill": skill}, output=output, is_mock=is_mock)
    agent.status = task.status
    agent.last_result = output
    agent.current_task = None
    db.add(result)
    db.commit()
    db.refresh(task)
    return task
