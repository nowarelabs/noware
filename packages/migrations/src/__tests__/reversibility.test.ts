import { describe, it, expect } from "vitest";
import { Migration } from "../index";
import { SqlGenerator } from "../sql";
import { type Result, ok } from "nomo/result";

class ReversibleMigration extends Migration {
  readonly version = "20260205130000";
  async change() {
    await this.changeTable("users", (t) => {
      t.addColumn("bio", "text");
      t.removeColumn("old_junk", "string", { default: "" });
      t.renameColumn("handle", "username");
    });

    await this.dropTable("temp_logs", (t) => {
      t.string("message");
      t.timestamps();
    });
  }
}

class MockReversibleMigration extends ReversibleMigration {
  private _preservedCommands: any[] = [];

  async executeCommands(): Promise<Result<void>> {
    this._preservedCommands = [...this._commands];
    return ok(undefined);
  }

  getPreservedCommands() {
    return this._preservedCommands;
  }
}

describe("Reversible Migrations", () => {
  const sql = new SqlGenerator();

  it("generates correct SQL for forward changeTable and dropTable", async () => {
    const mockDb = {
      run: async () => ok({}),
      all: async () => ok([]),
    };
    const migration = new MockReversibleMigration(mockDb as any);
    const upRes = await migration.up();
    expect(upRes.success).toBe(true);

    const commands = migration.getPreservedCommands();
    const queries = commands.map((c: any) => {
      const res = sql.generate(c.up);
      expect(res.success).toBe(true);
      return (res as any).data;
    });

    expect(queries.join("\n")).toContain(
      'ALTER TABLE "users" ADD COLUMN "bio" TEXT;',
    );
    expect(queries.join("\n")).toContain(
      'ALTER TABLE "users" DROP COLUMN "old_junk";',
    );
    expect(queries.join("\n")).toContain(
      'ALTER TABLE "users" RENAME COLUMN "handle" TO "username";',
    );
    expect(queries.join("\n")).toContain('DROP TABLE IF EXISTS "temp_logs";');
  });

  it("generates correct reverse SQL for rollbacks", async () => {
    const mockDb = { run: async () => ok({}) };
    const migration = new MockReversibleMigration(mockDb as any);
    const upRes = await migration.up(); // Record them
    expect(upRes.success).toBe(true);

    const commands = migration.getPreservedCommands();
    // Reverse commands are processed in reverse order by the runner
    const reverseQueries = [...commands].reverse().map((c: any) => {
      const res = sql.generate(c.down);
      expect(res.success).toBe(true);
      return (res as any).data;
    });

    // 1. Recreate temp_logs
    expect(reverseQueries[0]).toContain(
      'CREATE TABLE IF NOT EXISTS "temp_logs"',
    );
    expect(reverseQueries[0]).toContain('"message" TEXT');
    expect(reverseQueries[0]).toContain('"created_at" TEXT');

    // 2. Reverse username -> handle
    expect(reverseQueries[1]).toContain(
      'ALTER TABLE "users" RENAME COLUMN "username" TO "handle";',
    );

    // 3. Re-add old_junk
    expect(reverseQueries[2]).toContain(
      'ALTER TABLE "users" ADD COLUMN "old_junk" TEXT DEFAULT \'\';',
    );

    // 4. Remove bio
    expect(reverseQueries[3]).toContain(
      'ALTER TABLE "users" DROP COLUMN "bio";',
    );
  });
});
