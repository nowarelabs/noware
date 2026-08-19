import { defineTool } from '@nowarelabs/agents';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(['installDependency','updateDependency']);

export const packageManagerTool = defineTool({
  name: 'package_manager_tool',
  description:
    'Call methods on the package-manager-tool service via its RPC binding (PACKAGE_MANAGER_TOOL). Methods: installDependency, updateDependency, auditDependencies. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.',
  input: v.object({
    method: v.picklist(['installDependency','updateDependency','auditDependencies']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { PACKAGE_MANAGER_TOOL: RpcCallable }).PACKAGE_MANAGER_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`packageManagerTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () => rpc[data.method](data.args))
      : await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'package_manager_tool', method: data.method });
    return { output: result };
  },
});
