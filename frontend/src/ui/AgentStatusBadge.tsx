import type { AgentStatus } from "../types";
import { agentStates } from "./agentStates";

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const state = agentStates[status];
  return <span className="status-badge" style={{ "--status-color": state.color } as React.CSSProperties}
    aria-label={`Estado: ${state.label}`}><i aria-hidden="true">{state.icon}</i>{state.label}</span>;
}

