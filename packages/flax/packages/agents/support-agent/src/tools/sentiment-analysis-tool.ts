import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const sentimentAnalysisTool = defineTool({
  name: "sentiment_analysis_tool",
  description:
    "Call methods on the sentiment-analysis-tool service via its RPC binding (SENTIMENT_ANALYSIS_TOOL). Methods: analyzeSentiment, clusterFeedback. Pass `method` (one of those names) and `args` (an object matching the tool method input).",
  input: v.object({
    method: v.picklist(["analyzeSentiment", "clusterFeedback"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { SENTIMENT_ANALYSIS_TOOL: RpcCallable })
      .SENTIMENT_ANALYSIS_TOOL;
    const result = await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "sentiment_analysis_tool", method: data.method });
    return { output: result };
  },
});
