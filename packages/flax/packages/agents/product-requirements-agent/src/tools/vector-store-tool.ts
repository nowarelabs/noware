import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["upsert", "delete"]);

export const vectorStoreTool = defineTool({
  name: "vector_store_tool",
  description:
    "Call methods on the vector-store-tool service via its RPC binding (VECTOR_STORE_TOOL). Methods: upsert, query, delete. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: v.object({
    method: v.picklist(["upsert", "query", "delete"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { VECTOR_STORE_TOOL: RpcCallable }).VECTOR_STORE_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`vectorStoreTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "vector_store_tool", method: data.method });
    return { output: result };
  },
});
