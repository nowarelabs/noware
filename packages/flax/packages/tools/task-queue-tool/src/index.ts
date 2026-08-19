import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

type TaskStatus = "queued" | "assigned" | "running" | "done" | "failed";

interface TaskRecord {
  id: string;
  task: string;
  payload?: unknown;
  priority: number;
  status: TaskStatus;
  agent?: string;
  createdAt: number;
  updatedAt: number;
}

const tasks = new Map<string, TaskRecord>();

export class TaskQueueTool extends WorkerEntrypoint<Env> {
  async enqueueTask(input: { task: string; payload?: unknown; priority?: number }): Promise<{ taskId: string }> {
    const record: TaskRecord = {
      id: `task-${crypto.randomUUID()}`,
      task: input.task,
      payload: input.payload,
      priority: input.priority ?? 0,
      status: "queued",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tasks.set(record.id, record);
    return { taskId: record.id };
  }

  async getTaskStatus(input: { taskId: string }): Promise<unknown> {
    const task = tasks.get(input.taskId);
    if (!task) throw new Error(`task ${input.taskId} not found`);
    const { payload, ...rest } = task;
    void payload;
    return rest;
  }

  async assignTask(input: { taskId: string; agent?: string }): Promise<{ taskId: string; agent: string }> {
    const task = tasks.get(input.taskId);
    if (!task) throw new Error(`task ${input.taskId} not found`);
    task.agent = input.agent ?? "orchestrator";
    task.status = "assigned";
    task.updatedAt = Date.now();
    return { taskId: task.id, agent: task.agent };
  }

  async listTasks(input: { status?: string; limit?: number }): Promise<unknown> {
    const limit = input.limit ?? 50;
    return [...tasks.values()]
      .filter((t) => !input.status || t.status === input.status)
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((t) => ({ ...t, payload: undefined }));
  }

  async markDone(input: { taskId: string; result?: unknown }): Promise<{ taskId: string; status: TaskStatus }> {
    const task = tasks.get(input.taskId);
    if (!task) throw new Error(`task ${input.taskId} not found`);
    task.status = "done";
    task.updatedAt = Date.now();
    return { taskId: task.id, status: task.status };
  }

  async markFailed(input: { taskId: string; error?: string }): Promise<{ taskId: string; status: TaskStatus }> {
    const task = tasks.get(input.taskId);
    if (!task) throw new Error(`task ${input.taskId} not found`);
    task.status = "failed";
    task.updatedAt = Date.now();
    return { taskId: task.id, status: task.status };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
