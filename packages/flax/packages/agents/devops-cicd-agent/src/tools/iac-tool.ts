import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(['applyTerraform']);

export const iacTool = defineTool({
  name: 'iac_tool',
  description:
    'Call methods on the iac-tool service via its RPC binding (IAC_TOOL). Methods: planTerraform, applyTerraform, getState. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['planTerraform','applyTerraform','getState']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { IAC_TOOL: RpcCallable }).IAC_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`iacTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () => rpc[data.method](data.args))
      : await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'iac_tool', method: data.method });
    return { output: result };
  },
});
