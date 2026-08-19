import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const webSearchTool = defineTool({
  name: "web_search_tool",
  description:
    "Call methods on the web-search-tool service via its RPC binding (WEB_SEARCH_TOOL). Methods: search, fetchPage. Pass `method` (one of those names) and `args` (an object matching the tool method input).",
  input: v.object({
    method: v.picklist(["search", "fetchPage"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { WEB_SEARCH_TOOL: RpcCallable }).WEB_SEARCH_TOOL;
    const result = await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "web_search_tool", method: data.method });
    return { output: result };
  },
});
