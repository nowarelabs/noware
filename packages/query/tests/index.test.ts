import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseQuery } from "../src/index.ts";

describe("BaseQuery", () => {
  class TestQuery extends BaseQuery {
    protected persistence = {} as any;

    protected getPersistence() {
      return this.persistence;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const query = new TestQuery(mockRequest, mockEnv, mockCtx);

    expect(query).toBeDefined();
    expect((query as unknown as { request: Request }).request).toBe(mockRequest);
    expect((query as unknown as { env: Record<string, unknown> }).env).toBe(mockEnv);
  });

  test("getPersistence returns the persistence", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const query = new TestQuery(mockRequest, mockEnv, mockCtx);

    expect((query as unknown as { getPersistence: () => object }).getPersistence()).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseQuery.beforeHooks).toBeDefined();
    expect(BaseQuery.afterHooks).toBeDefined();
  });
});
