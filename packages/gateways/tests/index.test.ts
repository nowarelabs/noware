import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseGateway } from "../src/index.ts";

describe("BaseGateway", () => {
  class TestGateway extends BaseGateway {
    protected async execute(_input: unknown) {
      return {};
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const gateway = new TestGateway(mockRequest, mockEnv, mockCtx);

    expect(gateway).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseGateway.beforeHooks).toBeDefined();
    expect(BaseGateway.afterHooks).toBeDefined();
  });
});
