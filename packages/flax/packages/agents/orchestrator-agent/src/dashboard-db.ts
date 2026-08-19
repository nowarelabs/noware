import type { D1Database } from '@cloudflare/workers-types';

/** Rail stage an agent contributes to (mirrors dashboard-api's stageForAgent). */
export const STAGE_MAP: Record<string, string> = {
  'product-requirements': 'requirements',
  'business-data-analyst': 'requirements',
  'solutions-architect': 'architecture',
  'ux-ui-designer': 'design',
  coding: 'coding',
  'database-data-engineer': 'coding',
  'code-review': 'review',
  'qa-test': 'qa',
  'security-appsec': 'security',
  'devops-cicd': 'devops',
  'release-manager': 'release',
  'sre-observability': 'sre-docs',
  documentation: 'sre-docs',
  'support-feedback': 'sre-docs',
  support: 'requirements',
};

export const RAIL_STAGES = [
  'requirements',
  'architecture',
  'design',
  'coding',
  'review',
  'qa',
  'security',
  'devops',
  'release',
  'sre-docs',
] as const;

export type RailStage = (typeof RAIL_STAGES)[number];

export function stageForAgent(agent: string): RailStage {
  return (STAGE_MAP[agent] as RailStage | undefined) ?? 'requirements';
}

let schemaReady: Promise<void> | null = null;

/**
 * Ensure the dashboard-facing tables/columns this agent writes exist. Safe to
 * call repeatedly; D1 has no `ADD COLUMN IF NOT EXISTS`, so we PRAGMA-check.
 */
export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS flax_instances (
            id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL,
            last_seen_at INTEGER NOT NULL
          )`,
        )
        .run();

      const columns = await db.prepare('PRAGMA table_info(flax_instances)').all<{ name: string }>();
      const existing = new Set(columns.results?.map((c) => c.name) ?? []);
      const addColumn = [
        ['title', 'TEXT'],
        ['origin', "TEXT NOT NULL DEFAULT 'orchestrator'"],
        ['current_stage', 'TEXT'],
        ['current_agent', 'TEXT'],
        ['status', "TEXT NOT NULL DEFAULT 'running'"],
        ['last_activity_at', 'INTEGER'],
      ] as const;
      for (const [name, def] of addColumn) {
        if (!existing.has(name)) {
          await db.prepare(`ALTER TABLE flax_instances ADD COLUMN ${name} ${def}`).run();
        }
      }

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS flax_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            stage TEXT NOT NULL,
            agent TEXT NOT NULL,
            entered_at INTEGER NOT NULL,
            exited_at INTEGER,
            outcome TEXT,
            detail TEXT
          )`,
        )
        .run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_flax_stages_conversation ON flax_stages(conversation_id, entered_at)').run();

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS flax_hitl (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            payload TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            resolution TEXT,
            created_at INTEGER NOT NULL,
            resolved_at INTEGER
          )`,
        )
        .run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_flax_hitl_conversation ON flax_hitl(conversation_id, status)').run();
    })();
  }
  return schemaReady;
}

export interface InstancePatch {
  title?: string | null;
  origin?: string | null;
  currentStage?: string | null;
  currentAgent?: string | null;
  status?: string;
  lastActivityAt?: number;
}

export async function patchInstance(db: D1Database, id: string, patch: InstancePatch): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.title !== undefined) { sets.push('title = ?'); values.push(patch.title); }
  if (patch.origin !== undefined) { sets.push('origin = ?'); values.push(patch.origin); }
  if (patch.currentStage !== undefined) { sets.push('current_stage = ?'); values.push(patch.currentStage); }
  if (patch.currentAgent !== undefined) { sets.push('current_agent = ?'); values.push(patch.currentAgent); }
  if (patch.status !== undefined) { sets.push('status = ?'); values.push(patch.status); }
  if (patch.lastActivityAt !== undefined) { sets.push('last_activity_at = ?'); values.push(patch.lastActivityAt); }
  if (sets.length === 0) return;
  values.push(id);
  await db.prepare(`UPDATE flax_instances SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
}

/** Record a stage entry, closing whatever stage was open before it. */
export async function openStage(db: D1Database, conversationId: string, stage: string, agent: string, detail?: string): Promise<void> {
  const now = Date.now();
  const previous = await db
    .prepare('SELECT stage FROM flax_stages WHERE conversation_id = ? ORDER BY entered_at DESC, id DESC LIMIT 1')
    .bind(conversationId)
    .first<{ stage: string }>();

  await db
    .prepare(
      `UPDATE flax_stages SET exited_at = COALESCE(exited_at, ?), outcome = COALESCE(outcome, 'completed')
       WHERE conversation_id = ? AND exited_at IS NULL`,
    )
    .bind(now, conversationId)
    .run();

  const reentered = await db
    .prepare('SELECT COUNT(*) AS n FROM flax_stages WHERE conversation_id = ? AND stage = ?')
    .bind(conversationId, stage)
    .first<{ n: number }>();

  const returned = previous && previous.stage !== stage;
  const entryDetail = returned || (reentered?.n ?? 0) > 0 ? '↩ returned' : detail ?? null;
  await db
    .prepare(
      `INSERT INTO flax_stages (conversation_id, stage, agent, entered_at, exited_at, outcome, detail)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .bind(conversationId, stage, agent, now, entryDetail)
    .run();
}

export async function closeOpenStage(db: D1Database, conversationId: string, outcome = 'completed', detail?: string): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE flax_stages SET exited_at = COALESCE(exited_at, ?), outcome = COALESCE(outcome, ?), detail = COALESCE(detail, ?)
       WHERE conversation_id = ? AND exited_at IS NULL`,
    )
    .bind(now, outcome, detail ?? null, conversationId)
    .run();
}

export interface HitlRecord {
  id: string;
  conversation_id: string;
  type: string;
  title: string;
  summary?: string;
  payload?: unknown;
}

export async function insertHitl(db: D1Database, hitl: HitlRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO flax_hitl (id, conversation_id, type, title, summary, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(hitl.id, hitl.conversation_id, hitl.type, hitl.title, hitl.summary ?? null,
      hitl.payload !== undefined ? JSON.stringify(hitl.payload) : null, Date.now())
    .run();
}

export async function pendingHitlCount(db: D1Database, conversationId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM flax_hitl WHERE conversation_id = ? AND status = ?')
    .bind(conversationId, 'pending')
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function hasOpenStage(db: D1Database, conversationId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM flax_stages WHERE conversation_id = ? AND exited_at IS NULL')
    .bind(conversationId)
    .first<{ n: number }>();
  return (row?.n ?? 0) > 0;
}
