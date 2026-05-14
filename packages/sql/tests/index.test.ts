import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { QueryBuilder, BaseSql } from "../src/index.ts";

describe("QueryBuilder", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const builder = new QueryBuilder(mockRequest, mockEnv, mockCtx);
    expect(builder).toBeDefined();
  });

  test("toSql returns empty string by default", () => {
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;
    const builder = new QueryBuilder(
      new Request("http://localhost"),
      {},
      mockCtx,
    );
    expect(builder.toSql()).toBe("");
  });
});

describe("BaseSql", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const sql = new BaseSql(mockRequest, mockEnv, mockCtx);
    expect(sql).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseSql.beforeHooks).toBeDefined();
    expect(BaseSql.afterHooks).toBeDefined();
  });
});
