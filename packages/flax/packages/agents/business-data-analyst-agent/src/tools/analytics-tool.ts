import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const analyticsTool = defineTool({
  name: 'analytics_tool',
  description:
    'Call methods on the analytics-tool service via its RPC binding (ANALYTICS_TOOL). Methods: getFunnel, getCohort, queryEvent. Pass `method` (one of those names) and `args` (an object matching the tool method input).',
  input: v.object({
    method: v.picklist(['getFunnel','getCohort','queryEvent']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { ANALYTICS_TOOL: RpcCallable }).ANALYTICS_TOOL;
    const result = await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'analytics_tool', method: data.method });
    return { output: result };
  },
});
