import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["createIssue", "updateIssue", "prioritizeBacklog"]);

const inputSchema = v.object({
  method: v.picklist(["createIssue", "updateIssue", "getBacklog", "prioritizeBacklog"]),
  args: v.optional(v.unknown()),
});

const outputSchema = v.any();

export const jiraLinearTool = defineTool({
  name: "jira_linear_tool",
  description:
    "Call methods on the jira-linear-tool service via its RPC binding (JIRA_LINEAR_TOOL). Methods: createIssue, updateIssue, getBacklog, prioritizeBacklog. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { JIRA_LINEAR_TOOL: RpcCallable }).JIRA_LINEAR_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`jiraLinearTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "jira_linear_tool", method: data.method });
    return { output: result };
  },
});
