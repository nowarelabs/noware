import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { Logger, LogLevel, BaseLogger } from "../src/index.ts";

describe("Logger", () => {
  test("LogLevel enum values", () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
  });

  test("constructor accepts config", () => {
    const logger = new Logger({ service: "test" });
    expect(logger).toBeDefined();
  });

  test("logger methods exist", () => {
    const logger = new Logger({});
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});

describe("BaseLogger", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const logger = new BaseLogger({}, mockRequest, mockEnv, mockCtx);
    expect(logger).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseLogger.beforeHooks).toBeDefined();
    expect(BaseLogger.afterHooks).toBeDefined();
  });
});
