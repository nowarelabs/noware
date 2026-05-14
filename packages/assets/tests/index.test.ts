import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseAsset } from "../src/index.ts";

describe("BaseAsset", () => {
  test("constructor accepts config, request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const asset = new BaseAsset({}, mockRequest, mockEnv, mockCtx);
    expect(asset).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseAsset.beforeHooks).toBeDefined();
    expect(BaseAsset.afterHooks).toBeDefined();
  });
});
