import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

function secret(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function requireSecret(env: Env, key: string): string {
  const v = secret(env, key);
  if (!v) throw new Error(`${key} binding is not configured on this worker`);
  return v;
}

interface D1Like {
  prepare(sql: string): {
    all(): Promise<{ results: unknown[] }>;
    run(): Promise<{ meta: { changes: number } }>;
    bind(...params: unknown[]): {
      all(): Promise<{ results: unknown[] }>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}

interface TursoColumn {
  name: string;
  decltype: string | null;
}

interface TursoValue {
  type: string;
  value: unknown;
}

async function tursoPipeline(
  env: Env,
  sql: string,
  params?: unknown[],
): Promise<{ cols: TursoColumn[]; rows: unknown[][] } | null> {
  const databaseUrl = secret(env, "DATABASE_URL");
  if (!databaseUrl) return null;
  const token = requireSecret(env, "DATABASE_TOKEN");
  const base = databaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/v2/pipeline?format=json`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql, args: params ?? [] } }, { type: "close" }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`libSQL API ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text) as {
    results: {
      type: string;
      response: {
        type: string;
        result?: { cols: TursoColumn[]; rows: unknown[][] };
        error?: { message: string };
      };
    }[];
  };
  const execute = data.results?.[0]?.response;
  if (execute.error) throw new Error(`SQL error: ${execute.error.message}`);
  return execute.result ?? null;
}

function rowsToObjects(cols: TursoColumn[], rows: unknown[][]): unknown[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      const value = row[i] as TursoValue | null;
      obj[col.name] = value ? value.value : null;
    });
    return obj;
  });
}

async function runD1(
  env: Env,
  sql: string,
  params?: unknown[],
): Promise<{ results: unknown[]; changes: number }> {
  const db = env.DB as D1Like | undefined;
  if (!db)
    throw new Error(
      "no database configured (set DATABASE_URL + DATABASE_TOKEN or add a D1 binding)",
    );
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    const bound = stmt.bind(...params);
    const all = await bound.all();
    return { results: all.results ?? [], changes: 0 };
  }
  if (/^\s*(insert|update|delete|create|drop|alter|replace)\b/i.test(sql)) {
    const run = await stmt.run();
    return { results: [], changes: run.meta?.changes ?? 0 };
  }
  const all = await stmt.all();
  return { results: all.results ?? [], changes: 0 };
}

export class DbClientTool extends WorkerEntrypoint<Env> {
  async query(input: { sql: string; params?: unknown[]; database?: string }): Promise<unknown> {
    const turso = await tursoPipeline(this.env, input.sql, input.params);
    if (turso) {
      return {
        database: input.database ?? "turso",
        rows: rowsToObjects(turso.cols, turso.rows),
        rowCount: turso.rows.length,
      };
    }
    if (this.env.DB) {
      const { results, changes } = await runD1(this.env, input.sql, input.params);
      return { database: input.database ?? "d1", rows: results, rowCount: results.length, changes };
    }
    throw new Error(
      "no database configured (set DATABASE_URL + DATABASE_TOKEN or add a D1 binding)",
    );
  }

  async execute(input: {
    sql: string;
    params?: unknown[];
    database?: string;
  }): Promise<{ rowsAffected: number }> {
    const turso = await tursoPipeline(this.env, input.sql, input.params);
    if (turso) {
      const changes = turso.cols.find((c) => c.name === "changes") ? null : 0;
      void changes;
      const res = await tursoPipeline(this.env, `SELECT changes() AS _changes`, []);
      let rowsAffected = 0;
      if (res && res.rows.length > 0) {
        const value = (res.rows[0][0] as TursoValue | null)?.value;
        rowsAffected = typeof value === "number" ? value : 0;
      }
      return { rowsAffected };
    }
    if (this.env.DB) {
      const { changes } = await runD1(this.env, input.sql, input.params);
      return { rowsAffected: changes };
    }
    throw new Error(
      "no database configured (set DATABASE_URL + DATABASE_TOKEN or add a D1 binding)",
    );
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
