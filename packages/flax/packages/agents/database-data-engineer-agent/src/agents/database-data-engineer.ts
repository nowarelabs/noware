"use agent";

import {
  GeneralSubagent,
  useAgentFinish,
  useAgentStart,
  useDataWriter,
  useDelivery,
  useInitialData,
  useInstruction,
  useModel,
  usePersistentState,
  useResponseFinish,
  useResponseStart,
  useSandbox,
  useSubagent,
  useTool,
  bash,
  defineAgent,
} from "@nowarelabs/agents";
import * as v from "valibot";
import { Bash, InMemoryFs } from "just-bash";

import { dbClientTool } from "../tools/db-client-tool";
import { migrationsTool } from "../tools/migrations-tool";
import { queryProfilerTool } from "../tools/query-profiler-tool";

interface MigrationState {
  status: "idle" | "planning" | "applied" | "done";
  object: string;
}

const databaseDataEngineer = defineAgent("database-data-engineer", () => {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "low",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Never run a destructive query or apply a migration without review first. Normalize appropriately and model entities, keys, and relationships to match access patterns, avoiding unnecessary joins in hot paths. Index for observed query patterns with composite ordering, covering indexes, and partial indexes, and avoid over-indexing write-heavy tables. Design ETL/ELT pipelines that are idempotent, incremental, and observable, choosing batch vs streaming based on latency requirements and backfill needs. Delegate migration plans to the migration-reviewer subagent before applying.",
  );

  const [migration, setMigration] = usePersistentState<MigrationState>("migration", {
    status: "idle",
    object: "",
  });

  const writeDatabase = useDataWriter("database", {
    schema: v.object({
      status: v.picklist(["idle", "planning", "applied", "done"]),
      object: v.string(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ object?: string }>();

  useAgentStart(({ log }) => {
    const object =
      migration.object ||
      initialData?.object ||
      (delivery.kind === "signal" ? delivery.attributes?.object : undefined) ||
      "schema";
    log.info("database.started", { object });
    setMigration({ ...migration, status: "planning", object });
    writeDatabase({ status: "planning", object });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => {
    const r = response as { toolCalls?: unknown[] };
    return {
      elapsedMs: Date.now() - (metadata.startedAt as number),
      toolCalls: r.toolCalls?.length ?? 0,
    };
  });

  useAgentFinish(({ log, response }) => {
    const r = response as { toolCalls?: unknown[] };
    log.info("database.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    setMigration({ ...migration, status: "done" });
    writeDatabase({ status: "done", object: migration.object });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent(
    "migration-reviewer",
    "Reviews a schema migration for data loss, irreversibility, and lock risk before it is applied.",
    GeneralSubagent,
  );
  useTool(dbClientTool);
  useTool(migrationsTool);
  useTool(queryProfilerTool);

  return `You are the Database Data Engineer agent. Model data deliberately, index for real query patterns rather than speculative ones, and design ETL/ELT pipelines that are idempotent, observable, and reversible.`;
});

export default databaseDataEngineer;
