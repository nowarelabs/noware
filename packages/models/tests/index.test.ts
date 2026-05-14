import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseModel } from "../src/index.ts";

describe("BaseModel", () => {
  class TestModel extends BaseModel {
    protected persistence = {};

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

    const model = new TestModel(mockRequest, mockEnv, mockCtx);

    expect(model).toBeDefined();
    expect((model as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
    expect((model as unknown as { env: Record<string, unknown> }).env).toBe(
      mockEnv,
    );
    expect((model as unknown as { ctx: ContextLike }).ctx).toBe(mockCtx);
  });

  test("getPersistence returns the persistence", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel(mockRequest, mockEnv, mockCtx);

    expect(
      (model as unknown as { getPersistence: () => object }).getPersistence(),
    ).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseModel.beforeHooks).toBeDefined();
    expect(BaseModel.afterHooks).toBeDefined();
  });
});
