import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["createAlert"]);

export const monitoringTool = defineTool({
  name: "monitoring_tool",
  description:
    "Call methods on the monitoring-tool service via its RPC binding (MONITORING_TOOL). Methods: getMetrics, getDashboard, createAlert. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: v.object({
    method: v.picklist(["getMetrics", "getDashboard", "createAlert"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { MONITORING_TOOL: RpcCallable }).MONITORING_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`monitoringTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "monitoring_tool", method: data.method });
    return { output: result };
  },
});
