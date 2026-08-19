import { defineTool } from '@nowarelabs/agents';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const ciStatusTool = defineTool({
  name: 'ci_status_tool',
  description:
    'Call methods on the ci-status-tool service via its RPC binding (CI_STATUS_TOOL). Methods: getBuildStatus, getTestResults. Pass `method` (one of those names) and `args` (an object matching the tool method input).',
  input: v.object({
    method: v.picklist(['getBuildStatus','getTestResults']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { CI_STATUS_TOOL: RpcCallable }).CI_STATUS_TOOL;
    const result = await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'ci_status_tool', method: data.method });
    return { output: result };
  },
});
