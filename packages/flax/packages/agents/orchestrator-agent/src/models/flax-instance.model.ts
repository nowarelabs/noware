import { BaseModel } from "@nowarelabs/models";
import type { D1Database } from "@cloudflare/workers-types";

import { flaxInstancesTable, type FlaxInstanceRow } from "./schema.js";

export interface InstancePatch {
  title?: string | null;
  origin?: string | null;
  currentStage?: string | null;
  currentAgent?: string | null;
  status?: string;
  lastActivityAt?: number;
}

export class FlaxInstanceModel extends BaseModel<
  any,
  any,
  any,
  any,
  typeof flaxInstancesTable,
  FlaxInstanceRow,
  Partial<FlaxInstanceRow>
> {
  static tableName = "flax_instances";
  static columnTypes = Object.fromEntries(
    Object.entries(flaxInstancesTable).map(([k, v]) => [k, v.type]),
  );

  protected persistence: any = null;

  constructor(init: any) {
    super({ ...init, table: init.table ?? flaxInstancesTable });
  }

  protected getPersistence() {
    return { db: this.db };
  }

  async patchFields(id: string, patch: InstancePatch): Promise<void> {
    const db = this.db as D1Database;
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (patch.title !== undefined) {
      sets.push("title = ?");
      values.push(patch.title);
    }
    if (patch.origin !== undefined) {
      sets.push("origin = ?");
      values.push(patch.origin);
    }
    if (patch.currentStage !== undefined) {
      sets.push("current_stage = ?");
      values.push(patch.currentStage);
    }
    if (patch.currentAgent !== undefined) {
      sets.push("current_agent = ?");
      values.push(patch.currentAgent);
    }
    if (patch.status !== undefined) {
      sets.push("status = ?");
      values.push(patch.status);
    }
    if (patch.lastActivityAt !== undefined) {
      sets.push("last_activity_at = ?");
      values.push(patch.lastActivityAt);
    }

    if (sets.length === 0) return;

    values.push(id);
    await db
      .prepare(`UPDATE flax_instances SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async listRecent(): Promise<FlaxInstanceRow[]> {
    const db = this.db as D1Database;
    const { results } = await db
      .prepare(
        `SELECT id, created_at, last_seen_at, title, origin, current_stage, current_agent, status, last_activity_at
         FROM flax_instances ORDER BY COALESCE(last_activity_at, last_seen_at) DESC`,
      )
      .all<FlaxInstanceRow>();
    return results;
  }

  async findByConversationId(conversationId: string): Promise<FlaxInstanceRow | null> {
    const db = this.db as D1Database;
    const row = await db
      .prepare("SELECT * FROM flax_instances WHERE id = ?")
      .bind(conversationId)
      .first<FlaxInstanceRow>();
    return row ?? null;
  }

  static async ensureSchema(db: D1Database, opts?: { reset?: boolean }): Promise<void> {
    if (opts?.reset) schemaReady = null;
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

        const columns = await db
          .prepare("PRAGMA table_info(flax_instances)")
          .all<{ name: string }>();
        const existing = new Set(columns.results?.map((c) => c.name) ?? []);
        const addColumn = [
          ["title", "TEXT"],
          ["origin", "TEXT NOT NULL DEFAULT 'orchestrator'"],
          ["current_stage", "TEXT"],
          ["current_agent", "TEXT"],
          ["status", "TEXT NOT NULL DEFAULT 'running'"],
          ["last_activity_at", "INTEGER"],
        ] as const;
        for (const [name, def] of addColumn) {
          if (!existing.has(name)) {
            await db.prepare(`ALTER TABLE flax_instances ADD COLUMN ${name} ${def}`).run();
          }
        }
      })();
    }
    return schemaReady;
  }
}

let schemaReady: Promise<void> | null = null;

BaseModel.register("FlaxInstanceModel", FlaxInstanceModel);
