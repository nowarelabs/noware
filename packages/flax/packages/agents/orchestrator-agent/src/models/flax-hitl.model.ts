import { BaseModel } from "@nowarelabs/models";
import type { D1Database } from "@cloudflare/workers-types";

import { flaxHitlTable, type FlaxHitlRow } from "./schema.js";

export interface HitlRecord {
  id: string;
  conversation_id: string;
  type: string;
  title: string;
  summary?: string;
  payload?: unknown;
}

export class FlaxHitlModel extends BaseModel<
  any,
  any,
  any,
  any,
  typeof flaxHitlTable,
  FlaxHitlRow,
  Partial<FlaxHitlRow>
> {
  static tableName = "flax_hitl";
  static columnTypes = Object.fromEntries(
    Object.entries(flaxHitlTable).map(([k, v]) => [k, v.type]),
  );

  protected persistence: any = null;

  constructor(init: any) {
    super({ ...init, table: init.table ?? flaxHitlTable });
  }

  protected getPersistence() {
    return { db: this.db };
  }

  async insertHitl(hitl: HitlRecord): Promise<void> {
    const db = this.db as D1Database;
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

  async pendingCount(conversationId: string): Promise<number> {
    const db = this.db as D1Database;
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM flax_hitl WHERE conversation_id = ? AND status = ?")
      .bind(conversationId, "pending")
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async resolveHitl(id: string, answer: string): Promise<void> {
    const db = this.db as D1Database;
    const now = Date.now();
    await db
      .prepare(
        `UPDATE flax_hitl SET status = 'resolved', resolution = ?, resolved_at = ? WHERE id = ?`,
      )
      .bind(answer, now, id)
      .run();
  }

  async findByConversationId(conversationId: string): Promise<FlaxHitlRow[]> {
    const db = this.db as D1Database;
    const { results } = await db
      .prepare("SELECT * FROM flax_hitl WHERE conversation_id = ? ORDER BY created_at DESC")
      .bind(conversationId)
      .all<FlaxHitlRow>();
    return results;
  }

  static async ensureSchema(db: D1Database): Promise<void> {
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
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_flax_hitl_conversation ON flax_hitl(conversation_id, status)",
      )
      .run();
  }
}

BaseModel.register("FlaxHitlModel", FlaxHitlModel);
