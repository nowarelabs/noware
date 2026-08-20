import { HttpEntrypoint } from "@nowarelabs/entrypoints";
import { createAgentRouter, type AgentRoute } from "@nowarelabs/agents";
import type { D1Database } from "@cloudflare/workers-types";

import agentDef from "./agents/orchestrator";
import { ensureSchema } from "./dashboard-db";

interface FlaxEnv {
  FLAX_DB?: D1Database;
  [key: string]: unknown;
}

const AGENT_PATH = "/agents/orchestrator";

const routes: AgentRoute[] = [
  // List instances (with extended dashboard metadata)
  {
    method: "GET",
    pattern: AGENT_PATH,
    handler: async (request, env) => {
      const db = (env as FlaxEnv).FLAX_DB;
      if (!db) return Response.json({ instances: [] });
      await ensureSchema(db);
      const { results } = await db
        .prepare(
          `SELECT id, created_at, last_seen_at, title, origin, current_stage, current_agent, status, last_activity_at
           FROM flax_instances ORDER BY COALESCE(last_activity_at, last_seen_at) DESC`,
        )
        .all<Record<string, unknown>>();
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
