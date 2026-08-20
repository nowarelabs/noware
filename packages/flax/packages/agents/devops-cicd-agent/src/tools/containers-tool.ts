import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["buildImage", "deployToK8s"]);

const inputSchema = v.object({
  method: v.picklist(["buildImage", "deployToK8s", "getDeploymentStatus"]),
  args: v.optional(v.unknown()),
});

export const containersTool = defineTool({
  name: "containers_tool",
  description:
    "Call methods on the containers-tool service via its RPC binding (CONTAINERS_TOOL). Methods: buildImage, deployToK8s, getDeploymentStatus. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => raw as Record<string, unknown> },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { CONTAINERS_TOOL: RpcCallable }).CONTAINERS_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`containersTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "containers_tool", method: data.method });
    return { output: result };
  },
});
