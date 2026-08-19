import type { D1Database } from "@cloudflare/workers-types";

import type { AgentStatus, ArtifactRow, ConversationStatus, HitlRow, StageRow } from "./schema";

export async function openStage(
  db: D1Database,
  conversationId: string,
  stage: string,
  agent: string,
  detail?: string,
): Promise<void> {
  const now = Date.now();
  const previous = await db
    .prepare(
      `SELECT stage FROM flax_stages WHERE conversation_id = ? ORDER BY entered_at DESC, id DESC LIMIT 1`,
    )
    .bind(conversationId)
    .first<{ stage: string }>();

  // Close any stage still open.
  await db
    .prepare(
      `UPDATE flax_stages
       SET exited_at = COALESCE(exited_at, ?), outcome = COALESCE(outcome, 'completed')
       WHERE conversation_id = ? AND exited_at IS NULL`,
    )
    .bind(now, conversationId)
    .run();

  // Re-entry into a stage that already ran earlier in this conversation is a backward loop.
  const returned = previous && previous.stage !== stage;
  const reentered = await db
    .prepare(`SELECT COUNT(*) AS n FROM flax_stages WHERE conversation_id = ? AND stage = ?`)
    .bind(conversationId, stage)
    .first<{ n: number }>();

  const entryDetail = returned
    ? `↩ returned`
    : (reentered?.n ?? 0) > 0
      ? `↩ returned`
      : (detail ?? null);
  await db
    .prepare(
      `INSERT INTO flax_stages (conversation_id, stage, agent, entered_at, exited_at, outcome, detail)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .bind(conversationId, stage, agent, now, entryDetail)
    .run();
}

export async function closeOpenStage(
  db: D1Database,
  conversationId: string,
  outcome: string,
  detail?: string,
): Promise<StageRow | null> {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE flax_stages
       SET exited_at = COALESCE(exited_at, ?), outcome = COALESCE(outcome, ?), detail = COALESCE(detail, ?)
       WHERE conversation_id = ? AND exited_at IS NULL`,
    )
    .bind(now, outcome, detail ?? null, conversationId)
    .run();
  const row = await db
    .prepare(
      `SELECT * FROM flax_stages WHERE conversation_id = ? AND exited_at IS NOT NULL
       ORDER BY exited_at DESC, id DESC LIMIT 1`,
    )
    .bind(conversationId)
    .first<StageRow>();
  return row ?? null;
}

export async function currentOpenStage(
  db: D1Database,
  conversationId: string,
): Promise<StageRow | null> {
  const row = await db
    .prepare(
      `SELECT * FROM flax_stages WHERE conversation_id = ? AND exited_at IS NULL
       ORDER BY entered_at DESC, id DESC LIMIT 1`,
    )
    .bind(conversationId)
    .first<StageRow>();
  return row ?? null;
}

export async function listStages(db: D1Database, conversationId: string): Promise<StageRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM flax_stages WHERE conversation_id = ? ORDER BY entered_at ASC, id ASC`)
    .bind(conversationId)
    .all<StageRow>();
  return results ?? [];
}

export async function upsertInstanceMeta(
  db: D1Database,
  conversationId: string,
  meta: {
    title?: string | null;
    origin?: string | null;
    currentStage?: string | null;
    currentAgent?: string | null;
    status?: ConversationStatus;
    lastActivityAt?: number | null;
  },
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (meta.title !== undefined) {
    sets.push("title = ?");
    values.push(meta.title);
  }
  if (meta.origin !== undefined) {
    sets.push("origin = ?");
    values.push(meta.origin);
  }
  if (meta.currentStage !== undefined) {
    sets.push("current_stage = ?");
    values.push(meta.currentStage);
  }
  if (meta.currentAgent !== undefined) {
    sets.push("current_agent = ?");
    values.push(meta.currentAgent);
  }
  if (meta.status !== undefined) {
    sets.push("status = ?");
    values.push(meta.status);
  }
  if (meta.lastActivityAt !== undefined) {
    sets.push("last_activity_at = ?");
    values.push(meta.lastActivityAt);
  }
  if (sets.length === 0) return;
  values.push(conversationId);
  await db
    .prepare(`UPDATE flax_instances SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function setAgentStatus(
  db: D1Database,
  agent: string,
  status: AgentStatus,
  lastError?: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO flax_agents (name, label, stage, status, last_seen_at, last_error, updated_at)
       VALUES (?, ?, (SELECT stage FROM flax_agents WHERE name = ?), ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         status = excluded.status,
         last_seen_at = excluded.last_seen_at,
         last_error = excluded.last_error,
         updated_at = excluded.updated_at`,
    )
    .bind(agent, agent, agent, status, Date.now(), lastError ?? null, Date.now())
    .run();
}

export async function upsertHitl(
  db: D1Database,
  hitl: {
    id: string;
    conversation_id: string;
    type: string;
    title: string;
    summary?: string | null;
    payload?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO flax_hitl (id, conversation_id, type, title, summary, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(
      hitl.id,
      hitl.conversation_id,
      hitl.type,
      hitl.title,
      hitl.summary ?? null,
      hitl.payload !== undefined ? JSON.stringify(hitl.payload) : null,
      Date.now(),
    )
    .run();
}

export async function listHitl(db: D1Database, conversationId: string): Promise<HitlRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM flax_hitl WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`)
    .bind(conversationId)
    .all<HitlRow>();
  return results ?? [];
}

export async function resolveHitl(
  db: D1Database,
  hitlId: string,
  resolution: unknown,
): Promise<HitlRow | null> {
  const now = Date.now();
  const updated = await db
    .prepare(
      `UPDATE flax_hitl SET status = 'resolved', resolution = ?, resolved_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .bind(JSON.stringify(resolution), now, hitlId)
    .run();
  if (updated.meta.changes === 0) {
    return db.prepare("SELECT * FROM flax_hitl WHERE id = ?").bind(hitlId).first<HitlRow>();
  }
  return db.prepare("SELECT * FROM flax_hitl WHERE id = ?").bind(hitlId).first<HitlRow>();
}

export async function upsertArtifact(
  db: D1Database,
  artifact: {
    conversation_id: string;
    stage?: string | null;
    agent?: string | null;
    type: string;
    title?: string | null;
    url_or_ref: string;
  },
): Promise<boolean> {
  const existing = await db
    .prepare(`SELECT id FROM flax_artifacts WHERE conversation_id = ? AND url_or_ref = ?`)
    .bind(artifact.conversation_id, artifact.url_or_ref)
    .first<{ id: string }>();
  if (existing) return false;
  const id = `art-${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO flax_artifacts (id, conversation_id, stage, agent, type, title, url_or_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      artifact.conversation_id,
      artifact.stage ?? null,
      artifact.agent ?? null,
      artifact.type,
      artifact.title ?? null,
      artifact.url_or_ref,
      Date.now(),
    )
    .run();
  return true;
}

export async function listArtifacts(
  db: D1Database,
  conversationId: string,
): Promise<ArtifactRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM flax_artifacts WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`,
    )
    .bind(conversationId)
    .all<ArtifactRow>();
  return results ?? [];
}
