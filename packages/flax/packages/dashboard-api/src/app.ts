import { Hono } from 'hono';

import { listRoster } from './agents';
import {
  convertManifestCode,
  getInstallStatus,
  ghFetch,
  resolveInstallation,
  saveAppRow,
  saveInstallRow,
  type InstallStatus,
} from './github';
import { appManifest } from './github';
import { scanConversation } from './scan';
import {
  ensureSchema,
  type HitlRow,
  type InstanceRow,
} from './schema';
import {
  listArtifacts,
  listHitl,
  listStages,
  resolveHitl,
  upsertInstanceMeta,
} from './store';

const GITHUB_WEB = 'https://github.com';
const ORCHESTRATOR_ROUTE = '/agents/orchestrator';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/ping', (c) => c.text('pong'));

// ---------------------------------------------------------------- conversations

app.get('/api/conversations', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const filter = c.req.query('status')?.split(',').filter(Boolean) ?? [];
  let sql =
    `SELECT i.*,
       (SELECT COUNT(*) FROM flax_stages s WHERE s.conversation_id = i.id) AS stage_count,
       (SELECT COUNT(*) FROM flax_hitl h WHERE h.conversation_id = i.id AND h.status = 'pending') AS pending_hitl,
       (SELECT COUNT(*) FROM flax_artifacts a WHERE a.conversation_id = i.id) AS artifact_count
     FROM flax_instances i`;
  const binds: string[] = [];
  if (filter.length > 0) {
    sql += ` WHERE i.status IN (${filter.map(() => '?').join(', ')})`;
    binds.push(...filter);
  }
  sql += ` ORDER BY COALESCE(i.last_activity_at, i.last_seen_at) DESC, i.created_at DESC`;
  const { results } = await db.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  return c.json({ conversations: results });
});

app.post('/api/conversations', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const body = (await c.req.json().catch(() => null)) as { message?: string; title?: string; origin?: string } | null;
  const message = body?.message?.trim();
  if (!message) return c.json({ error: 'message is required' }, 400);

  const id = `conv-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const title = body?.title?.trim() || message.slice(0, 64);
  const origin = body?.origin === 'support' ? 'support' : 'orchestrator';
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO flax_instances (id, created_at, last_seen_at, title, origin, status, current_agent, last_activity_at)
       VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
    )
    .bind(id, now, now, title, origin, 'orchestrator', now)
    .run();

  const res = await c.env.ORCHESTRATOR_AGENT.fetch(
    new Request(`http://localhost${ORCHESTRATOR_ROUTE}/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'user', body: message }),
    }),
  );
  let admission: unknown = null;
  if (res.ok) {
    admission = await res.json().catch(() => null);
  }
  return c.json({ id, title, origin, admission });
});

app.get('/api/conversations/:id', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const id = c.req.param('id');
  const row = await db.prepare('SELECT * FROM flax_instances WHERE id = ?').bind(id).first<InstanceRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const [stages, hitl, artifacts] = await Promise.all([
    listStages(db, id),
    listHitl(db, id),
    listArtifacts(db, id),
  ]);
  return c.json({
    conversation: {
      id: row.id,
      title: row.title,
      origin: row.origin,
      currentStage: row.current_stage,
      currentAgent: row.current_agent,
      status: row.status,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at ?? row.last_seen_at,
      stages,
      hitl,
      artifacts,
    },
  });
});

app.post('/api/conversations/:id/scan', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const id = c.req.param('id');
  const result = await scanConversation(db, c.env, id);
  return c.json(result);
});

app.get('/api/conversations/:id/stages', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const id = c.req.param('id');
  return c.json({ stages: await listStages(db, id) });
});

app.get('/api/conversations/:id/hitl', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const id = c.req.param('id');
  return c.json({ hitl: await listHitl(db, id) });
});

app.get('/api/conversations/:id/artifacts', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const id = c.req.param('id');
  return c.json({ artifacts: await listArtifacts(db, id) });
});

// ---------------------------------------------------------------- HITL

/** Resolve a pending HITL request: persist resolution, unblock the orchestrator. */
app.post('/api/hitl/:id/resolve', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const resolution = (body?.resolution ?? body ?? {}) as Record<string, unknown>;

  const hitl = await db.prepare('SELECT * FROM flax_hitl WHERE id = ?').bind(id).first<HitlRow>();
  if (!hitl) return c.json({ error: 'not found' }, 404);

  const resolved = await resolveHitl(db, id, resolution);
  const note =
    typeof body?.note === 'string' && body.note.trim()
      ? body.note.trim()
      : JSON.stringify(resolution);

  // PR review approval → actually merge the PR through github-tool.
  let merge: { merged: boolean } | null = null;
  if (hitl.type === 'pr-review' && resolution.approved === true) {
    const payload = parsePayload(hitl.payload);
    const repo = payload.repo;
    const prNumber = payload.prNumber ?? payload.pr_number;
    if (typeof repo === 'string' && typeof prNumber === 'number') {
      try {
        const rpc = (c.env as unknown as Record<string, { mergePullRequest: (i: unknown) => Promise<{ merged: boolean }> }>).GITHUB_TOOL;
        merge = await rpc.mergePullRequest({ repo, prNumber });
      } catch (err) {
        merge = { merged: false };
        void err;
      }
    }
  }

  await upsertInstanceMeta(db, hitl.conversation_id, {
    status: 'running',
    lastActivityAt: Date.now(),
  });

  // Unblock the orchestrator with a structured user message carrying the decision.
  const messageBody = `[HITL resolved] "${hitl.title}" (${hitl.type}). Resolution: ${note}${merge ? ` PR merged: ${JSON.stringify(merge)}` : ''}`;
  const res = await c.env.ORCHESTRATOR_AGENT.fetch(
    new Request(`http://localhost${ORCHESTRATOR_ROUTE}/${encodeURIComponent(hitl.conversation_id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'user', body: messageBody }),
    }),
  );
  const admitted = res.ok;
  return c.json({ hitl: resolved, merge, unblocked: admitted });
});

function parsePayload(payload: string | null): Record<string, unknown> {
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- roster

app.get('/api/agents', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  return c.json({ agents: await listRoster(db) });
});

// ---------------------------------------------------------------- GitHub App

app.get('/api/github/status', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const status = await getInstallStatus(db);
  const origin = new URL(c.req.url).origin;
  return c.json({
    ...status,
    manifest: appManifest(origin),
    installUrl: status.app ? `${GITHUB_WEB}/apps/${status.app.slug}/installations/new` : null,
  });
});

/** Serve the App Manifest JSON so the manifest-flow button works from the setup screen. */
app.get('/api/github/app-manifest', (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(appManifest(origin));
});

app.post('/api/github/app/configure', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const body = (await c.req.json().catch(() => null)) as {
    appId?: string;
    slug?: string;
    clientId?: string;
    clientSecret?: string;
    privateKey?: string;
  } | null;
  if (!body?.appId || !body?.privateKey) {
    return c.json({ error: 'appId and privateKey are required' }, 400);
  }
  await saveAppRow(db, {
    app_id: String(body.appId),
    slug: body.slug ?? 'flax',
    client_id: body.clientId ?? '',
    client_secret: body.clientSecret ?? '',
    private_key: body.privateKey,
  });
  const status = await getInstallStatus(db);
  return c.json(status);
});

/** GitHub App Manifest flow: exchange the one-time code for app credentials. */
app.get('/api/github/app-manifest-callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.redirect('/#/setup?error=manifest-code-missing');
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  try {
    const app = await convertManifestCode(code);
    await saveAppRow(db, {
      app_id: String(app.id),
      slug: app.slug,
      client_id: app.client_id,
      client_secret: app.client_secret,
      private_key: app.pem,
    });
    return c.redirect('/#/setup?installed=app');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.redirect(`/#/setup?error=${encodeURIComponent(message)}`);
  }
});

/** Start installation: bounce the user to GitHub's "Install" page for our App. */
app.get('/api/github/install/start', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const status = await getInstallStatus(db);
  if (!status.app?.slug) return c.json({ error: 'Create the GitHub App first (setup screen)' }, 400);
  return c.redirect(`${GITHUB_WEB}/apps/${status.app.slug}/installations/new`);
});

/** Install callback: record the org-scoped installation and mark binding live. */
app.get('/api/github/install/callback', async (c) => {
  const installationId = c.req.query('installation_id');
  if (!installationId) return c.redirect('/#/setup?error=install-code-missing');
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  try {
    const { org, account_type } = await resolveInstallation(db, installationId);
    await saveInstallRow(db, { installation_id: installationId, org, account_type });
    return c.redirect('/#/setup?installed=yes');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.redirect(`/#/setup?error=${encodeURIComponent(message)}`);
  }
});

/** Manual verify/complete for setups where GitHub's redirect is not reachable. */
app.post('/api/github/install/complete', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const body = (await c.req.json().catch(() => null)) as { installationId?: string } | null;
  const installationId = body?.installationId?.trim();
  if (!installationId) return c.json({ error: 'installationId is required' }, 400);
  try {
    const { org, account_type } = await resolveInstallation(db, installationId);
    await saveInstallRow(db, { installation_id: installationId, org, account_type });
    const status = await getInstallStatus(db);
    return c.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

/** Webhook receiver for installation events (best-effort; the callback path covers installs). */
app.post('/api/github/webhook', async (c) => {
  const db = c.env.FLAX_DB;
  await ensureSchema(db);
  const body = (await c.req.json().catch(() => null)) as {
    action?: string;
    installation?: { id?: number; account?: { login?: string; type?: string } };
  } | null;
  const installation = body?.installation;
  if (body?.action === 'created' && installation?.id) {
    try {
      const { org, account_type } = await resolveInstallation(db, String(installation.id));
      await saveInstallRow(db, { installation_id: String(installation.id), org, account_type });
    } catch {
      // no-op
    }
  }
  return c.json({ ok: true });
});

/** Proxy the SPA's agent traffic (chat history + SSE stream) to the orchestrator. */
app.all('/agents/*', async (c) => {
  const res = await c.env.ORCHESTRATOR_AGENT.fetch(c.req.raw);
  return res;
});

// ---------------------------------------------------------------- SPA + assets

app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  return res.status === 404
    ? c.env.ASSETS.fetch(new Request(new URL('/', c.req.url)))
    : res;
});

export { app, type InstallStatus };
