import { describe, it, expect } from "vitest";
import { TableBuilder, sql as sqlTag } from "../index";
import { SqlGenerator } from "../sql";
import { type Result } from "nomo/result";

describe("TableBuilder DSL & Column Types", () => {
  const sql = new SqlGenerator();

  it("generates a basic table with various column types", () => {
    const t = new TableBuilder("users");
    t.id();
    t.string("username");
    t.text("bio");
    t.integer("age");
    t.bigint("large_id");
    t.decimal("price");
    t.boolean("is_active");
    t.uuid("uid");
    t.timestamp("created_at");
    t.datetime("updated_at");
    t.json("metadata");
    t.jsonb("extra_data");

    const res = sql.generate({ type: "createTable", name: "users", table: t });
    expect(res.success).toBe(true);
    const generatedSql = (res as any).data;

    expect(generatedSql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(generatedSql).toContain('"id" INTEGER PRIMARY KEY NOT NULL');
    expect(generatedSql).toContain('"username" TEXT');
    expect(generatedSql).toContain('"bio" TEXT');
    expect(generatedSql).toContain('"age" INTEGER');
    expect(generatedSql).toContain('"large_id" BIGINT');
    expect(generatedSql).toContain('"price" DECIMAL');
    expect(generatedSql).toContain('"is_active" INTEGER');
    expect(generatedSql).toContain('"uid" TEXT');
    expect(generatedSql).toContain('"created_at" TEXT');
    expect(generatedSql).toContain('"updated_at" TEXT');
    expect(generatedSql).toContain('"metadata" TEXT');
    expect(generatedSql).toContain('"extra_data" TEXT');
  });

  it("handles column modifiers and constraints", () => {
    const t = new TableBuilder("products");
    t.string("sku", { notNull: true, unique: true, index: true });
    t.decimal("price", { precision: 10, scale: 2, default: 0 });
    t.string("status", { default: "draft" });
    t.integer("priority", { name: "sort_order", comment: "Lower is better" });

    const res = sql.generate({
      type: "createTable",
      name: "products",
      table: t,
    });
    expect(res.success).toBe(true);
    const generatedSql = (res as any).data;

    expect(generatedSql).toContain('"sku" TEXT NOT NULL UNIQUE');
    expect(generatedSql).toContain('"price" DECIMAL DEFAULT 0');
    expect(generatedSql).toContain("\"status\" TEXT DEFAULT 'draft'");
    expect(generatedSql).toContain('"sort_order" INTEGER'); // name mapping
    expect(generatedSql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_sku" ON "products" ("sku")',
    );
  });

  it("handles SQL expressions as defaults", () => {
    const t = new TableBuilder("events");
    t.timestamp("occurred_at", { default: sqlTag`CURRENT_TIMESTAMP` });

    const res = sql.generate({ type: "createTable", name: "events", table: t });
    expect(res.success).toBe(true);
    const generatedSql = (res as any).data;
    expect(generatedSql).toContain(
      '"occurred_at" TEXT DEFAULT CURRENT_TIMESTAMP',
    );
  });

  it("handles associations and foreign keys", () => {
    const t = new TableBuilder("posts");
    t.id();
    t.references("user", { foreignKey: true, onDelete: "cascade" });
    t.references("project", { columnName: "p_id", foreignKey: "projects" });

    const res = sql.generate({ type: "createTable", name: "posts", table: t });
    expect(res.success).toBe(true);
    const generatedSql = (res as any).data;

    expect(generatedSql).toContain('"user_id" INTEGER');
    expect(generatedSql).toContain('"p_id" INTEGER');
    expect(generatedSql).toContain(
      'FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE',
    );
    expect(generatedSql).toContain(
      'FOREIGN KEY ("p_id") REFERENCES "projects"("id")',
    );
  });

  it("handles polymorphic associations", () => {
    const t = new TableBuilder("comments");
    t.references("record", { polymorphic: true, index: true });

    const res = sql.generate({
      type: "createTable",
      name: "comments",
      table: t,
    });
    expect(res.success).toBe(true);
    const generatedSql = (res as any).data;

    expect(generatedSql).toContain('"record_id" INTEGER');
    expect(generatedSql).toContain('"record_type" TEXT');
    expect(generatedSql).toContain(
      'CREATE INDEX IF NOT EXISTS "idx_comments_record_id" ON "comments" ("record_id")',
    );
    expect(generatedSql).toContain(
      'CREATE INDEX IF NOT EXISTS "idx_comments_record_type" ON "comments" ("record_type")',
    );
  });

  it("handles timestamps helper", () => {
    const t = new TableBuilder("posts");
    t.timestamps();

    const res = sql.generate({ type: "createTable", name: "posts", table: t });
    expect(res.success).toBe(true);
    const generatedSql = (res as any).data;
    expect(generatedSql).toContain(
      '"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
    expect(generatedSql).toContain(
      '"updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  });
});
