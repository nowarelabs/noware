import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(['generateApiDocs','buildDocsSite']);

export const docsGeneratorTool = defineTool({
  name: 'docs_generator_tool',
  description:
    'Call methods on the docs-generator-tool service via its RPC binding (DOCS_GENERATOR_TOOL). Methods: generateApiDocs, buildDocsSite. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['generateApiDocs','buildDocsSite']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { DOCS_GENERATOR_TOOL: RpcCallable }).DOCS_GENERATOR_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`docsGeneratorTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () => rpc[data.method](data.args))
      : await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'docs_generator_tool', method: data.method });
    return { output: result };
  },
});
