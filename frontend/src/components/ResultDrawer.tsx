import type { Agent, TaskResponse } from "../types";
import { AgentStatusBadge } from "../ui/AgentStatusBadge";
import { api } from "../api/client";

const labels: Record<string, string> = {
  name: "Nombre", university: "Universidad", score: "Puntuación", reason: "Motivo", title: "Título",
  centre: "Centro", supervisor: "Supervisor", task: "Tarea", planned_date: "Día asignado",
  due_date: "Fecha límite", priority: "Prioridad", status: "Estado",
  definition_of_done: "Terminado cuando", next_step: "Siguiente paso", next_action: "Siguiente paso", deliverable: "Entregable",
};

function label(key: string) { return labels[key] ?? key.replaceAll("_", " "); }

export function ResultDrawer({ agent, result, open, onToggle }: {
  agent: Agent | null; result: TaskResponse | null; open: boolean; onToggle: () => void;
}) {
  if (!agent || !result) return null;
  const output = result.result;
  const items = Array.isArray(output.items) ? output.items as Array<Record<string, unknown>> : [];
  return <section className={`result-drawer ${open ? "drawer-open" : ""}`} aria-label="Resultado actual">
    <button className="drawer-summary" onClick={onToggle} aria-expanded={open}>
      <img src={`${import.meta.env.BASE_URL}assets/agents/${agent.id}.png`} alt="" />
      <span><small>RESULTADO ACTUAL</small><strong>{String(output.title ?? "Resultado del agente")}</strong></span>
      <AgentStatusBadge status={result.status} />
      <i aria-hidden="true">{open ? "⌄" : "⌃"}</i>
    </button>
    {open && <div className="drawer-content">
      {Boolean(output.summary) && typeof output.summary === "object" && <div className="drawer-metrics">
        {Object.entries(output.summary as Record<string, unknown>).map(([key, value]) => <div key={key}><b>{String(value)}</b><span>{label(key)}</span></div>)}
      </div>}
      {output.subject ? <article className="drawer-email"><small>ASUNTO</small><strong>{String(output.subject)}</strong><p>{String(output.body ?? "")}</p></article> : null}
      <div className="drawer-items">{items.slice(0, open ? 8 : 0).map((item, index) => {
        const heading = item.task ?? item.deliverable ?? item.entity ?? item.name ?? item.title ?? `Resultado ${index + 1}`;
        return <article key={`${String(heading)}-${index}`}><strong>{String(heading)}</strong>
          {Object.entries(item).filter(([key, value]) => !["task", "deliverable", "entity", "name", "title", "evidence"].includes(key) && value != null).slice(0, 4)
            .map(([key, value]) => <p key={key}><span>{label(key)}</span>{String(value)}</p>)}
          {item.source_url ? <a href={String(item.source_url)} target="_blank" rel="noreferrer">Abrir fuente oficial ↗</a> : null}
        </article>;
      })}</div>
      {result.requires_approval && <div className="approval-panel"><strong>Revisión necesaria</strong><p>Nada se enviará ni publicará sin tu aprobación.</p><button>Revisar borrador</button></div>}
      {result.skill === "build_weekly_plan" && <div className="calendar-export">
        <div><strong>Programar en calendario</strong><p>Descarga las tareas fechadas en un archivo compatible con Google Calendar, Outlook y Apple Calendar.</p></div>
        <button type="button" onClick={() => void api.downloadCalendar()}>Descargar .ics</button>
      </div>}
      <footer className="drawer-audit"><span>Tarea #{result.task_id}</span><span>{result.is_mock ? "Análisis local" : "Ejecución real auditada"}</span></footer>
    </div>}
  </section>;
}
