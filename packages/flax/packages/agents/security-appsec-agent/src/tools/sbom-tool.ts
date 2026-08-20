import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["generateSbom"]);

const inputSchema = v.object({
  method: v.picklist(["generateSbom"]),
  args: v.optional(v.unknown()),
});

const outputSchema = v.any();

export const sbomTool = defineTool({
  name: "sbom_tool",
  description:
    "Call methods on the sbom-tool service via its RPC binding (SBOM_TOOL). Methods: generateSbom. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { SBOM_TOOL: RpcCallable }).SBOM_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`sbomTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "sbom_tool", method: data.method });
    return { output: result };
  },
});
