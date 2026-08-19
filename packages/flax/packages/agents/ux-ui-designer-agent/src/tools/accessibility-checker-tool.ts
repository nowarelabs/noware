import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const accessibilityCheckerTool = defineTool({
  name: 'accessibility_checker_tool',
  description:
    'Call methods on the accessibility-checker-tool service via its RPC binding (ACCESSIBILITY_CHECKER_TOOL). Methods: auditPage, auditComponent. Pass `method` (one of those names) and `args` (an object matching the tool method input).',
  input: v.object({
    method: v.picklist(['auditPage','auditComponent']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { ACCESSIBILITY_CHECKER_TOOL: RpcCallable }).ACCESSIBILITY_CHECKER_TOOL;
    const result = await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'accessibility_checker_tool', method: data.method });
    return { output: result };
  },
});
