import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set([
  "runUnitTests",
  "runIntegrationTests",
  "runE2eTests",
  "generateTestData",
]);

const inputSchema = v.object({
  method: v.picklist(["runUnitTests", "runIntegrationTests", "runE2eTests", "generateTestData"]),
  args: v.optional(v.unknown()),
});

const outputSchema = v.any();

export const testRunnerTool = defineTool({
  name: "test_runner_tool",
  description:
    "Call methods on the test-runner-tool service via its RPC binding (TEST_RUNNER_TOOL). Methods: runUnitTests, runIntegrationTests, runE2eTests, generateTestData. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { TEST_RUNNER_TOOL: RpcCallable }).TEST_RUNNER_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`testRunnerTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "test_runner_tool", method: data.method });
    return { output: result };
  },
});
