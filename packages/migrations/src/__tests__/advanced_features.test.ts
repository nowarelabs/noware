import { describe, it, expect } from "vitest";
import { sql, getDialectStrategy } from "nomo/sql";
import { TableBuilder, VirtualTableBuilder } from "../index";
import { STANDARD_HANDLERS } from "../handlers";
describe("Advanced SQLite Features", () => {
  const strategy = getDialectStrategy("sqlite");

  it("generates STRICT and WITHOUT ROWID tables", () => {
    const t = new TableBuilder("test_table", {
      strict: true,
      withoutRowid: true,
      id: false,
    });
    t.column("id", "integer", { primaryKey: true });
    t.column("name", "text", { notNull: true });

    const res = STANDARD_HANDLERS.createTable({ name: "test_table", table: t }, strategy);
    expect(res.success).toBe(true);
    if (!res.success) throw new Error("Result failed");
    const sqlStr = res.data?.toSql(strategy).data?.value;
    expect(sqlStr).toContain("STRICT");
    expect(sqlStr).toContain("WITHOUT ROWID");
  });

  it("generates virtual tables (FTS5)", () => {
    const v = new VirtualTableBuilder("search_idx", "fts5");
    v.arg("title");
    v.arg("content");
    v.arg('tokenize="porter"');

    const res = STANDARD_HANDLERS.createVirtualTable({ name: "search_idx", builder: v }, strategy);
    expect(res.success).toBe(true);
    if (!res.success) throw new Error("Result failed");
    const sqlStr = res.data?.toSql(strategy).data?.value;
    expect(sqlStr).toBe(
      'CREATE VIRTUAL TABLE IF NOT EXISTS "search_idx" USING FTS5 (title, content, tokenize="porter")',
    );
  });

  it("generates generated columns", () => {
    const t = new TableBuilder("users");
    t.column("first_name", "text");
    t.column("last_name", "text");
    t.column("full_name", "text", {
      generated: { as: "first_name || ' ' || last_name", stored: true },
    });

    const res = STANDARD_HANDLERS.createTable({ name: "users", table: t }, strategy);
    expect(res.success).toBe(true);
    if (!res.success) throw new Error("Result failed");
    const sqlStr = res.data?.toSql(strategy).data?.value;
    expect(sqlStr).toContain("GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED");
  });

  it("generates UPSERT (ON CONFLICT) statements", () => {
    const upsert = sql
      .onConflict("id")
      .doUpdate({ name: "new name", updated_at: sql.currentTimestamp() });
    const res = upsert.toSql(strategy);
    expect(res.success).toBe(true);
    if (!res.success) throw new Error("Result failed");
    expect(res.data?.value).toContain(
      'ON CONFLICT "id" DO UPDATE SET "name" = \'new name\', "updated_at" = CURRENT_TIMESTAMP',
    );
  });

  it("generates Recursive CTEs", () => {
    const cte = sql
      .with(true)
      .as(
        "ancestors",
        "SELECT id FROM users WHERE id = 1 UNION ALL SELECT u.id FROM users u JOIN ancestors a ON u.parent_id = a.id",
      );
    const res = cte.toSql(strategy);
    expect(res.success).toBe(true);
    if (!res.success) throw new Error("Result failed");
    expect(res.data?.value).toContain(
      'WITH RECURSIVE "ancestors" AS (SELECT id FROM users WHERE id = 1 UNION ALL SELECT u.id FROM users u JOIN ancestors a ON u.parent_id = a.id)',
    );
  });

  it("generates JSON functions", () => {
    const extract = sql.json.extract("data", "$.name");
    expect(extract.toSql(strategy).data?.value).toBe("JSON_EXTRACT(\"data\", '$.name')");

    const valid = sql.json.valid("data");
    expect(valid.toSql(strategy).data?.value).toBe('JSON_VALID("data")');
  });
});
