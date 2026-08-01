import { describe, expect, test } from "vite-plus/test";
import type { PersistenceContext } from "@nowarelabs/shared";
import { createModelContext } from "@nowarelabs/shared";
import { BasePersistence, withTransaction, type Transaction } from "../src/index.ts";

describe("BasePersistence", () => {
  class TestPersistence extends BasePersistence {
    protected db = {} as any;
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as PersistenceContext;

    const persistence = new TestPersistence(mockRequest, mockEnv, mockCtx);

    expect(persistence).toBeDefined();
    expect((persistence as unknown as { request: Request }).request).toBe(mockRequest);
    expect((persistence as unknown as { env: Record<string, unknown> }).env).toBe(mockEnv);
    expect((persistence as unknown as { ctx: PersistenceContext }).ctx).toBe(mockCtx);
  });

  test("static hooks exist", () => {
    expect(BasePersistence.beforeHooks).toBeDefined();
    expect(BasePersistence.afterHooks).toBeDefined();
  });
});

describe("withTransaction", () => {
  function makeMockDb(captured: string[]) {
    return {
      prepare: (sql: string) => ({
        bind: () => ({
          all: async () => {
            captured.push(sql);
            return { results: [] };
          },
        }),
      }),
    };
  }

  test("issues BEGIN and COMMIT, flushes callbacks", async () => {
    const captured: string[] = [];
    const db = makeMockDb(captured);
    const ctx = createModelContext();
    let cbFired = false;

    const result = await withTransaction(ctx, db, async (txCtx) => {
      const tx = txCtx.transaction as Transaction;
      tx.callbacks.push(async () => {
        cbFired = true;
      });
      return "done";
    });

    expect(result).toBe("done");
    expect(cbFired).toBe(true);
    expect(captured.filter((s) => s.includes("BEGIN"))).toHaveLength(1);
    expect(captured.filter((s) => s.includes("COMMIT"))).toHaveLength(1);
    expect(captured.filter((s) => s.includes("ROLLBACK"))).toHaveLength(0);
  });

  test("issues ROLLBACK on error, does not flush callbacks", async () => {
    const captured: string[] = [];
    const db = makeMockDb(captured);
    const ctx = createModelContext();
    let cbFired = false;

    try {
      await withTransaction(ctx, db, async (txCtx) => {
        const tx = txCtx.transaction as Transaction;
        tx.callbacks.push(async () => {
          cbFired = true;
        });
        throw new Error("boom");
      });
    } catch {
      // expected
    }

    expect(captured.filter((s) => s.includes("BEGIN"))).toHaveLength(1);
    expect(captured.filter((s) => s.includes("ROLLBACK"))).toHaveLength(1);
    expect(captured.filter((s) => s.includes("COMMIT"))).toHaveLength(0);
    expect(cbFired).toBe(false);
  });

  test("stores transaction on context", async () => {
    const db = makeMockDb([]);
    const ctx = createModelContext();

    await withTransaction(ctx, db, async (txCtx) => {
      const tx = txCtx.transaction as Transaction;
      expect(tx).toBeDefined();
      expect(typeof tx.id).toBe("string");
      expect(Array.isArray(tx.callbacks)).toBe(true);
    });
  });

  test("does not mutate original context", async () => {
    const db = makeMockDb([]);
    const ctx = createModelContext();

    expect((ctx as any).transaction).toBeUndefined();

    await withTransaction(ctx, db, async () => "ok");

    expect((ctx as any).transaction).toBeUndefined();
  });
});
