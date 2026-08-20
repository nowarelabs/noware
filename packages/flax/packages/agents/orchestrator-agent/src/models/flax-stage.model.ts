import { BaseModel } from "@nowarelabs/models";
import type { D1Database } from "@cloudflare/workers-types";

import { flaxStagesTable, type FlaxStageRow } from "./schema.js";

export class FlaxStageModel extends BaseModel<
  any,
  any,
  any,
  any,
  typeof flaxStagesTable,
  FlaxStageRow,
  Partial<FlaxStageRow>
> {
  static tableName = "flax_stages";
  static columnTypes = Object.fromEntries(
    Object.entries(flaxStagesTable).map(([k, v]) => [k, v.type]),
  );

  protected persistence: any = null;

  constructor(init: any) {
    super({ ...init, table: init.table ?? flaxStagesTable });
  }

  protected getPersistence() {
    return { db: this.db };
  }

  async openStage(
    conversationId: string,
    stage: string,
    agent: string,
    detail?: string,
  ): Promise<void> {
    const db = this.db as D1Database;
    const now = Date.now();

    const previous = await db
      .prepare(
        "SELECT stage FROM flax_stages WHERE conversation_id = ? ORDER BY entered_at DESC, id DESC LIMIT 1",
      )
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
      .prepare("SELECT COUNT(*) AS n FROM flax_stages WHERE conversation_id = ? AND stage = ?")
      .bind(conversationId, stage)
      .first<{ n: number }>();

    const returned = previous && previous.stage !== stage;
    const entryDetail = returned || (reentered?.n ?? 0) > 0 ? "↩ returned" : (detail ?? null);

    await db
      .prepare(
        `INSERT INTO flax_stages (conversation_id, stage, agent, entered_at, exited_at, outcome, detail)
         VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
      )
      .bind(conversationId, stage, agent, now, entryDetail)
      .run();
  }

  async closeOpenStage(
    conversationId: string,
    outcome = "completed",
    detail?: string,
  ): Promise<void> {
    const db = this.db as D1Database;
    const now = Date.now();

    await db
      .prepare(
        `UPDATE flax_stages SET exited_at = COALESCE(exited_at, ?), outcome = COALESCE(outcome, ?), detail = COALESCE(detail, ?)
         WHERE conversation_id = ? AND exited_at IS NULL`,
      )
      .bind(now, outcome, detail ?? null, conversationId)
      .run();
  }

  async hasOpenStage(conversationId: string): Promise<boolean> {
    const db = this.db as D1Database;
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM flax_stages WHERE conversation_id = ? AND exited_at IS NULL",
      )
      .bind(conversationId)
      .first<{ n: number }>();
    return (row?.n ?? 0) > 0;
  }

  async findByConversationId(conversationId: string): Promise<FlaxStageRow[]> {
    const db = this.db as D1Database;
    const { results } = await db
      .prepare(
        "SELECT * FROM flax_stages WHERE conversation_id = ? ORDER BY entered_at DESC, id DESC",
      )
      .bind(conversationId)
      .all<FlaxStageRow>();
    return results;
  }

  static async ensureSchema(db: D1Database): Promise<void> {
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
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_flax_stages_conversation ON flax_stages(conversation_id, entered_at)",
      )
      .run();
  }
}

BaseModel.register("FlaxStageModel", FlaxStageModel);
