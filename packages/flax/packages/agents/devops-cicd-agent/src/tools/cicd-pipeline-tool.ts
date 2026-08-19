import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(['triggerPipeline','provisionEnvironment']);

export const cicdPipelineTool = defineTool({
  name: 'cicd_pipeline_tool',
  description:
    'Call methods on the cicd-pipeline-tool service via its RPC binding (CICD_PIPELINE_TOOL). Methods: triggerPipeline, getPipelineStatus, provisionEnvironment. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['triggerPipeline','getPipelineStatus','provisionEnvironment']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { CICD_PIPELINE_TOOL: RpcCallable }).CICD_PIPELINE_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`cicdPipelineTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () => rpc[data.method](data.args))
      : await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'cicd_pipeline_tool', method: data.method });
    return { output: result };
  },
});
