import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { ok, err, ResultFactory, BaseResult } from "../src/index.ts";

describe("Result", () => {
  describe("ok", () => {
    test("creates successful result", () => {
      const result = ok("test value");
      expect(result.ok).toBe(true);
      expect((result as { value: string }).value).toBe("test value");
    });
  });

  describe("err", () => {
    test("creates error result", () => {
      const result = err("test error");
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).toBe("test error");
    });
  });

  describe("ResultFactory", () => {
    test("constructor accepts optional params", () => {
      const factory = new ResultFactory();
      expect(factory).toBeDefined();
    });
  });
});

describe("BaseResult", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const result = new BaseResult(mockRequest, mockEnv, mockCtx);
    expect(result).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseResult.beforeHooks).toBeDefined();
    expect(BaseResult.afterHooks).toBeDefined();
  });
});
