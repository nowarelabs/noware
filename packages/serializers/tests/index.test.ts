import { describe, expect, test } from "vite-plus/test";
import type { SerializerContext } from "@nowarelabs/shared";
import { Serializer, BaseSerializer } from "../src/index.ts";

describe("Serializer", () => {
  class TestSerializer extends Serializer {}

  test("constructor accepts optional params", () => {
    const serializer = new TestSerializer();
    expect(serializer).toBeDefined();
  });

  test("serialize converts object to string", () => {
    const serializer = new TestSerializer();
    const result = serializer.serialize({ name: "test" });
    expect(result).toBe('{"name":"test"}');
  });

  test("deserialize converts string to object", () => {
    const serializer = new TestSerializer();
    const result = serializer.deserialize('{"name":"test"}');
    expect(result).toEqual({ name: "test" });
  });
});

describe("BaseSerializer", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as SerializerContext;

    const serializer = new BaseSerializer(mockRequest, mockEnv, mockCtx);
    expect(serializer).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseSerializer.beforeHooks).toBeDefined();
    expect(BaseSerializer.afterHooks).toBeDefined();
  });
});
