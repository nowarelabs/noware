import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseAggregate } from "../src/index.ts";

describe("BaseAggregate", () => {
  class TestAggregate extends BaseAggregate {
    protected event = {} as any;

    protected getEvent() {
      return this.event;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const aggregate = new TestAggregate(mockRequest, mockEnv, mockCtx);

    expect(aggregate).toBeDefined();
    expect((aggregate as unknown as { request: Request }).request).toBe(
      mockRequest,
    );
  });

  test("getEvent returns the event", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const aggregate = new TestAggregate(mockRequest, mockEnv, mockCtx);

    expect(
      (aggregate as unknown as { getEvent: () => object }).getEvent(),
    ).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseAggregate.beforeHooks).toBeDefined();
    expect(BaseAggregate.afterHooks).toBeDefined();
  });
});
