import { defineTool } from '@nowarelabs/agents';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const cloudPricingTool = defineTool({
  name: 'cloud_pricing_tool',
  description:
    'Call methods on the cloud-pricing-tool service via its RPC binding (CLOUD_PRICING_TOOL). Methods: estimateCost, compareInstanceTypes. Pass `method` (one of those names) and `args` (an object matching the tool method input).',
  input: v.object({
    method: v.picklist(['estimateCost','compareInstanceTypes']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { CLOUD_PRICING_TOOL: RpcCallable }).CLOUD_PRICING_TOOL;
    const result = await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'cloud_pricing_tool', method: data.method });
    return { output: result };
  },
});
