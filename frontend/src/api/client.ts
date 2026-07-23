import type { Agent, TaskResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL
  ?? `${window.location.protocol}//${window.location.hostname}:8000`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export const api = {
  agents: () => request<Agent[]>("/agents"),
  runTask: (agentId: string, skill: string) =>
    request<TaskResponse>(`/agents/${agentId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill }),
    }),
  calendarUrl: () => `${API_URL}/calendar/tasks.ics`,
};
