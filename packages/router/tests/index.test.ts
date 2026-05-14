import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseRouter } from "../src/index.ts";

describe("BaseRouter", () => {
  class TestRouter extends BaseRouter {
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

    const router = new TestRouter(mockRequest, mockEnv, mockCtx);

    expect(router).toBeDefined();
    expect((router as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
    expect((router as unknown as { env: Record<string, unknown> }).env).toBe(
      mockEnv,
    );
  });

  test("getRpc returns the rpc", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const router = new TestRouter(mockRequest, mockEnv, mockCtx);

    expect((router as unknown as { getRpc: () => object }).getRpc()).toEqual(
      {},
    );
  });

  test("static hooks exist", () => {
    expect(BaseRouter.beforeHooks).toBeDefined();
    expect(BaseRouter.afterHooks).toBeDefined();
  });
});
