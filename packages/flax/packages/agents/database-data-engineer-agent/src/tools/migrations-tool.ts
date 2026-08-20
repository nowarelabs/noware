import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

const MUTATIONS = new Set(["createMigration", "runMigration", "rollbackMigration"]);

const inputSchema = v.object({
  method: v.picklist(["createMigration", "runMigration", "rollbackMigration"]),
  args: v.optional(v.unknown()),
});

export const migrationsTool = defineTool({
  name: "migrations_tool",
  description:
    "Call methods on the migrations-tool service via its RPC binding (MIGRATIONS_TOOL). Methods: createMigration, runMigration, rollbackMigration. Pass `method` (one of those names) and `args` (an object matching the tool method input). Durable methods are recorded and replayed, never duplicated, after a crash.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => raw as Record<string, unknown> },
  durable: true,
  async run({ data, step, log }) {
    const rpc = (env as unknown as { MIGRATIONS_TOOL: RpcCallable }).MIGRATIONS_TOOL;
    const result = MUTATIONS.has(data.method)
      ? await step!.do(`migrationsTool.${data.method}:${JSON.stringify(data.args ?? {})}`, () =>
          rpc[data.method](data.args),
        )
      : await rpc[data.method](data.args);
    log.info("tool.invoked", { tool: "migrations_tool", method: data.method });
    return { output: result };
  },
});
