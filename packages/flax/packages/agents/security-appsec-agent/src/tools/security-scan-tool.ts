import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["runSast", "runDast", "scanDependencies", "scanSecrets"]);

export const securityScanTool = defineTool({
  name: "security_scan_tool",
  description:
    "Call methods on the security-scan-tool service via its RPC binding (SECURITY_SCAN_TOOL). Methods: runSast, runDast, scanDependencies, scanSecrets. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: v.object({
    method: v.picklist(["runSast", "runDast", "scanDependencies", "scanSecrets"]),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { SECURITY_SCAN_TOOL: RpcCallable }).SECURITY_SCAN_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step.do(`securityScanTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "security_scan_tool", method: data.method });
    return { output: result };
  },
});
