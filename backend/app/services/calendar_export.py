from datetime import date, datetime, timedelta, timezone
from uuid import uuid5, NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ActionTask


def _escape(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")


def _date(value: str | None) -> date | None:
    if not value:
        return None
    for parser in (
        lambda: datetime.fromisoformat(value).date(),
        lambda: datetime.strptime(value, "%d/%m/%Y").date(),
    ):
        try:
            return parser()
        except ValueError:
            continue
    return None


def tasks_to_ics(db: Session) -> str:
    completed = {"completat", "completada", "completed", "fet", "done"}
    tasks = [task for task in db.scalars(select(ActionTask).order_by(ActionTask.id)).all()
             if (task.status or "").lower() not in completed and _date(task.due_date)]
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Career Quest HQ//CHRONOS//ES",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Career Quest HQ",
    ]
    for task in tasks:
        start = _date(task.due_date)
        if not start:
            continue
        end = start + timedelta(days=1)
        description = task.source_data.get("resultat_verificable") or task.notes or "Tarea pendiente de Career Quest HQ"
        uid = uuid5(NAMESPACE_URL, f"career-quest-task-{task.id}").hex
        lines.extend([
            "BEGIN:VEVENT", f"UID:{uid}@career-quest-hq", f"DTSTAMP:{now}",
            f"DTSTART;VALUE=DATE:{start.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{end.strftime('%Y%m%d')}",
            f"SUMMARY:{_escape(task.title)}",
            f"DESCRIPTION:{_escape(description)}",
            f"CATEGORIES:{_escape(task.category or 'Career Quest')}",
            f"PRIORITY:{1 if (task.priority or '').lower() in {'critica', 'crítica', 'urgent'} else 5}",
            "STATUS:NEEDS-ACTION", "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"

