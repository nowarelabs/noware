import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const inputSchema = v.object({
  method: v.picklist(["analyzeCode", "getCodeSmells"]),
  args: v.optional(v.unknown()),
});

export const staticAnalysisTool = defineTool({
  name: "static_analysis_tool",
  description:
    "Call methods on the static-analysis-tool service via its RPC binding (STATIC_ANALYSIS_TOOL). Methods: analyzeCode, getCodeSmells. Pass `method` (one of those names) and `args` (an object matching the tool method input).",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => raw as Record<string, unknown> },
  async run({ data, log }) {
    const rpc = (env as unknown as { STATIC_ANALYSIS_TOOL: RpcCallable }).STATIC_ANALYSIS_TOOL;
    const result = await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "static_analysis_tool", method: data.method });
    return { output: result };
  },
});
