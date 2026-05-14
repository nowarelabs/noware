import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseContext } from "../src/index.ts";

describe("BaseContext", () => {
  class TestContext extends BaseContext {
    protected module = {} as any;

    protected getModule() {
      return this.module;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const context = new TestContext(mockRequest, mockEnv, mockCtx);

    expect(context).toBeDefined();
    expect((context as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
    expect((context as unknown as { env: Record<string, unknown> }).env).toBe(
      mockEnv,
    );
    expect((context as unknown as { ctx: ContextLike }).ctx).toBe(mockCtx);
  });

  test("getModule returns the module", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const context = new TestContext(mockRequest, mockEnv, mockCtx);

    expect(
      (context as unknown as { getModule: () => object }).getModule(),
    ).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseContext.beforeHooks).toBeDefined();
    expect(BaseContext.afterHooks).toBeDefined();
  });
});
