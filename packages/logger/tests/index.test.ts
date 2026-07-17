import { describe, expect, test, vi } from "vite-plus/test";
import type { LoggerContext, EnvLike, RequestLike } from "@nowarelabs/shared";
import { Logger, LogLevel, BaseLogger } from "../src/index.ts";

const mockRequest = {} as RequestLike;
const mockEnv = {} as EnvLike;
const mockCtx = { waitUntil: () => {} } as unknown as LoggerContext;

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// ── LogLevel ───────────────────────────────────────────────────────

describe("LogLevel", () => {
  test("enum values are ordered correctly", () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
    expect(LogLevel.FATAL).toBe(4);
  });
});

// ── BaseLogger ─────────────────────────────────────────────────────

describe("BaseLogger", () => {
  test("constructs with request, env, ctx", () => {
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
    expect(BaseLogger.aroundHooks).toBeDefined();
  });

  test("static before hook registration", () => {
    class TestLogger extends BaseLogger {
    }
    const fn = async () => {};
    TestLogger.before(fn);
    expect(TestLogger.beforeHooks).toHaveLength(1);
    expect(TestLogger.beforeHooks[0].fn).toBe(fn);
  });

  test("static after hook registration", () => {
    class TestLogger extends BaseLogger {
    }
    const fn = async () => {};
    TestLogger.after(fn);
    expect(TestLogger.afterHooks).toHaveLength(1);
  });

  test("static around hook registration", () => {
    class TestLogger extends BaseLogger {
    }
    const fn = async (_: any, next: () => Promise<any>) => next();
    TestLogger.around(fn);
    expect(TestLogger.aroundHooks).toHaveLength(1);
  });

  test("Object.hasOwn prevents hook leaking between siblings", () => {
    class LoggerA extends BaseLogger {
    }
    class LoggerB extends BaseLogger {
    }

    LoggerA.before(async () => {});

    expect(LoggerA.beforeHooks).toHaveLength(1);
    expect(LoggerB.beforeHooks).toHaveLength(0);
  });

  test("runLogHooks runs before → around → after pipeline", async () => {
    const calls: string[] = [];

    class TestLogger extends BaseLogger {

      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }

      public async testRun() {
        return this.runLogHooks(async () => {
          calls.push("action");
          return "result";
        });
      }
    }

    TestLogger.before(async () => {
      calls.push("before");
    });

    TestLogger.around(async (_: any, next: () => Promise<any>) => {
      calls.push("around-before");
      const r = await next();
      calls.push("around-after");
      return r;
    });

    TestLogger.after(async (_: any, result: any) => {
      calls.push("after");
      return result;
    });

    const logger = new TestLogger();
    const result = await logger.testRun();

    expect(calls).toEqual(["before", "around-before", "action", "around-after", "after"]);
    expect(result).toBe("result");
  });

  test("before hook can short-circuit", async () => {
    const calls: string[] = [];

    class TestLogger extends BaseLogger {

      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }

      public async testRun() {
        return this.runLogHooks(async () => {
          calls.push("action");
          return "result";
        });
      }
    }

    TestLogger.before(async () => {
      calls.push("before");
      return "short-circuited";
    });

    const logger = new TestLogger();
    const result = await logger.testRun();

    expect(calls).toEqual(["before"]);
    expect(result).toBe("short-circuited");
  });

  test("around hook wraps the action", async () => {
    const calls: string[] = [];

    class TestLogger extends BaseLogger {

      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }

      public async testRun() {
        return this.runLogHooks(async () => {
          calls.push("action");
          return 42;
        });
      }
    }

    TestLogger.around(async (_: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const r = await next();
      calls.push("after-around");
      return r;
    });

    const logger = new TestLogger();
    const result = await logger.testRun();

    expect(calls).toEqual(["before-around", "action", "after-around"]);
    expect(result).toBe(42);
  });

  test("hook inheritance: parent hooks apply to child", async () => {
    const calls: string[] = [];

    class Parent extends BaseLogger {

      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }

      public async testRun() {
        return this.runLogHooks(async () => {
          calls.push("action");
        });
      }
    }

    class Child extends Parent {}

    Parent.before(async () => {
      calls.push("parent-before");
    });

    const logger = new Child();
    await logger.testRun();

    expect(calls).toEqual(["parent-before", "action"]);
  });

  test("hook inheritance: child hooks don't leak to parent", async () => {
    const calls: string[] = [];

    class Parent extends BaseLogger {

      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }

      public async testRun() {
        return this.runLogHooks(async () => {
          calls.push("action");
        });
      }
    }

    class Child extends Parent {}

    Child.before(async () => {
      calls.push("child-before");
    });

    const parentLogger = new Parent();
    await parentLogger.testRun();
    expect(calls).toEqual(["action"]);

    const childLogger = new Child();
    await childLogger.testRun();
    expect(calls).toEqual(["action", "child-before", "action"]);
  });

  test("hook inheritance: parent + child hooks run in correct order", async () => {
    const calls: string[] = [];

    class Parent extends BaseLogger {

      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }

      public async testRun() {
        return this.runLogHooks(async () => {
          calls.push("action");
        });
      }
    }

    class Child extends Parent {}

    Parent.before(async () => {
      calls.push("parent-before");
    });

    Child.before(async () => {
      calls.push("child-before");
    });

    const logger = new Child();
    await logger.testRun();

    expect(calls).toEqual(["parent-before", "child-before", "action"]);
  });

  test("setMetadata and getMetadata round-trip", () => {
    class TestLogger extends BaseLogger {
      constructor() {
        super(mockRequest, mockEnv, mockCtx);
      }
      public testSet(key: string, value: unknown) {
        this.setMetadata(key, value);
      }
      public testGet<T = unknown>(key: string) {
        return this.getMetadata<T>(key);
      }
    }

    const logger = new TestLogger();
    logger.testSet("key", "value");
    expect(logger.testGet<string>("key")).toBe("value");
    expect(logger.testGet<string>("missing")).toBeUndefined();
  });

  test("getEnv reads from env with default", () => {
    class TestLogger extends BaseLogger {
      constructor() {
        super(mockRequest, { DB_HOST: "localhost" } as EnvLike, mockCtx);
      }
      public testGetEnv<T = unknown>(key: string, defaultValue?: T) {
        return this.getEnv<T>(key, defaultValue);
      }
    }

    const logger = new TestLogger();
    expect(logger.testGetEnv<string>("DB_HOST")).toBe("localhost");
    expect(logger.testGetEnv<string>("MISSING", "default")).toBe("default");
  });
});

// ── Logger (config-only constructor) ───────────────────────────────

describe("Logger (config constructor)", () => {
  test("constructs with config", () => {
    const logger = new Logger({ service: "test" });
    expect(logger).toBeDefined();
  });

  test("methods exist", () => {
    const logger = new Logger({ service: "test" });
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.fatal).toBe("function");
    expect(typeof logger.setLevel).toBe("function");
    expect(typeof logger.withContext).toBe("function");
  });

  test("setLevel updates level", () => {
    const logger = new Logger({ service: "test" });
    logger.setLevel(LogLevel.ERROR);
    expect(logger).toBeDefined();
  });

  test("withContext returns new logger with merged context", () => {
    const logger = new Logger({ service: "test", context: { a: 1 } });
    const child = logger.withContext({ b: 2 });
    expect(child).toBeDefined();
    expect(child).not.toBe(logger);
  });

  test("debug is filtered when level is INFO", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger({ service: "test", level: LogLevel.INFO });
    logger.debug("should not appear");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test("info passes through when level is INFO", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger({ service: "test", level: LogLevel.INFO });
    logger.info("hello");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  test("error includes error attributes", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger({ service: "test", level: LogLevel.DEBUG });
    const err = new Error("boom");
    logger.error("failed", {}, err);

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.error_name).toBe("Error");
    expect(output.error_message).toBe("boom");
    expect(output.error_stack).toBeDefined();
    spy.mockRestore();
  });

  test("fatal includes error attributes", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger({ service: "test", level: LogLevel.DEBUG });
    const err = new Error("critical");
    logger.fatal("crash", {}, err);

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("FATAL");
    expect(output.error_name).toBe("Error");
    spy.mockRestore();
  });

  test("log entry includes standard fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger({ service: "my-svc", level: LogLevel.DEBUG });
    logger.info("test message", { user_id: "123" });

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.timestamp).toBeDefined();
    expect(output.level).toBe("INFO");
    expect(output.message).toBe("test message");
    expect(output.service).toBe("my-svc");
    expect(output.user_id).toBe("123");
    spy.mockRestore();
  });
});

// ── Logger (request/ctx constructor) ───────────────────────────────

describe("Logger (request/ctx constructor)", () => {
  test("constructs with request, env, ctx", () => {
    const logger = new Logger(mockRequest, mockEnv, mockCtx, {
      service: "test",
      level: LogLevel.DEBUG,
    });
    expect(logger).toBeDefined();
  });

  test("withContext returns new logger preserving request/ctx", () => {
    const logger = new Logger(mockRequest, mockEnv, mockCtx, {
      service: "test",
    });
    const child = logger.withContext({ extra: "data" });
    expect(child).toBeDefined();
    expect(child).not.toBe(logger);
  });

  test("environment stored in metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger(mockRequest, mockEnv, mockCtx, {
      service: "test",
      environment: "staging",
      level: LogLevel.DEBUG,
    });
    logger.info("env check");

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.environment).toBe("staging");
    spy.mockRestore();
  });
});

// ── Logger hook pipeline ───────────────────────────────────────────

describe("Logger hook pipeline", () => {
  test("static before hooks run before log", () => {
    const calls: string[] = [];

    class HookedLogger extends Logger {
    }

    HookedLogger.before(async (_: any) => {
      calls.push("before");
    });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new HookedLogger({ service: "test", level: LogLevel.DEBUG });
    logger.info("hello");

    expect(calls).toContain("before");
    spy.mockRestore();
  });

  test("static after hooks run after log", async () => {
    const calls: string[] = [];

    class HookedLogger extends Logger {
    }

    HookedLogger.after(async (_: any, result: any) => {
      calls.push("after");
      return result;
    });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new HookedLogger({ service: "test", level: LogLevel.DEBUG });
    logger.info("hello");

    await flushMicrotasks();
    expect(calls).toContain("after");
    spy.mockRestore();
  });

  test("around hook wraps the log action", async () => {
    const calls: string[] = [];

    class HookedLogger extends Logger {
    }

    HookedLogger.around(async (_: any, next: () => Promise<any>) => {
      calls.push("around-before");
      const r = await next();
      calls.push("around-after");
      return r;
    });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new HookedLogger({ service: "test", level: LogLevel.DEBUG });
    logger.info("hello");

    await flushMicrotasks();
    expect(calls).toEqual(["around-before", "around-after"]);
    spy.mockRestore();
  });

  test("hook inheritance: parent hooks apply to child Logger", () => {
    const calls: string[] = [];

    class ParentLogger extends Logger {
    }

    ParentLogger.before(async () => {
      calls.push("parent-before");
    });

    class ChildLogger extends ParentLogger {}

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new ChildLogger({ service: "test", level: LogLevel.DEBUG });
    logger.info("hello");

    expect(calls).toContain("parent-before");
    spy.mockRestore();
  });
});
