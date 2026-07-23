from app.models import ActionTask
from app.services.calendar_export import tasks_to_ics


def test_exports_pending_dated_tasks_as_valid_ics(db):
    db.add_all([
        ActionTask(title="Submit proposal", due_date="2026-08-12", status="pending",
                   priority="alta", category="TFG", source_data={"resultat_verificable": "Proposal uploaded"}),
        ActionTask(title="Already done", due_date="2026-08-13", status="completed", source_data={}),
        ActionTask(title="No date", status="pending", source_data={}),
    ])
    db.commit()
    content = tasks_to_ics(db)
    assert content.startswith("BEGIN:VCALENDAR\r\n")
    assert "SUMMARY:Submit proposal" in content
    assert "DTSTART;VALUE=DATE:20260812" in content
    assert "DESCRIPTION:Proposal uploaded" in content
    assert "Already done" not in content
    assert content.endswith("END:VCALENDAR\r\n")
