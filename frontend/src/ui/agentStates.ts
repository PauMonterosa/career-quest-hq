import type { AgentStatus } from "../types";

export const agentStates: Record<AgentStatus, { label: string; icon: string; color: string }> = {
  idle: { label: "Disponible", icon: "○", color: "var(--text-3)" },
  walking: { label: "En camino", icon: "→", color: "var(--info)" },
  working: { label: "Trabajando", icon: "◌", color: "var(--gold)" },
  waiting_approval: { label: "Espera aprobación", icon: "!", color: "var(--approval)" },
  completed: { label: "Completado", icon: "✓", color: "var(--success)" },
  error: { label: "Necesita atención", icon: "×", color: "var(--danger)" },
};

