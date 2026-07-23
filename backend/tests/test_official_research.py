import httpx
import pytest
from app.models import Agent, MasterProgramme, ResearchEvidence
from app.services.official_research import UnsafeSource, fetch_official_source
from app.services.agent_orchestrator import execute_agent_task


def test_fetch_extracts_structured_official_signals():
    html = """<html><head><title>Official MSc</title></head><body>
    <h1>Admissions</h1><p>Application deadline is 31 January.</p>
    <p>Admission requirements include mathematics and physics.</p>
    <p>Tuition fees and scholarships are published annually.</p></body></html>"""
    transport = httpx.MockTransport(lambda request: httpx.Response(
        200, headers={"content-type": "text/html"}, text=html, request=request
    ))
    with httpx.Client(transport=transport) as client:
        result = fetch_official_source("https://example.org/programme", client=client, resolve_dns=False)
    assert result["page_title"] == "Official MSc"
    assert result["signals"]["deadlines"]
    assert result["signals"]["admission"]
    assert result["signals"]["fees_funding"]


@pytest.mark.parametrize("url", ["file:///etc/passwd", "http://localhost:8000", "http://127.0.0.1"])
def test_rejects_non_public_sources(url):
    with pytest.raises(UnsafeSource):
        fetch_official_source(url, resolve_dns=False)


def test_atlas_live_research_is_audited_and_persists_evidence(db, monkeypatch):
    agent = Agent(id="atlas", name="ATLAS", role="Scout", personality="Explorer",
        current_room="masters_archive", status="idle", task_queue=[], avatar={})
    programme = MasterProgramme(name="Official MSc", university="Example", score="9",
        url="https://example.org/programme", source_data={})
    db.add_all([agent, programme])
    db.commit()
    monkeypatch.setattr("app.services.skills.fetch_official_source", lambda url: {
        "source_url": url, "final_url": url, "status_code": 200, "page_title": "Official MSc",
        "content_hash": "a" * 64, "signals": {"admission": ["Physics required"]}, "text_length": 120,
    })

    task = execute_agent_task(db, agent, "research_master_sources")

    assert task.result.is_mock is False
    assert task.result.output["summary"]["verified"] == 1
    assert db.query(ResearchEvidence).one().page_title == "Official MSc"
