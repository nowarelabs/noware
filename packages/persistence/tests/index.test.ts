import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BasePersistence } from "../src/index.ts";

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
    } as ContextLike;

    const persistence = new TestPersistence(mockRequest, mockEnv, mockCtx);

    expect(persistence).toBeDefined();
    expect((persistence as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
    expect(
      (persistence as unknown as { env: Record<string, unknown> }).env,
    ).toBe(mockEnv);
    expect((persistence as unknown as { ctx: ContextLike }).ctx).toBe(mockCtx);
  });

  test("static hooks exist", () => {
    expect(BasePersistence.beforeHooks).toBeDefined();
    expect(BasePersistence.afterHooks).toBeDefined();
  });
});
