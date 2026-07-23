from datetime import datetime
from typing import Any
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class SourceMixin:
    source_sheet: Mapped[str | None] = mapped_column(String(120))
    source_row: Mapped[int | None] = mapped_column(Integer)
    source_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class MasterProgramme(SourceMixin, Base):
    __tablename__ = "master_programmes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    university: Mapped[str | None] = mapped_column(String(240))
    location: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str | None] = mapped_column(String(100))
    score: Mapped[str | None] = mapped_column(String(50))
    deadline: Mapped[str | None] = mapped_column(String(100))
    prerequisites: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)


class TFGOpportunity(SourceMixin, Base):
    __tablename__ = "tfg_opportunities"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    centre: Mapped[str | None] = mapped_column(String(240))
    supervisor: Mapped[str | None] = mapped_column(String(240))
    topic: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(100))
    contact: Mapped[str | None] = mapped_column(String(240))


class ActionTask(SourceMixin, Base):
    __tablename__ = "action_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str | None] = mapped_column(String(100))
    priority: Mapped[str | None] = mapped_column(String(50))
    due_date: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)


class EmailDraft(SourceMixin, Base):
    __tablename__ = "email_drafts"
    id: Mapped[int] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(String(300))
    recipient: Mapped[str | None] = mapped_column(String(240))
    body: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(100))
    follow_up_date: Mapped[str | None] = mapped_column(String(100))
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True)


class ApplicationDocument(SourceMixin, Base):
    __tablename__ = "application_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    status: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    role: Mapped[str] = mapped_column(String(180))
    personality: Mapped[str] = mapped_column(String(180))
    current_room: Mapped[str] = mapped_column(String(80))
    current_task: Mapped[str | None] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(40), default="idle")
    task_queue: Mapped[list[Any]] = mapped_column(JSON, default=list)
    last_result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    avatar: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    tasks: Mapped[list["AgentTask"]] = relationship(back_populates="agent")


class AgentTask(Base):
    __tablename__ = "agent_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"))
    skill: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40))
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    agent: Mapped[Agent] = relationship(back_populates="tasks")
    result: Mapped["AgentResult | None"] = relationship(back_populates="task", uselist=False)


class AgentResult(Base):
    __tablename__ = "agent_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("agent_tasks.id"), unique=True)
    observe: Mapped[dict[str, Any]] = mapped_column(JSON)
    plan: Mapped[dict[str, Any]] = mapped_column(JSON)
    output: Mapped[dict[str, Any]] = mapped_column(JSON)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    task: Mapped[AgentTask] = relationship(back_populates="result")


class ResearchEvidence(Base):
    __tablename__ = "research_evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(40))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[int] = mapped_column(Integer)
    source_url: Mapped[str] = mapped_column(Text)
    final_url: Mapped[str | None] = mapped_column(Text)
    page_title: Mapped[str | None] = mapped_column(String(500))
    status_code: Mapped[int | None] = mapped_column(Integer)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    content_hash: Mapped[str | None] = mapped_column(String(64))
    error: Mapped[str | None] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


__all__ = [
    "MasterProgramme", "TFGOpportunity", "ActionTask", "EmailDraft",
    "ApplicationDocument", "Agent", "AgentTask", "AgentResult", "ResearchEvidence",
]
