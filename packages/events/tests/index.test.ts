import { describe, expect, test, vi } from "vite-plus/test";
import type { EventContext } from "@nowarelabs/shared";
import { BaseEvent, EventEmitter } from "../src/index.ts";

describe("EventEmitter", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {} as any;

    const emitter = new EventEmitter(mockRequest, mockEnv, mockCtx);
    expect(emitter).toBeDefined();
  });

  test("on method exists", () => {
    const emitter = new EventEmitter(new Request("http://localhost"), {}, {});
    expect(typeof emitter.on).toBe("function");
  });

  test("emit method exists", () => {
    const emitter = new EventEmitter(new Request("http://localhost"), {}, {});
    expect(typeof emitter.emit).toBe("function");
  });
});

describe("BaseEvent", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as EventContext;

    const event = new BaseEvent(mockRequest, mockEnv, mockCtx);
    expect(event).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseEvent.beforeHooks).toBeDefined();
    expect(BaseEvent.afterHooks).toBeDefined();
  });
});
