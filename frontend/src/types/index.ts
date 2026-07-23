export type AgentStatus = "idle" | "walking" | "working" | "waiting_approval" | "completed" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  current_room: string;
  current_task: string | null;
  status: AgentStatus;
  task_queue: unknown[];
  last_result: Record<string, unknown> | null;
  avatar: { color: string; accessory: string };
}

export interface TaskResponse {
  task_id: number;
  agent_id: string;
  skill: string;
  status: AgentStatus;
  requires_approval: boolean;
  is_mock: boolean;
  result: Record<string, unknown>;
}

