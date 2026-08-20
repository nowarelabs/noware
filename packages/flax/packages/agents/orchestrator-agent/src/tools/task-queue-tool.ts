import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import type { ITaskQueuePort, TaskQueueInput, TaskQueueOutput } from "@nowarelabs/agent-ports";
import type { UseCaseResult } from "@nowarelabs/shared";

const inputSchema = v.object({
  method: v.picklist(["enqueueTask", "getTaskStatus", "assignTask"]),
  args: v.optional(v.unknown()),
});

const outputSchema = v.any();

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

class LocalTaskQueueGateway implements ITaskQueuePort {
  async execute(input: TaskQueueInput): Promise<UseCaseResult<TaskQueueOutput>> {
    try {
      const rpc = (env as unknown as { TASK_QUEUE_TOOL: RpcCallable }).TASK_QUEUE_TOOL;
      const result = await rpc[input.method](input.args);
      return { success: true, data: result as TaskQueueOutput, status: "delivered" };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

export const taskQueueTool = defineTool({
  name: "task_queue_tool",
  description:
    "Call methods on the task-queue-tool service via its RPC binding (TASK_QUEUE_TOOL). Methods: enqueueTask, getTaskStatus, assignTask. Pass `method` (one of those names) and `args` (an object matching the tool method input). Enqueues are durable: a completed enqueue is replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  durable: true,
  async run({ data, step }) {
    const port = new LocalTaskQueueGateway();
    const runName = `task_queue.${data.method}:${JSON.stringify(data.args ?? {})}`;
    const result = await step!.do(runName, () => port.execute(data as TaskQueueInput));

    if (result.success) {
      return { output: result.data };
    }
    throw result.error;
  },
});
