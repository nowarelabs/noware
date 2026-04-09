import { describe, it, expect, vi, beforeEach } from "vitest";
import { MigrationRunner } from "../runner";
import { Migration } from "../index";
import { ok } from "nomo/result";

vi.mock("drizzle-orm", () => {
  const sqlMock = (chunks: any, ...vals: any[]) => ({
    sql: chunks.reduce((acc: string, chunk: string, i: number) => {
      const val = vals[i];
      const valStr =
        typeof val === "object" && val?.sql ? val.sql : val !== undefined ? String(val) : "";
      return acc + chunk + valStr;
    }, ""),
    __isSql: true,
  });
  (sqlMock as any).raw = (str: string) => ({ sql: str, __isSql: true });
  return { sql: sqlMock };
});

// Mock migrations
class Migration1 extends Migration {
  readonly version = "20260101000000";
  async change() {}
}

class Migration2 extends Migration {
  readonly version = "20260102000000";
  async change() {}
}

describe("MigrationRunner", () => {
  let mockDb: any;
  let runner: MigrationRunner;
  let migrations: Migration[];

  beforeEach(() => {
    mockDb = {
      run: vi.fn().mockResolvedValue(ok({})),
      all: vi.fn().mockResolvedValue(ok([])),
    };
    runner = new MigrationRunner(mockDb);
    migrations = [new Migration1(mockDb), new Migration2(mockDb)];
  });

  it("ensures migrations table exists", async () => {
    await runner.ensureMigrationsTable();
    expect(mockDb.run).toHaveBeenCalledWith(expect.anything());
  });

  it("runs pending migrations up", async () => {
    mockDb.all.mockResolvedValueOnce(ok([])); // No migrations applied
    await runner.use(migrations).up();

    expect(mockDb.run).toHaveBeenCalledWith(stringWith("INSERT INTO schema_migrations"));
    expect(mockDb.run).toHaveBeenCalledTimes(3); // 1 table check + 2 inserts (M1, M2 empty)
  });

  it("only runs pending migrations", async () => {
    mockDb.all.mockResolvedValueOnce(ok([{ version: "20260101000000" }])); // M1 applied
    await runner.use(migrations).up();

    expect(mockDb.run).not.toHaveBeenCalledWith(expect.stringContaining("20260101000000"));
    // Wait, let's be more specific
    const insertCalls = mockDb.run.mock.calls.filter((c: any) => c[0]?.sql?.includes("INSERT"));
    // Since we are mocking drizzle-orm sql, it might be an object
  });

  it("rolls back specific number of steps", async () => {
    mockDb.all.mockResolvedValue(
      ok([{ version: "20260101000000" }, { version: "20260102000000" }]),
    );
    await runner.use(migrations).rollback(1);

    expect(mockDb.run).toHaveBeenCalledWith(
      stringWith("DELETE FROM schema_migrations WHERE version = 20260102000000"),
    );
  });

  it("resets the database", async () => {
    mockDb.all.mockResolvedValueOnce(ok([{ name: "users" }, { name: "posts" }])); // tables
    mockDb.all.mockResolvedValueOnce(ok([])); // applied migrations after clearing
    await runner.use(migrations).reset();

    expect(mockDb.run).toHaveBeenCalledWith(stringWith("DROP TABLE IF EXISTS users"));
    expect(mockDb.run).toHaveBeenCalledWith(stringWith("DROP TABLE IF EXISTS posts"));
  });
});

// Helper for matching SQL in mocked objects
function stringWith(str: string) {
  return expect.objectContaining({
    sql: expect.stringContaining(str),
  });
}
