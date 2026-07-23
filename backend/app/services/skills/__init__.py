from datetime import date, datetime, timedelta
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...models import ActionTask, ApplicationDocument, MasterProgramme, ResearchEvidence, TFGOpportunity
from ..official_research import fetch_official_source

SkillRunner = Callable[[Session], dict[str, Any]]
SkillSpec = tuple[str, bool, bool, SkillRunner]


def _numeric_score(row: MasterProgramme) -> float:
    try:
        return float(row.score or 0)
    except (TypeError, ValueError):
        return 0


def atlas_shortlist(db: Session) -> dict[str, Any]:
    rows = sorted(db.scalars(select(MasterProgramme)).all(), key=lambda row: (-_numeric_score(row), row.name))[:3]
    return {"title": "Shortlist sugerida de másteres", "items": [
        {"name": row.name, "university": row.university, "score": row.score,
         "reason": "Una de las puntuaciones ponderadas más altas del Excel"} for row in rows
    ], "note": "Análisis local simulado; no modifica el Excel."}


def nova_top_tfg(db: Session) -> dict[str, Any]:
    rows = db.scalars(select(TFGOpportunity).order_by(TFGOpportunity.id)).all()
    priority_rank = {"molt_alta": 0, "critica": 0, "alta": 1, "mitjana": 2, "baixa": 3}
    rows = sorted(rows, key=lambda row: (
        priority_rank.get(str(row.source_data.get("prioritat") or "").lower().replace(" ", "_"), 9), row.id
    ))[:3]
    return {"title": "Oportunidades de TFG prioritarias", "items": [
        {"title": row.title, "centre": row.centre, "supervisor": row.supervisor} for row in rows
    ], "note": "Ordenación local simulada basada en la prioridad del Excel."}


def _research_sources(db: Session, agent_id: str, entity_type: str, rows: list[Any]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for row in rows:
        source_url = row.url if entity_type == "master_programme" else row.source_data.get("font_oficial")
        entity = row.name if entity_type == "master_programme" else row.centre
        if not source_url:
            items.append({"entity": entity, "status": "missing_source", "proposal": "Añadir una URL oficial al Excel."})
            continue
        try:
            research = fetch_official_source(str(source_url))
            signals = research["signals"]
            db.add(ResearchEvidence(
                agent_id=agent_id, entity_type=entity_type, entity_id=row.id, source_url=str(source_url),
                final_url=research["final_url"], page_title=research["page_title"],
                status_code=research["status_code"], evidence=signals, content_hash=research["content_hash"],
            ))
            items.append({
                "entity": entity, "status": "verified", "source_url": research["final_url"],
                "page_title": research["page_title"], "evidence": signals,
                "proposal": "Revisar las evidencias y aprobar manualmente cualquier cambio.",
            })
        except Exception as exc:
            db.add(ResearchEvidence(
                agent_id=agent_id, entity_type=entity_type, entity_id=row.id,
                source_url=str(source_url), error=str(exc),
            ))
            items.append({"entity": entity, "status": "error", "source_url": str(source_url), "error": str(exc)})
    db.flush()
    verified = sum(item["status"] == "verified" for item in items)
    return {
        "title": "Investigación de fuentes oficiales", "mode": "live_official_web", "items": items,
        "summary": {"checked": len(items), "verified": verified, "needs_review": len(items) - verified},
        "note": "Investigación real iniciada por el usuario. No se modificó el Excel.",
    }


def atlas_research_official_sources(db: Session) -> dict[str, Any]:
    rows = [row for row in sorted(
        db.scalars(select(MasterProgramme)).all(), key=lambda row: (-_numeric_score(row), row.name)
    ) if row.url][:3]
    return _research_sources(db, "atlas", "master_programme", rows)


def nova_research_official_sources(db: Session) -> dict[str, Any]:
    rows = [row for row in db.scalars(select(TFGOpportunity).order_by(TFGOpportunity.id)).all()
            if row.source_data.get("font_oficial")][:3]
    return _research_sources(db, "nova", "tfg_opportunity", rows)


def echo_email(db: Session) -> dict[str, Any]:
    tfg = db.scalar(select(TFGOpportunity).order_by(TFGOpportunity.id))
    subject = f"Consulta sobre TFG: {tfg.title}" if tfg else "Consulta sobre posible TFG"
    return {
        "title": "Borrador de correo para TFG", "subject": subject,
        "body": "Bon dia,\n\nHe estat revisant la vostra línia de recerca i voldria consultar la possibilitat de fer-hi el TFG.\n\nMoltes gràcies,",
        "approval_required": True, "note": "Borrador simulado. No se ha enviado.",
    }


def _first_evidence_snippet(evidence: ResearchEvidence) -> str:
    for category in ("research", "people_contact", "admission", "deadlines"):
        values = (evidence.evidence or {}).get(category, [])
        if values:
            value = values[0]
            text = value.get("text", "") if isinstance(value, dict) else str(value)
            return " ".join(text.split())[:300]
    return ""


def echo_researched_email(db: Session) -> dict[str, Any]:
    evidence = db.scalar(select(ResearchEvidence).where(
        ResearchEvidence.agent_id == "nova", ResearchEvidence.error.is_(None)
    ).order_by(ResearchEvidence.id.desc()))
    tfg = db.get(TFGOpportunity, evidence.entity_id) if evidence else None
    if not evidence or not tfg:
        return {
            "title": "Correo pendiente de investigación",
            "summary": {"estado": "Falta una fuente verificada", "envio": "No enviado"},
            "next_actions": ["Ejecutar primero «Investigar centros de investigación» con NOVA."],
            "approval_required": True,
            "note": "ECHO no inventa personalización si todavía no existe evidencia oficial.",
        }
    snippet = _first_evidence_snippet(evidence)
    centre = tfg.centre or "vuestro centro"
    topic = tfg.topic or tfg.title
    body = (
        f"Bon dia,\n\nHe estat investigant la línia de treball de {centre} relacionada amb {topic}. "
        f"M'ha cridat especialment l'atenció la informació publicada a "
        f"«{evidence.page_title or 'la vostra web oficial'}»"
        f"{f': {snippet}' if snippet else '.'}\n\n"
        "M'agradaria saber si hi ha possibilitat de desenvolupar un TFG en aquesta línia "
        "i quins serien els següents passos per valorar l'encaix.\n\nMoltes gràcies,"
    )
    return {
        "title": "Correo personalizado listo para revisar", "mode": "real_local_automation",
        "summary": {"centro": centre, "estado": "Borrador", "envio": "No enviado"},
        "subject": f"Interés en TFG sobre {tfg.title}",
        "personalization": [
            {"label": "Oportunidad", "value": tfg.title},
            {"label": "Fuente utilizada", "value": evidence.page_title or evidence.final_url},
            {"label": "Conexión encontrada", "value": snippet or "Página oficial verificada"},
        ],
        "body": body, "source_url": evidence.final_url or evidence.source_url,
        "next_actions": [
            "Verificar el nombre y correo de la persona destinataria.",
            "Revisar que la conexión con la línea de investigación sea correcta.",
            "Editar el tono si lo deseas y aprobar el borrador.",
        ],
        "approval_required": True,
        "note": "ECHO ha preparado el texto, pero no ha enviado ningún correo.",
    }


def chronos_urgent(db: Session) -> dict[str, Any]:
    rows = db.scalars(select(ActionTask).order_by(ActionTask.due_date, ActionTask.id)).all()
    urgent = [row for row in rows if (row.priority or "").lower() in
              {"critica", "crítica", "alta", "high", "urgent"} and
              (row.status or "").lower() not in {"completat", "completada", "completed", "fet"}][:5] or rows[:5]
    return {"title": "Plan de tareas urgentes", "items": [
        {"task": row.title, "due_date": row.due_date, "priority": row.priority, "status": row.status} for row in urgent
    ], "note": "Priorización local simulada; no se creó ningún evento externo."}


def _parse_due_date(value: str | None) -> date | None:
    if not value:
        return None
    normalized = str(value).strip()
    for parser in (lambda: datetime.fromisoformat(normalized).date(),
                   lambda: datetime.strptime(normalized, "%d/%m/%Y").date()):
        try:
            return parser()
        except ValueError:
            continue
    return None


def chronos_weekly_plan(db: Session) -> dict[str, Any]:
    completed = {"completat", "completada", "completed", "fet", "done"}
    rows = [row for row in db.scalars(select(ActionTask).order_by(ActionTask.id)).all()
            if (row.status or "").lower() not in completed]
    today = date.today()
    priority_rank = {"critica": 0, "crítica": 0, "urgent": 0, "alta": 1, "high": 1, "mitjana": 2}
    ranked = sorted(rows, key=lambda row: (
        _parse_due_date(row.due_date) is None, _parse_due_date(row.due_date) or date.max,
        priority_rank.get((row.priority or "").lower(), 5), row.id,
    ))
    items = []
    for index, row in enumerate(ranked[:7]):
        due = _parse_due_date(row.due_date)
        planned = today + timedelta(days=min(index, 6))
        if due and due < planned:
            planned = today
        if due and due < today:
            reason = f"Vencida hace {(today - due).days} días"
        elif due and due <= today + timedelta(days=7):
            reason = "Vence esta semana"
        elif (row.priority or "").lower() in {"critica", "crítica", "alta", "high", "urgent"}:
            reason = "Prioridad alta"
        else:
            reason = "Siguiente tarea pendiente"
        items.append({
            "task": row.title, "planned_date": planned.isoformat(), "due_date": row.due_date or "Sin fecha",
            "priority": row.priority or "Sin prioridad", "reason": reason,
            "definition_of_done": row.source_data.get("resultat_verificable") or row.notes or "Marcar la tarea como completada",
        })
    overdue = sum(bool((due := _parse_due_date(row.due_date)) and due < today) for row in rows)
    return {
        "title": "Plan semanal construido con tus tareas", "mode": "real_local_automation",
        "summary": {"pendientes": len(rows), "vencidas": overdue, "planificadas": len(items)},
        "items": items,
        "next_actions": ["Empieza por las tareas vencidas.", "Actualiza el estado al terminar cada entregable."],
        "note": "CHRONOS ha ordenado y distribuido tareas reales del Excel. No ha creado eventos externos.",
    }


def pixel_priorities(db: Session) -> dict[str, Any]:
    rows = db.scalars(select(ActionTask).order_by(ActionTask.id)).all()
    matches = [row for row in rows if any(keyword in f"{row.title} {row.category}".lower()
               for keyword in ("portfolio", "portafolis", "github", "openpv", "soley", "cv"))][:5]
    return {"title": "Prioridades del portfolio", "items": [
        {"task": row.title, "status": row.status, "next_step": "Crear un entregable revisable"} for row in matches
    ] or [{"task": "Documentar OpenPV-Lab", "next_step": "Añadir README, captura y configuración reproducible"}],
        "note": "Sugerencia local simulada."}


def pixel_delivery_plan(db: Session) -> dict[str, Any]:
    tasks = db.scalars(select(ActionTask).order_by(ActionTask.id)).all()
    documents = db.scalars(select(ApplicationDocument).order_by(ApplicationDocument.id)).all()
    keywords = ("portfolio", "portafolis", "github", "openpv", "soley", "cv")
    matches = [row for row in tasks if any(word in f"{row.title} {row.category}".lower() for word in keywords)]
    items = [{
        "deliverable": row.title, "status": row.status or "Pendiente", "due_date": row.due_date or "Sin fecha",
        "definition_of_done": row.source_data.get("resultat_verificable") or row.notes or "Entregable visible y revisable",
        "next_action": "Preparar una primera versión revisable",
    } for row in matches[:6]]
    for document in documents[:4]:
        if not any(str(item["deliverable"]).lower() == document.name.lower() for item in items):
            items.append({
                "deliverable": document.name, "status": document.status or "Pendiente", "due_date": "Sin fecha",
                "definition_of_done": document.notes or "Documento actualizado y listo para compartir",
                "next_action": "Revisar contenido, enlaces y presentación",
            })
    return {
        "title": "Plan de entregables del portfolio", "mode": "real_local_automation",
        "summary": {"tareas_detectadas": len(matches), "documentos": len(documents), "entregables": len(items)},
        "items": items,
        "next_actions": [
            "Completar primero un entregable pequeño y publicable.",
            "Añadir evidencia visual, una explicación breve y un enlace verificable.",
        ],
        "note": "PIXEL ha convertido tus tareas y documentos en entregables concretos. No ha publicado nada.",
    }


SKILLS: dict[str, dict[str, SkillSpec]] = {
    "atlas": {
        "suggest_shortlist": ("masters_archive", False, True, atlas_shortlist),
        "research_master_sources": ("masters_archive", False, False, atlas_research_official_sources),
    },
    "nova": {
        "list_top_tfg_opportunities": ("tfg_laboratory", False, True, nova_top_tfg),
        "research_tfg_sources": ("tfg_laboratory", False, False, nova_research_official_sources),
    },
    "echo": {
        "draft_tfg_email": ("mail_room", True, True, echo_email),
        "draft_researched_tfg_email": ("mail_room", True, False, echo_researched_email),
    },
    "chronos": {
        "list_urgent_tasks": ("control_room", False, True, chronos_urgent),
        "build_weekly_plan": ("control_room", False, False, chronos_weekly_plan),
    },
    "pixel": {
        "list_portfolio_priorities": ("portfolio_workshop", False, True, pixel_priorities),
        "build_portfolio_delivery_plan": ("portfolio_workshop", False, False, pixel_delivery_plan),
    },
}
