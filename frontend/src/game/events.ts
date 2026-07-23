import type { Agent, AgentStatus } from "../types";

export const gameEvents = new EventTarget();

export function selectAgent(agentId: string) {
  gameEvents.dispatchEvent(new CustomEvent("agent-selected", { detail: agentId }));
}

export function focusAgent(agentId: string) {
  gameEvents.dispatchEvent(new CustomEvent("agent-focused", { detail: agentId }));
}

export function moveAgent(agentId: string, room: string) {
  gameEvents.dispatchEvent(new CustomEvent("agent-move", { detail: { agentId, room } }));
}

export function syncAgents(agents: Agent[]) {
  gameEvents.dispatchEvent(new CustomEvent("agents-sync", { detail: agents }));
}

export function setVisualStatus(agentId: string, status: AgentStatus) {
  gameEvents.dispatchEvent(new CustomEvent("agent-status", { detail: { agentId, status } }));
}

export function showAgentDialogue(agentId: string, message: string, tone: "mission" | "working" | "result" = "mission") {
  gameEvents.dispatchEvent(new CustomEvent("agent-dialogue", { detail: { agentId, message, tone } }));
}

export function showMapResult(detail: {
  agentId: string;
  agentName: string;
  title: string;
  summary: string;
  nextStep?: string;
  approval?: boolean;
}) {
  gameEvents.dispatchEvent(new CustomEvent("map-result", { detail }));
}

export function clearMapFeedback() {
  gameEvents.dispatchEvent(new Event("map-feedback-clear"));
}
