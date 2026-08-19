import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const logAggregationTool = defineTool({
  name: "log_aggregation_tool",
  description:
    "Call methods on the log-aggregation-tool service via its RPC binding (LOG_AGGREGATION_TOOL). Methods: queryLogs, tailLogs. Pass `method` (one of those names) and `args` (an object matching the tool method input).",
  input: v.object({
    method: v.picklist(["queryLogs", "tailLogs"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { LOG_AGGREGATION_TOOL: RpcCallable }).LOG_AGGREGATION_TOOL;
    const result = await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "log_aggregation_tool", method: data.method });
    return { output: result };
  },
});
