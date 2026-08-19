import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(['execute']);

export const dbClientTool = defineTool({
  name: 'db_client_tool',
  description:
    'Call methods on the db-client-tool service via its RPC binding (DB_CLIENT_TOOL). Methods: query, execute. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['query','execute']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { DB_CLIENT_TOOL: RpcCallable }).DB_CLIENT_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`dbClientTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () => rpc[data.method](data.args))
      : await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'db_client_tool', method: data.method });
    return { output: result };
  },
});
