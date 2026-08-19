import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface D1Like {
  prepare(sql: string): { all(): Promise<{ results: unknown[] }> };
}

interface Warning {
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  recommendation: string;
}

function analyzeSql(sql: string): Warning[] {
  const warnings: Warning[] = [];
  const upper = sql.toUpperCase();

  if (/SELECT \*/i.test(sql)) {
    warnings.push({
      severity: "medium",
      message: "SELECT * used",
      recommendation: "List explicit columns to reduce IO and allow covering indexes.",
    });
  }
  if (/LIKE\s+['"]%/.test(sql)) {
    warnings.push({
      severity: "high",
      message: "Leading-wildcard LIKE (e.g. LIKE '%...')",
      recommendation:
        "Leading wildcards prevent index usage; consider full-text search or trigram indexes.",
    });
  }
  if (/ORDER BY/i.test(sql) && !/LIMIT/i.test(sql)) {
    warnings.push({
      severity: "low",
      message: "ORDER BY without LIMIT",
      recommendation: "Add a LIMIT to bound work when only a top-N is needed.",
    });
  }
  if (/(\bFROM\b[^;]*,\s*[A-Za-z_])/.test(sql)) {
    warnings.push({
      severity: "high",
      message: "Possible implicit cartesian join (comma-joined tables)",
      recommendation: "Use explicit INNER JOIN with ON conditions.",
    });
  }
  const functionCalls = sql.match(
    /\b(UPPER|LOWER|LENGTH|TRIM|SUBSTR|CAST)\s*\([A-Za-z_][A-Za-z0-9_.]*\)/gi,
  );
  if (functionCalls) {
    warnings.push({
      severity: "medium",
      message: `Function on column in predicate: ${functionCalls.join(", ")}`,
      recommendation:
        "Functions on columns prevent index seeks; store precomputed values or use expression indexes.",
    });
  }
  const subquery = upper.match(/SELECT[\s\S]*FROM\s*\(/);
  if (subquery) {
    warnings.push({
      severity: "low",
      message: "Subquery in FROM detected",
      recommendation:
        "Verify the subquery is not a correlated full re-scan; consider CTEs with indexes.",
    });
  }
  if (/(NOT IN\s*\()/.test(upper)) {
    warnings.push({
      severity: "medium",
      message: "NOT IN used",
      recommendation: "NOT IN can behave unexpectedly with NULLs; prefer NOT EXISTS.",
    });
  }
  if (!/WHERE/i.test(sql) && /^(UPDATE|DELETE)/i.test(upper)) {
    warnings.push({
      severity: "critical",
      message: "UPDATE/DELETE without WHERE",
      recommendation: "This modifies every row; add a WHERE clause.",
    });
  }
  if (/SELECT/i.test(sql) && /WHERE/i.test(sql) && !/BETWEEN|>=|<=|>|<|=/.test(sql)) {
    warnings.push({
      severity: "low",
      message: "WHERE clause may be non-selective",
      recommendation: "Verify predicates use indexed, equality-range comparisons.",
    });
  }
  return warnings;
}

function costEstimate(sql: string, warnings: Warning[]): number {
  const scans = warnings.filter((w) => w.severity === "high" || w.severity === "critical").length;
  const medium = warnings.filter((w) => w.severity === "medium").length;
  const joins = (sql.match(/\bJOIN\b/gi) ?? []).length;
  const tables = (sql.match(/\bFROM\b/gi) ?? []).length;
  return Math.max(1, scans * 100 + medium * 20 + joins * 10 + tables * 5);
}

export class QueryProfilerTool extends WorkerEntrypoint<Env> {
  async explainQuery(input: { sql: string; database?: string }): Promise<unknown> {
    const db = this.env.DB as D1Like | undefined;
    if (db) {
      try {
        const res = await db.prepare(`EXPLAIN QUERY PLAN ${input.sql}`).all();
        return { database: input.database ?? "d1", engine: "sqlite", plan: res.results };
      } catch (err) {
        // fall through to heuristic analysis if the DB rejects EXPLAIN
      }
    }

    const warnings = analyzeSql(input.sql);
    return {
      database: input.database ?? "unknown",
      engine: "heuristic",
      estimatedCost: costEstimate(input.sql, warnings),
      warnings,
      recommendation:
        warnings.length === 0
          ? "Query looks well-formed; verify indexes cover the WHERE/ORDER BY columns."
          : warnings[0].recommendation,
    };
  }

  async profileQuery(input: { sql: string; database?: string }): Promise<unknown> {
    const warnings = analyzeSql(input.sql);
    const cost = costEstimate(input.sql, warnings);
    const isWrite = /^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(input.sql.trim());
    return {
      database: input.database ?? "unknown",
      estimatedCost: cost,
      severity: cost >= 100 ? "high" : cost >= 30 ? "medium" : "low",
      tableScans: warnings.filter((w) => w.severity === "high" || w.severity === "critical").length,
      joins: (input.sql.match(/\bJOIN\b/gi) ?? []).length,
      estimatedRowsAffected: isWrite ? null : cost * 10,
      warnings,
    };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
