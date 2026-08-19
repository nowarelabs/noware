import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const queryProfilerTool = defineTool({
  name: 'query_profiler_tool',
  description:
    'Call methods on the query-profiler-tool service via its RPC binding (QUERY_PROFILER_TOOL). Methods: explainQuery, profileQuery. Pass `method` (one of those names) and `args` (an object matching the tool method input).',
  input: v.object({
    method: v.picklist(['explainQuery','profileQuery']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { QUERY_PROFILER_TOOL: RpcCallable }).QUERY_PROFILER_TOOL;
    const result = await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'query_profiler_tool', method: data.method });
    return { output: result };
  },
});
