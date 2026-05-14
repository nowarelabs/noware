import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseService } from "../src/index.ts";

describe("BaseService", () => {
  class TestService extends BaseService {
    protected model = {};

    protected getModel() {
      return this.model;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const service = new TestService(mockRequest, mockEnv, mockCtx);

    expect(service).toBeDefined();
    expect((service as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
    expect((service as unknown as { env: Record<string, unknown> }).env).toBe(
      mockEnv,
    );
    expect((service as unknown as { ctx: ContextLike }).ctx).toBe(mockCtx);
  });

  test("getModel returns the model", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const service = new TestService(mockRequest, mockEnv, mockCtx);

    expect(
      (service as unknown as { getModel: () => object }).getModel(),
    ).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseService.beforeHooks).toBeDefined();
    expect(BaseService.afterHooks).toBeDefined();
  });
});
