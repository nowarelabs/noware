import { createAgentRouter } from "@nowarelabs/agents";
import type { D1Database } from "@cloudflare/workers-types";
import { Hono } from "hono";

import { BusinessDataAnalyst } from "./agents/business-data-analyst";

interface FlaxEnv {
  FLAX_DB?: D1Database;
  [key: string]: unknown;
}

const AGENT_PATH = "/agents/business-data-analyst";

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

const app = new Hono();

// Register every instance id we see traffic for, so dashboards can list them.
app.use("*", async (c, next) => {
  const db = (c.env as FlaxEnv).FLAX_DB;
  const path = new URL(c.req.url).pathname;
  const match = path.match(/^\/agents\/[^/]+\/([^/]+)/);
  if (db && match) {
    const id = match[1];
    try {
      await ensureRegistry(db);
      await db
        .prepare(
          `INSERT INTO flax_instances (id, created_at, last_seen_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
        )
        .bind(id, Date.now(), Date.now())
        .run();
    } catch {
      // registry is best-effort; never block agent traffic on it
    }
  }
  await next();
});

app.get(AGENT_PATH, async (c) => {
  const db = (c.env as FlaxEnv).FLAX_DB;
  if (!db) return c.json({ instances: [] });
  await ensureRegistry(db);
  const { results } = await db
    .prepare("SELECT id, created_at, last_seen_at FROM flax_instances ORDER BY last_seen_at DESC")
    .all<{ id: string; created_at: number; last_seen_at: number }>();
  return c.json({ instances: results });
});

app.route(AGENT_PATH, createAgentRouter(BusinessDataAnalyst));
app.get("/api/ping", (c: any) => c.text("pong"));

export default app;
