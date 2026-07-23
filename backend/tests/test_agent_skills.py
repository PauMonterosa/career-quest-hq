import pytest
from app.models import ActionTask, Agent, ApplicationDocument, MasterProgramme, ResearchEvidence, TFGOpportunity
from app.services.agent_orchestrator import InvalidSkill, execute_agent_task


def seed(db, agent_id):
    agent = Agent(id=agent_id, name=agent_id.upper(), role="role", personality="personality",
        current_room="control_room", status="idle", task_queue=[], avatar={"color": "#fff"})
    db.add_all([
        agent,
        MasterProgramme(name="Solar MSc", university="UPC", score="9", source_data={}),
        TFGOpportunity(id=1, title="PV forecasting", centre="IREC", topic="Solar forecasting", source_data={}),
        ActionTask(title="Prepare portfolio", priority="High", category="portfolio",
            due_date="2026-07-24", source_data={"resultat_verificable": "Portfolio published"}),
        ApplicationDocument(name="CV", status="draft", source_data={}),
    ])
    db.commit()
    return agent


@pytest.mark.parametrize("agent_id,skill", [
    ("atlas", "suggest_shortlist"),
    ("nova", "list_top_tfg_opportunities"),
    ("echo", "draft_tfg_email"),
    ("chronos", "list_urgent_tasks"),
    ("pixel", "list_portfolio_priorities"),
])
def test_each_mock_skill_records_audit(db, agent_id, skill):
    task = execute_agent_task(db, seed(db, agent_id), skill)
    assert task.result.is_mock is True
    assert task.result.plan["selected_skill"] == skill
    assert task.result.output["title"]
    assert task.status == ("waiting_approval" if agent_id == "echo" else "completed")


def test_rejects_non_allowlisted_skill(db):
    with pytest.raises(InvalidSkill):
        execute_agent_task(db, seed(db, "atlas"), "send_email")


@pytest.mark.parametrize("agent_id,skill", [
    ("chronos", "build_weekly_plan"),
    ("pixel", "build_portfolio_delivery_plan"),
])
def test_real_local_automations_return_readable_items(db, agent_id, skill):
    task = execute_agent_task(db, seed(db, agent_id), skill)
    assert task.result.is_mock is False
    assert task.result.output["mode"] == "real_local_automation"
    assert task.result.output["items"]
    assert task.status == "completed"


def test_echo_uses_nova_research_without_sending(db):
    agent = seed(db, "echo")
    db.add(ResearchEvidence(
        agent_id="nova", entity_type="tfg_opportunity", entity_id=1,
        source_url="https://example.org/research", final_url="https://example.org/research",
        page_title="Solar Energy Research", status_code=200,
        evidence={"research": [{"text": "Forecasting photovoltaic generation with machine learning."}]},
    ))
    db.commit()
    task = execute_agent_task(db, agent, "draft_researched_tfg_email")
    assert task.result.is_mock is False
    assert task.requires_approval is True
    assert "Forecasting photovoltaic" in task.result.output["body"]
    assert task.result.output["summary"]["envio"] == "No enviado"
