import { agentActions } from "../data/agentActions";
import type { Agent } from "../types";
import { AgentStatusBadge } from "../ui/AgentStatusBadge";
import { ActionCard } from "./ActionCard";

interface Props {
  agent: Agent | null;
  busy: boolean;
  error: string | null;
  onRun: (skill: string) => void;
}

export function AgentPanel({ agent, busy, error, onRun }: Props) {
  if (!agent) return <aside className="agent-inspector empty-state"><span>Agentes del HQ</span><h2>Selecciona un agente</h2><p>También puedes utilizar la navegación accesible situada bajo el mapa.</p></aside>;
  return <aside className="agent-inspector" style={{ "--agent-accent": agent.avatar.color } as React.CSSProperties}>
    <section className="agent-hero">
      <div className="hero-portrait"><img src={`${import.meta.env.BASE_URL}assets/agents/${agent.id}.png`} alt={`Retrato de ${agent.name}`} /></div>
      <div className="hero-copy"><span>{agent.role}</span><h2>{agent.name}</h2><p>“{agent.personality}”</p></div>
    </section>
    <div className="agent-meta">
      <AgentStatusBadge status={agent.status} />
      <span><small>Sala actual</small>{agent.current_room.replaceAll("_", " ")}</span>
    </div>
    {agent.current_task && <section className="current-task"><small>TAREA ACTUAL</small><strong>{agent.current_task}</strong></section>}
    <section className="inspector-section">
      <div className="section-heading"><div><span>Capacidades</span><h3>¿Qué quieres conseguir?</h3></div><small>{agentActions[agent.id]?.length ?? 0} acciones</small></div>
      <div className="action-list">{agentActions[agent.id]?.map(action =>
        <ActionCard key={action.skill} action={action} busy={busy} onRun={() => onRun(action.skill)} />)}
      </div>
    </section>
    {busy && <div className="loading-state" role="status"><i /><span><strong>{agent.name} está trabajando</strong>El progreso también se refleja en la sala.</span></div>}
    {error && <div className="error-state" role="alert"><strong>No se pudo completar la acción</strong><p>Comprueba que el backend esté disponible e inténtalo de nuevo.</p><details><summary>Detalles técnicos</summary>{error}</details></div>}
  </aside>;
}
