import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const inputSchema = v.object({
  method: v.picklist(["lintFile", "formatFile", "getDiagnostics"]),
  args: v.optional(v.unknown()),
});

export const lintLangserverTool = defineTool({
  name: "lint_langserver_tool",
  description:
    "Call methods on the lint-langserver-tool service via its RPC binding (LINT_LANGSERVER_TOOL). Methods: lintFile, formatFile, getDiagnostics. Pass `method` (one of those names) and `args` (an object matching the tool method input).",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => raw as Record<string, unknown> },
  async run({ data, log }) {
    const rpc = (env as unknown as { LINT_LANGSERVER_TOOL: RpcCallable }).LINT_LANGSERVER_TOOL;
    const result = await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "lint_langserver_tool", method: data.method });
    return { output: result };
  },
});
