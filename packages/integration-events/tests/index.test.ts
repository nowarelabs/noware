import { describe, expect, test, vi } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { IntegrationEvent, BaseIntegrationEvent } from "../src/index.ts";

describe("IntegrationEvent", () => {
  test("IntegrationEvent interface requires type, payload, source, timestamp", () => {
    const event: IntegrationEvent = {
      type: "user.created",
      payload: { userId: "123" },
      source: "auth-service",
      timestamp: new Date(),
    };

    expect(event.type).toBe("user.created");
    expect(event.payload).toEqual({ userId: "123" });
    expect(event.source).toBe("auth-service");
  });
});

describe("BaseIntegrationEvent", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const handler = new BaseIntegrationEvent(mockRequest, mockEnv, mockCtx);
    expect(handler).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseIntegrationEvent.beforeHooks).toBeDefined();
    expect(BaseIntegrationEvent.afterHooks).toBeDefined();
  });
});
