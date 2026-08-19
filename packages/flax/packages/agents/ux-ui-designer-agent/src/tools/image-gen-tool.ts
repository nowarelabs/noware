import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["generateImage"]);

export const imageGenTool = defineTool({
  name: "image_gen_tool",
  description:
    "Call methods on the image-gen-tool service via its RPC binding (IMAGE_GEN_TOOL). Methods: generateImage. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: v.object({
    method: v.picklist(["generateImage"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { IMAGE_GEN_TOOL: RpcCallable }).IMAGE_GEN_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`imageGenTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "image_gen_tool", method: data.method });
    return { output: result };
  },
});
