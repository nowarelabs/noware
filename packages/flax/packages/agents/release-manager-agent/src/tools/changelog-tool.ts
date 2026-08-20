import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["generateChangelog"]);

const inputSchema = v.object({
  method: v.picklist(["generateChangelog", "getVersionHistory"]),
  args: v.optional(v.unknown()),
});

const outputSchema = v.any();

export const changelogTool = defineTool({
  name: "changelog_tool",
  description:
    "Call methods on the changelog-tool service via its RPC binding (CHANGELOG_TOOL). Methods: generateChangelog, getVersionHistory. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { CHANGELOG_TOOL: RpcCallable }).CHANGELOG_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`changelogTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "changelog_tool", method: data.method });
    return { output: result };
  },
});
