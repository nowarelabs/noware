import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["createIncident", "resolveIncident"]);

const inputSchema = v.object({
  method: v.picklist(["createIncident", "getOnCall", "resolveIncident"]),
  args: v.optional(v.unknown()),
});

export const pagerdutyTool = defineTool({
  name: "pagerduty_tool",
  description:
    "Call methods on the pagerduty-tool service via its RPC binding (PAGERDUTY_TOOL). Methods: createIncident, getOnCall, resolveIncident. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => raw as Record<string, unknown> },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { PAGERDUTY_TOOL: RpcCallable }).PAGERDUTY_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`pagerdutyTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "pagerduty_tool", method: data.method });
    return { output: result };
  },
});
