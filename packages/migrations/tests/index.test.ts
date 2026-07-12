import { describe, expect, test } from "vite-plus/test";
import type { MigrationContext } from "@nowarelabs/shared";
import { Migration, BaseMigration } from "../src/index.ts";

describe("Migration", () => {
  class TestMigration extends Migration {
    async up() {}
    async down() {}
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {} as any;

    const migration = new TestMigration(mockRequest, mockEnv, mockCtx);
    expect(migration).toBeDefined();
  });

  test("up can be implemented", async () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {} as any;

    const migration = new TestMigration(mockRequest, mockEnv, mockCtx);
    await expect(migration.up()).resolves.toBeUndefined();
  });

  test("down can be implemented", async () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {} as any;

    const migration = new TestMigration(mockRequest, mockEnv, mockCtx);
    await expect(migration.down()).resolves.toBeUndefined();
  });
});

describe("BaseMigration", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as MigrationContext;

    const migration = new BaseMigration(mockRequest, mockEnv, mockCtx);
    expect(migration).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseMigration.beforeHooks).toBeDefined();
    expect(BaseMigration.afterHooks).toBeDefined();
  });
});
