// @ts-nocheck
/**
 * Postgres dialect demo for @nowarelabs/models.
 *
 * Demonstrates that when the dialect is set to "postgres", parameterized
 * queries use $1, $2 positional placeholders instead of ? placeholders.
 * This is required for Postgres drivers (e.g. node-postgres, Supabase JS)
 * which expect numbered parameters.
 *
 * Run:  bun run examples/postgres-dialect/main.ts
 */
import { FluentQuery, sql, getDialectStrategy } from "@nowarelabs/models";
import { createPgSim } from "./pg-sim.js";

const log = (label: string) => console.log(`\n── ${label} ──`);

// ─── Setup ──────────────────────────────────────────────────────────
const db = createPgSim();

// ─── 1. Postgres $N placeholders via FluentQuery ────────────────────
log("1. Postgres dialect — $1, $2 placeholders");

log("1a. Simple WHERE");
const q1 = new FluentQuery(db, "users", undefined, "postgres");
await q1.where({ name: "Alice" }).all();

log("1b. Multiple params");
const q2 = new FluentQuery(db, "users", undefined, "postgres");
await q2.where({ name: "Alice", email: "alice@example.com" }).all();

log("1c. Comparison operators");
const q3 = new FluentQuery(db, "users", undefined, "postgres");
await q3.where({ name: { like: "%Ali%" } }).all();

// ─── 2. SQLite ? placeholders (default) ─────────────────────────────
log("2. SQLite dialect — ? placeholders (default)");

log("2a. Simple WHERE");
const q4 = new FluentQuery(db, "users", undefined, "sqlite");
await q4.where({ name: "Alice" }).all();

log("2b. Multiple params");
const q5 = new FluentQuery(db, "users", undefined, "sqlite");
await q5.where({ name: "Alice", email: "alice@example.com" }).all();

// ─── 3. COUNT with postgres dialect ─────────────────────────────────
log("3. COUNT with postgres dialect");
const q6 = new FluentQuery(db, "users", undefined, "postgres");
await q6.where({ status: "active" }).count();

// ─── 4. PLUCK with postgres dialect ─────────────────────────────────
log("4. PLUCK with postgres dialect");
const q7 = new FluentQuery(db, "users", undefined, "postgres");
await q7.where({ active: true }).pluck("name");

// ─── 5. toSql() returns __PH_N__ (internal format) ──────────────────
log("5. toSql() returns internal __PH_N__ placeholders");
const stmt = sql.statement([
  sql.raw("SELECT * FROM users WHERE name = "),
  sql.val("Alice"),
  sql.raw(" AND age > "),
  sql.val(18),
]);
const result = stmt.toSql(getDialectStrategy("postgres"));
console.log("  Internal SQL:", result.data.value);
console.log("  Params:", result.params);
console.log("  (The $1, $2 conversion happens at execRaw time, not in toSql)");

// ─── 6. DialectStrategy is passed through the full query path ───────
log("6. Full roundtrip: FluentQuery → Statement → execRaw → $1 at driver");
const q8 = new FluentQuery(db, "posts", undefined, "postgres");
await q8
  .where({ user_id: "u1", title: { like: "%Hello%" } })
  .limit(5)
  .all();

// ─── Done ──────────────────────────────────────────────────────────
console.log("\n✓ Postgres dialect demo completed successfully.");
