import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const coverageTool = defineTool({
  name: "coverage_tool",
  description:
    "Call methods on the coverage-tool service via its RPC binding (COVERAGE_TOOL). Methods: getCoverageReport. Pass `method` (one of those names) and `args` (an object matching the tool method input).",
  input: v.object({
    method: v.picklist(["getCoverageReport"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { COVERAGE_TOOL: RpcCallable }).COVERAGE_TOOL;
    const result = await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "coverage_tool", method: data.method });
    return { output: result };
  },
});
