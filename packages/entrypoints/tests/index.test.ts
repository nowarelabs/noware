import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseEntrypoint } from "../src/index.ts";

describe("BaseEntrypoint", () => {
  class TestEntrypoint extends BaseEntrypoint {
    async fetch(
      _request: globalThis.Request,
      _env: Record<string, unknown>,
      _ctx: any,
    ) {
      return new Response("OK");
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const entrypoint = new TestEntrypoint(mockRequest, mockEnv, mockCtx);
    expect(entrypoint).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseEntrypoint.beforeHooks).toBeDefined();
    expect(BaseEntrypoint.afterHooks).toBeDefined();
  });
});
