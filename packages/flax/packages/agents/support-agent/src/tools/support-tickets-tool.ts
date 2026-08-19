import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(['createBacklogItemFromTicket']);

export const supportTicketsTool = defineTool({
  name: 'support_tickets_tool',
  description:
    'Call methods on the support-tickets-tool service via its RPC binding (SUPPORT_TICKETS_TOOL). Methods: getTickets, createBacklogItemFromTicket. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['getTickets','createBacklogItemFromTicket']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { SUPPORT_TICKETS_TOOL: RpcCallable }).SUPPORT_TICKETS_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`supportTicketsTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () => rpc[data.method](data.args))
      : await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'support_tickets_tool', method: data.method });
    return { output: result };
  },
});
