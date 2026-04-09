import { describe, it, expect, vi } from "vitest";
import { Migration } from "../index";
import { SqlGenerator } from "../sql";
import { type Result, ok } from "nomo/result";

class ReversibleMigration extends Migration {
  readonly version = "20260205130000";
  async change() {
    await this.createTable("tags", (t) => {
      t.string("name");
    });
    await this.addColumn("users", "tag_id", "integer");

    await (this as any).reversible({
      up: async () => {
        await this.execute("CREATE VIEW user_tags AS SELECT * FROM users");
      },
      down: async () => {
        await this.execute("DROP VIEW user_tags");
      },
    });
  }
}

class ExplicitMigration extends Migration {
  readonly version = "20260205130001";
  async change() {}
  async up(): Promise<Result<void>> {
    return await this.createTable("legacy", (t) => {
      t.id();
    });
  }
  async down(): Promise<Result<void>> {
    return await this.dropTable("legacy");
  }
}

describe("Migration Reversibility", () => {
  const sql = new SqlGenerator();

  it("automatically reverses standard commands in the correct order", async () => {
    const mockDb = {
      run: vi.fn().mockResolvedValue(ok({})),
      all: vi.fn().mockResolvedValue(ok([])),
    };
    const migration = new ReversibleMigration(mockDb as any);

    // Test UP
    const upRes = await migration.up();
    expect(upRes.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledTimes(3);
    expect(mockDb.run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sql: expect.stringContaining('CREATE TABLE IF NOT EXISTS "tags"'),
      }),
    );
    expect(mockDb.run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining('ALTER TABLE "users" ADD COLUMN "tag_id" INTEGER;'),
      }),
    );
    expect(mockDb.run).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: "CREATE VIEW user_tags AS SELECT * FROM users",
      }),
    );

    vi.clearAllMocks();

    // Test DOWN
    const downRes = await migration.down();
    expect(downRes.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledTimes(3);
    // Should be in REVERSE order
    expect(mockDb.run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sql: "DROP VIEW user_tags" }),
    );
    expect(mockDb.run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining('ALTER TABLE "users" DROP COLUMN "tag_id";'),
      }),
    );
    expect(mockDb.run).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining('DROP TABLE IF EXISTS "tags";'),
      }),
    );
  });

  it("handles explicit up and down methods", async () => {
    const mockDb = {
      run: vi.fn().mockResolvedValue(ok({})),
      all: vi.fn().mockResolvedValue(ok([])),
    };
    const migration = new ExplicitMigration(mockDb as any);

    const upRes = await migration.up();
    expect(upRes.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('CREATE TABLE IF NOT EXISTS "legacy"'),
      }),
    );

    vi.clearAllMocks();

    const downRes = await migration.down();
    expect(downRes.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('DROP TABLE IF EXISTS "legacy"'),
      }),
    );
  });
});
