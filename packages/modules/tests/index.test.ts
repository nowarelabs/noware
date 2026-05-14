import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseModule } from "../src/index.ts";

describe("BaseModule", () => {
  class TestModule extends BaseModule {
    protected feature = {} as any;

    protected getFeature() {
      return this.feature;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const module = new TestModule(mockRequest, mockEnv, mockCtx);

    expect(module).toBeDefined();
    expect((module as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
  });

  test("getFeature returns the feature", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const module = new TestModule(mockRequest, mockEnv, mockCtx);

    expect(
      (module as unknown as { getFeature: () => object }).getFeature(),
    ).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseModule.beforeHooks).toBeDefined();
    expect(BaseModule.afterHooks).toBeDefined();
  });
});
