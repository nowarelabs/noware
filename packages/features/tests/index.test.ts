import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseFeature } from "../src/index.ts";

describe("BaseFeature", () => {
  class TestFeature extends BaseFeature {
    protected rpc = {} as any;

    protected getRpc() {
      return this.rpc;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const feature = new TestFeature(mockRequest, mockEnv, mockCtx);

    expect(feature).toBeDefined();
    expect((feature as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
    expect((feature as unknown as { env: Record<string, unknown> }).env).toBe(
      mockEnv,
    );
    expect((feature as unknown as { ctx: ContextLike }).ctx).toBe(mockCtx);
  });

  test("getRpc returns the rpc", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const feature = new TestFeature(mockRequest, mockEnv, mockCtx);

    expect((feature as unknown as { getRpc: () => object }).getRpc()).toEqual(
      {},
    );
  });

  test("static hooks exist", () => {
    expect(BaseFeature.beforeHooks).toBeDefined();
    expect(BaseFeature.afterHooks).toBeDefined();
  });
});
