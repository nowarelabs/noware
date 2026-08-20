import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["generateDiagram", "exportDiagram"]);

const inputSchema = v.object({
  method: v.picklist(["generateDiagram", "exportDiagram"]),
  args: v.optional(v.unknown()),
});

export const diagrammingTool = defineTool({
  name: "diagramming_tool",
  description:
    "Call methods on the diagramming-tool service via its RPC binding (DIAGRAMMING_TOOL). Methods: generateDiagram, exportDiagram. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => raw as Record<string, unknown> },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { DIAGRAMMING_TOOL: RpcCallable }).DIAGRAMMING_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`diagrammingTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "diagramming_tool", method: data.method });
    return { output: result };
  },
});
