import { describe, expect, test } from "vite-plus/test";
import type { NormalizerContext } from "@nowarelabs/shared";
import { Normalizer, BaseNormalizer } from "../src/index.ts";

describe("Normalizer", () => {
  test("Normalizer interface requires normalize method", () => {
    const normalizer: Normalizer<string> = {
      normalize: () => "normalized",
    };

    expect(normalizer.normalize).toBeDefined();
  });
});

describe("BaseNormalizer", () => {
  class TestNormalizer extends BaseNormalizer {
    normalize(data: unknown) {
      return { ...(data as object), normalized: true };
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as NormalizerContext;

    const normalizer = new TestNormalizer(mockRequest, mockEnv, mockCtx);

    expect(normalizer).toBeDefined();
  });

  test("normalize can be overridden", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as NormalizerContext;

    const normalizer = new TestNormalizer(mockRequest, mockEnv, mockCtx);
    const result = normalizer.normalize({ name: "test" });
    expect(result).toEqual({ name: "test", normalized: true });
  });
});
