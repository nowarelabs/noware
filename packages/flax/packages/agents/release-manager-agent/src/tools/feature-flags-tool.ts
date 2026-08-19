import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(['createFlag','toggleFlag']);

export const featureFlagsTool = defineTool({
  name: 'feature_flags_tool',
  description:
    'Call methods on the feature-flags-tool service via its RPC binding (FEATURE_FLAGS_TOOL). Methods: createFlag, toggleFlag, getRolloutStatus. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['createFlag','toggleFlag','getRolloutStatus']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { FEATURE_FLAGS_TOOL: RpcCallable }).FEATURE_FLAGS_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`featureFlagsTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () => rpc[data.method](data.args))
      : await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'feature_flags_tool', method: data.method });
    return { output: result };
  },
});
