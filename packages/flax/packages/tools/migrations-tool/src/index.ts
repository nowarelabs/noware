import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface Migration {
  id: string;
  name: string;
  sql?: string;
  applied: boolean;
  appliedAt?: string;
  createdAt: string;
}

interface D1Like {
  prepare(sql: string): { run(): Promise<{ meta: { changes: number } }> };
}

const journal = new Map<string, Migration>();

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "migration"
  );
}

function defaultSql(name: string): string {
  return `-- migration: ${name}\n`;
}

export class MigrationsTool extends WorkerEntrypoint<Env> {
  async createMigration(input: { name: string; sql?: string }): Promise<{ migrationId: string }> {
    const id = `${Date.now()}_${slugify(input.name)}`;
    journal.set(id, {
      id,
      name: input.name,
      sql: input.sql ?? defaultSql(input.name),
      applied: false,
      createdAt: new Date().toISOString(),
    });
    return { migrationId: id };
  }

  async runMigration(input: {
    migrationId?: string;
    environment?: string;
  }): Promise<{ applied: string[] }> {
    const pending = [...journal.values()]
      .filter((m) => !m.applied && (!input.migrationId || m.id === input.migrationId))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (pending.length === 0 && input.migrationId && journal.has(input.migrationId)) {
      return { applied: [] };
    }

    const db = this.env.DB as D1Like | undefined;
    for (const migration of pending) {
      if (db && migration.sql && !migration.sql.trimStart().startsWith("--")) {
        for (const statement of migration.sql.split(/;\s*(?:\r?\n|$)/)) {
          const trimmed = statement.trim();
          if (trimmed && !trimmed.startsWith("--")) {
            await db.prepare(trimmed).run();
          }
        }
      }
      migration.applied = true;
      migration.appliedAt = new Date().toISOString();
    }

    return { applied: pending.map((m) => m.id) };
  }

  async rollbackMigration(input: {
    migrationId: string;
    environment?: string;
  }): Promise<{ rolledBack: string }> {
    const migration = journal.get(input.migrationId);
    if (!migration) throw new Error(`migration ${input.migrationId} not found`);
    if (!migration.applied) {
      return { rolledBack: input.migrationId };
    }
    migration.applied = false;
    migration.appliedAt = undefined;
    return { rolledBack: input.migrationId };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
