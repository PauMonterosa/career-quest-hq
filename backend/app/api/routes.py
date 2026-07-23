from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ActionTask, Agent, EmailDraft, MasterProgramme, ResearchEvidence, TFGOpportunity
from ..schemas import AgentOut, TaskCreate, TaskResultOut
from ..services.agent_orchestrator import InvalidSkill, execute_agent_task
from ..services.calendar_export import tasks_to_ics
from ..services.skills import SKILLS

router = APIRouter()


def serialise(row) -> dict[str, Any]:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "career-quest-hq", "milestone": "1"}


@router.get("/agents", response_model=list[AgentOut])
def agents(db: Session = Depends(get_db)):
    return db.scalars(select(Agent).order_by(Agent.name)).all()


@router.get("/agents/{agent_id}", response_model=AgentOut)
def agent(agent_id: str, db: Session = Depends(get_db)):
    row = db.get(Agent, agent_id.lower())
    if row is None:
        raise HTTPException(404, "Agent not found")
    return row


@router.get("/agents/{agent_id}/skills")
def agent_skills(agent_id: str, db: Session = Depends(get_db)):
    if db.get(Agent, agent_id.lower()) is None:
        raise HTTPException(404, "Agent not found")
    return [{"id": skill, "is_mock": spec[2], "requires_approval": spec[1]} for skill, spec in SKILLS[agent_id.lower()].items()]


def rows(model, db):
    return [serialise(row) for row in db.scalars(select(model).order_by(model.id)).all()]


@router.get("/masters")
def masters(db: Session = Depends(get_db)): return rows(MasterProgramme, db)


@router.get("/tfg-opportunities")
def tfg(db: Session = Depends(get_db)): return rows(TFGOpportunity, db)


@router.get("/tasks")
def tasks(db: Session = Depends(get_db)): return rows(ActionTask, db)


@router.get("/emails")
def emails(db: Session = Depends(get_db)): return rows(EmailDraft, db)


@router.get("/research-evidence")
def research_evidence(db: Session = Depends(get_db)): return rows(ResearchEvidence, db)


@router.get("/calendar/tasks.ics")
def task_calendar(db: Session = Depends(get_db)):
    return Response(
        content=tasks_to_ics(db),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="career-quest-tasks.ics"'},
    )


@router.post("/agents/{agent_id}/tasks", response_model=TaskResultOut)
def run_task(agent_id: str, request: TaskCreate, db: Session = Depends(get_db)):
    row = db.get(Agent, agent_id.lower())
    if row is None:
        raise HTTPException(404, "Agent not found")
    try:
        task = execute_agent_task(db, row, request.skill)
    except InvalidSkill as exc:
        raise HTTPException(422, str(exc)) from exc
    return TaskResultOut(task_id=task.id, agent_id=row.id, skill=task.skill, status=task.status,
        requires_approval=task.requires_approval, is_mock=task.result.is_mock, result=task.result.output)
