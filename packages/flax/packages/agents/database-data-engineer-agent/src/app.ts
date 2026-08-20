import { HttpEntrypoint } from "@nowarelabs/entrypoints";
import { createAgentRouter, type AgentRoute } from "@nowarelabs/agents";
import type { D1Database } from "@cloudflare/workers-types";

import agentDef from "./agents/database-data-engineer";

interface FlaxEnv {
  FLAX_DB?: D1Database;
  [key: string]: unknown;
}

const AGENT_PATH = "/agents/database-data-engineer";

let registryReady: Promise<void> | null = null;

function ensureRegistry(db: D1Database): Promise<void> {
  if (!registryReady) {
    registryReady = db
      .prepare(
        `CREATE TABLE IF NOT EXISTS flax_instances (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL
        )`,
      )
      .run()
      .then(() => undefined);
  }
  return registryReady;
}

const routes: AgentRoute[] = [
  // List instances
  {
    method: "GET",
    pattern: AGENT_PATH,
    handler: async (request, env) => {
      const db = (env as FlaxEnv).FLAX_DB;
      if (!db) return Response.json({ instances: [] });
      await ensureRegistry(db);
      const { results } = await db
        .prepare(
          "SELECT id, created_at, last_seen_at FROM flax_instances ORDER BY last_seen_at DESC",
        )
        .all<{ id: string; created_at: number; last_seen_at: number }>();
      return Response.json({ instances: results });
    },
  },
  // Ping
  {
    method: "GET",
    pattern: "/api/ping",
    handler: () => new Response("pong"),
  },
];

export default class AgentEntrypoint extends HttpEntrypoint {
  router = createAgentRouter(agentDef, { routes });
}
