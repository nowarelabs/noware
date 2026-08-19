import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const taskQueueTool = defineTool({
  name: 'task_queue_tool',
  description:
    'Call methods on the task-queue-tool service via its RPC binding (TASK_QUEUE_TOOL). Methods: enqueueTask, getTaskStatus, assignTask. Pass `method` (one of those names) and `args` (an object matching the tool method input). Enqueues are durable: a completed enqueue is replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['enqueueTask', 'getTaskStatus', 'assignTask']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step }) {
    const rpc = (env as unknown as { TASK_QUEUE_TOOL: RpcCallable }).TASK_QUEUE_TOOL;
    const runName = `task_queue.${data.method}:${JSON.stringify(data.args ?? {})}`;
    return { output: await step.do(runName, () => rpc[data.method](data.args)) };
  },
});
