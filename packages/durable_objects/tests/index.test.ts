import { describe, expect, test, vi } from "vite-plus/test";
import { BaseDurableObject, DurableObjectState } from "../src/index.ts";

describe("DurableObjectState", () => {
  test("DurableObjectState type is defined", () => {
    const state: DurableObjectState = {
      id: { name: "test-id", toString: () => "test-id" },
      storage: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      },
    };
    expect(state.id.name).toBe("test-id");
  });
});

describe("BaseDurableObject", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = { waitUntil: () => {}, passThroughOnException: () => {} } as any;

    const doObj = new BaseDurableObject(mockRequest, mockEnv, mockCtx);
    expect(doObj).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseDurableObject.beforeHooks).toBeDefined();
    expect(BaseDurableObject.afterHooks).toBeDefined();
  });
});
