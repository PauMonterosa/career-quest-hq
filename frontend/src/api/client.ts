import type { Agent, TaskResponse } from "../types";
import { localAgents, localCalendarFile, runLocalTask } from "../services/localMode";

const API_URL = import.meta.env.VITE_API_URL
  ?? `${window.location.protocol}//${window.location.hostname}:8000`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);
  const response = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal }).finally(() => window.clearTimeout(timeout));
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export const api = {
  agents: () => request<Agent[]>("/agents").catch(() => localAgents()),
  runTask: (agentId: string, skill: string) =>
    request<TaskResponse>(`/agents/${agentId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill }),
    }).catch(() => runLocalTask(agentId, skill)),
  downloadCalendar: async () => {
    let blob: Blob;
    try {
      const response = await fetch(`${API_URL}/calendar/tasks.ics`, { signal: AbortSignal.timeout(1800) });
      if (!response.ok) throw new Error("Calendar API unavailable");
      blob = await response.blob();
    } catch {
      blob = localCalendarFile();
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "career-quest-tareas.ics";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
