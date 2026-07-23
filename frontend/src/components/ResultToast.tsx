import type { Agent, TaskResponse } from "../types";

export function ResultToast({ agent, result, onView, onClose }: {
  agent: Agent; result: TaskResponse; onView: () => void; onClose: () => void;
}) {
  const count = Array.isArray(result.result.items) ? result.result.items.length : 1;
  return <aside className="result-toast" role="status" aria-live="polite">
    <img src={`${import.meta.env.BASE_URL}assets/agents/${agent.id}.png`} alt="" />
    <div><span>Resultado listo</span><strong>{agent.name} ha preparado {count} resultado{count === 1 ? "" : "s"}.</strong></div>
    <button onClick={onView}>Ver resultado</button>
    <button className="toast-close" onClick={onClose} aria-label="Cerrar notificación">×</button>
  </aside>;
}
