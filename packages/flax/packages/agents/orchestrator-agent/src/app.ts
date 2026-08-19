import { createAgentRouter } from '@nowarelabs/agents';
import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';

import { Orchestrator } from './agents/orchestrator';
import { ensureSchema, hasOpenStage, patchInstance, pendingHitlCount } from './dashboard-db';

interface FlaxEnv {
  FLAX_DB?: D1Database;
  [key: string]: unknown;
}

const AGENT_PATH = '/agents/orchestrator';

const app = new Hono();

// Register every instance id we see traffic for, so dashboards can list them,
// and keep the dashboard-facing metadata current: title/activity on ingress,
// run status once the orchestrator's response settles.
app.use('*', async (c, next) => {
  const db = (c.env as FlaxEnv).FLAX_DB;
  const match = c.req.url.match(/\/agents\/[^/]+\/([^/]+)/);
  if (!db || !match) {
    await next();
    return;
  }
  const id = match[1];
  const isPost = c.req.method === 'POST';

  try {
    await ensureSchema(db);
    const now = Date.now();
    let title: string | null = null;
    if (isPost) {
      const clone = c.req.raw.clone();
      try {
        const body = (await clone.json()) as { kind?: string; body?: string } | null;
        if (body?.kind === 'user' && typeof body.body === 'string') {
          title = body.body.trim().slice(0, 64);
        }
      } catch {
        // non-JSON body; keep title null
      }
    }
    await db
      .prepare(
        `INSERT INTO flax_instances (id, created_at, last_seen_at, title)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           last_seen_at = excluded.last_seen_at,
           title = COALESCE(flax_instances.title, excluded.title),
           status = CASE WHEN ? = 'POST' THEN 'running' ELSE flax_instances.status END,
           last_activity_at = CASE WHEN ? = 'POST' THEN ? ELSE flax_instances.last_activity_at END`,
      )
      .bind(id, now, now, title, c.req.method, c.req.method, now)
      .run();
  } catch {
    // registry is best-effort; never block agent traffic on it
  }

  await next();

  if (isPost) {
    try {
      const [pending, open] = await Promise.all([pendingHitlCount(db, id), hasOpenStage(db, id)]);
      await patchInstance(db, id, {
        currentAgent: 'orchestrator',
        status: pending > 0 ? 'blocked_on_human' : open ? 'running' : 'completed',
        lastActivityAt: Date.now(),
      });
    } catch {
      // status transition is best-effort
    }
  }
});

app.get(AGENT_PATH, async (c) => {
  const db = (c.env as FlaxEnv).FLAX_DB;
  if (!db) return c.json({ instances: [] });
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, created_at, last_seen_at, title, origin, current_stage, current_agent, status, last_activity_at
       FROM flax_instances ORDER BY COALESCE(last_activity_at, last_seen_at) DESC`,
    )
    .all<Record<string, unknown>>();
  return c.json({ instances: results });
});

app.route(AGENT_PATH, createAgentRouter(Orchestrator));
app.get('/api/ping', (c: any) => c.text('pong'));

export default app;
