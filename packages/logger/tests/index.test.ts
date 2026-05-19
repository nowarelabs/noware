import { describe, expect, test } from "vite-plus/test";
import type { ContextLike, EnvLike, RequestLike } from "@nowarelabs/shared";
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
    const logger = new Logger({ service: "test" });
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});

describe("BaseLogger", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = {} as RequestLike;
    const mockEnv = {} as EnvLike;
    const mockCtx = { waitUntil: () => {} } as unknown as ContextLike;

    class TestLogger extends BaseLogger {
      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }
    }

    const logger = new TestLogger();
    expect(logger).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseLogger.beforeHooks).toBeDefined();
    expect(BaseLogger.afterHooks).toBeDefined();
  });
});

describe("Logger extends BaseLogger", () => {
  test("constructor with request, env, ctx", () => {
    const mockRequest = {} as RequestLike;
    const mockEnv = { ENVIRONMENT: "development" } as EnvLike;
    const mockCtx = { waitUntil: () => {} } as unknown as ContextLike;

    const logger = new Logger(mockRequest, mockEnv, mockCtx, {
      service: "test-service",
      level: LogLevel.DEBUG,
    });

    expect(logger).toBeDefined();
  });

  test("setLevel works", () => {
    const logger = new Logger({ service: "test" });
    logger.setLevel(LogLevel.ERROR);
    expect(logger).toBeDefined();
  });

  test("withContext returns new logger", () => {
    const logger = new Logger({ service: "test" });
    const childLogger = logger.withContext({ user_id: "123" });
    expect(childLogger).toBeDefined();
  });

  test("getMetadata and setMetadata work", () => {
    const mockRequest = {} as RequestLike;
    const mockEnv = {} as EnvLike;
    const mockCtx = { waitUntil: () => {} } as unknown as ContextLike;

    class TestLogger extends Logger {
      public testSetMetadata() {
        this.setMetadata("key", "value");
      }
      public testGetMetadata() {
        return this.getMetadata<string>("key");
      }
    }

    const logger = new TestLogger(mockRequest, mockEnv, mockCtx, { service: "test" });
    logger.testSetMetadata();
    expect(logger.testGetMetadata()).toBe("value");
  });

  test("getEnv works", () => {
    const mockRequest = {} as RequestLike;
    const mockEnv = { DB_HOST: "localhost" } as EnvLike;
    const mockCtx = { waitUntil: () => {} } as unknown as ContextLike;

    class TestLogger extends Logger {
      public testGetEnv(key: string, defaultValue?: string) {
        return this.getEnv(key, defaultValue);
      }
    }

    const logger = new TestLogger(mockRequest, mockEnv, mockCtx, { service: "test" });
    expect(logger.testGetEnv("DB_HOST")).toBe("localhost");
    expect(logger.testGetEnv("MISSING", "default")).toBe("default");
  });
});
