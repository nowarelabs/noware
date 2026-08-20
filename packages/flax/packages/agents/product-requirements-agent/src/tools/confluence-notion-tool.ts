import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["createPage", "updatePage"]);

const inputSchema = v.object({
  method: v.picklist(["createPage", "updatePage", "searchPages"]),
  args: v.optional(v.unknown()),
});

const outputSchema = v.any();

export const confluenceNotionTool = defineTool({
  name: "confluence_notion_tool",
  description:
    "Call methods on the confluence-notion-tool service via its RPC binding (CONFLUENCE_NOTION_TOOL). Methods: createPage, updatePage, searchPages. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { CONFLUENCE_NOTION_TOOL: RpcCallable }).CONFLUENCE_NOTION_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(
          `confluenceNotionTool.${data.method}:${JSON.stringify(data.args ?? {})}`,
          () => rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "confluence_notion_tool", method: data.method });
    return { output: result };
  },
});
