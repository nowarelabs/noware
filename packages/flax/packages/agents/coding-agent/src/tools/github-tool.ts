import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set([
  "createPullRequest",
  "mergePullRequest",
  "createBranch",
  "commitFiles",
  "createTag",
]);

export const githubTool = defineTool({
  name: "github_tool",
  description:
    "Call methods on the github-tool service via its RPC binding (GITHUB_TOOL). Methods: createPullRequest, getPullRequest, mergePullRequest, getIssue, createBranch, commitFiles, createTag, getDiff, getCiStatus. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: v.object({
    method: v.picklist([
      "createPullRequest",
      "getPullRequest",
      "mergePullRequest",
      "getIssue",
      "createBranch",
      "commitFiles",
      "createTag",
      "getDiff",
      "getCiStatus",
    ]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { GITHUB_TOOL: RpcCallable }).GITHUB_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`githubTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "github_tool", method: data.method });
    return { output: result };
  },
});
