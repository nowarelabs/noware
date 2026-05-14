import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { Dto, BaseDto } from "../src/index.ts";

describe("Dto", () => {
  class TestDto extends Dto {}

  test("constructor accepts optional params", () => {
    const dto = new TestDto();
    expect(dto).toBeDefined();
  });

  test("toJSON returns empty object by default", () => {
    const dto = new TestDto();
    expect(dto.toJSON()).toEqual({});
  });

  test("fromJSON creates Dto instance", () => {
    const dto = TestDto.fromJSON({ name: "test" });
    expect(dto).toBeDefined();
  });
});

describe("BaseDto", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const dto = new BaseDto(mockRequest, mockEnv, mockCtx);
    expect(dto).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseDto.beforeHooks).toBeDefined();
    expect(BaseDto.afterHooks).toBeDefined();
  });
});
