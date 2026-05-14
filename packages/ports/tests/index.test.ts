import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { Port, BasePort } from "../src/index.ts";

describe("Port", () => {
  test("Port interface requires execute method", () => {
    const port: Port<string> = {
      execute: async (_input: unknown) => "result",
    };

    expect(port.execute).toBeDefined();
  });
});

describe("BasePort", () => {
  class TestPort extends BasePort {
    async execute(_input: unknown) {
      return "result";
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

  test("execute can be overridden", async () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const port = new TestPort(mockRequest, mockEnv, mockCtx);
    const result = await port.execute("input");
    expect(result).toBe("result");
  });
});
