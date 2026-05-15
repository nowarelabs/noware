import { describe, expect, test } from "vite-plus/test";
import type { ContextLike, Port, UseCaseResult } from "@nowarelabs/shared";
import { BasePort } from "../src/index.ts";

describe("BasePort", () => {
  class TestPort extends BasePort<string, string> {
    async execute(input: string): Promise<UseCaseResult<string>> {
      return { success: true, data: input, status: "delivered" };
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const port = new TestPort(mockRequest, mockEnv, mockCtx);

    expect(port).toBeDefined();
  });

  test("execute returns delivered result on success", async () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const port = new TestPort(mockRequest, mockEnv, mockCtx);
    const result = await port.execute("hello");
    expect(result.success).toBe(true);
    expect(result.status).toBe("delivered");
    if (result.success) {
      expect(result.data).toBe("hello");
    }
  });
});
