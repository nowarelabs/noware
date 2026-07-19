import { describe, expect, test, vi } from "vite-plus/test";
import type { PluginContext } from "@nowarelabs/shared";
import { Plugin, BasePlugin } from "../src/index.ts";

// ── Fixtures ──────────────────────────────────────────────────

const mockRequest = new Request("http://localhost");
const mockEnv = {} as Record<string, unknown>;
const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as PluginContext;

function reset(...classes: any[]) {
  for (const cls of classes) {
    cls.beforeHooks = [];
    cls.afterHooks = [];
    cls.aroundHooks = [];
    cls.pluginName = undefined;
  }
}

// ── Plugin interface ──────────────────────────────────────────

describe("Plugin", () => {
  test("requires name and install", () => {
    const plugin: Plugin = {
      name: "test-plugin",
      install: () => {},
    };

    expect(plugin.name).toBe("test-plugin");
    expect(typeof plugin.install).toBe("function");
  });
});

// ── BasePlugin basics ─────────────────────────────────────────

describe("BasePlugin", () => {
  test("constructor accepts request, env, ctx", () => {
    const plugin = new BasePlugin(mockRequest, mockEnv, mockCtx);
    expect(plugin).toBeDefined();
  });

  test("implements Plugin interface", () => {
    const plugin = new BasePlugin(mockRequest, mockEnv, mockCtx);
    expect(typeof plugin.name).toBe("string");
    expect(typeof plugin.install).toBe("function");
  });
});

// ── Plugin naming ─────────────────────────────────────────────

describe("Plugin naming", () => {
  test("named() sets pluginName, name getter reads it", () => {
    class NamedPlugin extends BasePlugin {}

    NamedPlugin.named("my-plugin");
    expect(NamedPlugin.pluginName).toBe("my-plugin");

    const p = new NamedPlugin(mockRequest, mockEnv, mockCtx);
    expect(p.name).toBe("my-plugin");
    reset(NamedPlugin);
  });

  test("name getter falls back to constructor name when unnamed", () => {
    class UnnamedPlugin extends BasePlugin {}

    const p = new UnnamedPlugin(mockRequest, mockEnv, mockCtx);
    expect(p.name).toBe("UnnamedPlugin");
  });
});

// ── Hook registration ─────────────────────────────────────────

describe("Hook registration", () => {
  test("before/after/around register hooks on the class", () => {
    class HookedPlugin extends BasePlugin {}

    HookedPlugin.before((() => {}) as any);
    HookedPlugin.after((() => {}) as any);
    HookedPlugin.around((() => {}) as any);

    expect(HookedPlugin.beforeHooks).toHaveLength(1);
    expect(HookedPlugin.afterHooks).toHaveLength(1);
    expect(HookedPlugin.aroundHooks).toHaveLength(1);
    reset(HookedPlugin);
  });

  test("hooks are per-class (Object.hasOwn guard creates own copy)", () => {
    class Parent extends BasePlugin {}
    class Child extends Parent {}

    Parent.before((() => {}) as any);
    expect(Parent.beforeHooks).toHaveLength(1);

    // Child gets its own empty array when it calls before()
    Child.before((() => {}) as any);
    expect(Child.beforeHooks).toHaveLength(1);
    expect(Parent.beforeHooks).toHaveLength(1);

    reset(Parent, Child);
  });
});

// ── install() → setup() ───────────────────────────────────────

describe("install() → setup()", () => {
  test("install calls setup", async () => {
    const setupFn = vi.fn();

    class TestPlugin extends BasePlugin {
      protected async setup() {
        setupFn();
      }
    }

    const plugin = new TestPlugin(mockRequest, mockEnv, mockCtx);
    await plugin.install();
    expect(setupFn).toHaveBeenCalledOnce();
  });

  test("install runs before/after hooks around setup", async () => {
    const trace: string[] = [];

    class TracePlugin extends BasePlugin {
      static {
        this.before(() => {
          trace.push("before");
        });
        this.after(() => {
          trace.push("after");
        });
      }

      protected async setup() {
        trace.push("setup");
      }
    }

    const plugin = new TracePlugin(mockRequest, mockEnv, mockCtx);
    await plugin.install();

    expect(trace).toEqual(["before", "setup", "after"]);
    reset(TracePlugin);
  });
});

// ── runAction() lifecycle ─────────────────────────────────────

describe("runAction()", () => {
  test("before → action → after in order", async () => {
    const trace: string[] = [];

    class LifecyclePlugin extends BasePlugin {
      static {
        this.before(() => {
          trace.push("before");
        });
        this.after(() => {
          trace.push("after");
        });
      }

      async doWork() {
        return this.runAction("doWork", () => {
          trace.push("action");
          return "result";
        });
      }
    }

    const plugin = new LifecyclePlugin(mockRequest, mockEnv, mockCtx);
    const result = await plugin.doWork();

    expect(trace).toEqual(["before", "action", "after"]);
    expect(result).toBe("result");
    reset(LifecyclePlugin);
  });

  test("around hooks wrap the action", async () => {
    const trace: string[] = [];

    class AroundPlugin extends BasePlugin {
      static {
        this.around(async (_instance, next) => {
          trace.push("around-start");
          const result = await next();
          trace.push("around-end");
          return result;
        });
      }

      async doWork() {
        return this.runAction("doWork", () => {
          trace.push("action");
          return 42;
        });
      }
    }

    const plugin = new AroundPlugin(mockRequest, mockEnv, mockCtx);
    const result = await plugin.doWork();

    expect(trace).toEqual(["around-start", "action", "around-end"]);
    expect(result).toBe(42);
    reset(AroundPlugin);
  });

  test("full lifecycle: before → around → action → around → after", async () => {
    const trace: string[] = [];

    class FullPlugin extends BasePlugin {
      static {
        this.before(() => {
          trace.push("before");
        });
        this.around(async (_instance, next) => {
          trace.push("around-start");
          const r = await next();
          trace.push("around-end");
          return r;
        });
        this.after(() => {
          trace.push("after");
        });
      }

      async doWork() {
        return this.runAction("doWork", () => {
          trace.push("action");
        });
      }
    }

    const plugin = new FullPlugin(mockRequest, mockEnv, mockCtx);
    await plugin.doWork();

    expect(trace).toEqual(["before", "around-start", "action", "around-end", "after"]);
    reset(FullPlugin);
  });
});

// ── only/except scoping ───────────────────────────────────────

describe("only/except scoping", () => {
  test("hook with only: [sync] runs only for matching action", async () => {
    const trace: string[] = [];

    class ScopedPlugin extends BasePlugin {
      static {
        this.before(
          () => {
            trace.push("auth");
          },
          { only: ["sync"] },
        );
      }

      async sync() {
        return this.runAction("sync", () => trace.push("sync"));
      }

      async export() {
        return this.runAction("export", () => trace.push("export"));
      }
    }

    const plugin = new ScopedPlugin(mockRequest, mockEnv, mockCtx);

    await plugin.sync();
    expect(trace).toEqual(["auth", "sync"]);
    trace.length = 0;

    await plugin.export();
    expect(trace).toEqual(["export"]);
    reset(ScopedPlugin);
  });

  test("hook with except: [export] skips that action", async () => {
    const trace: string[] = [];

    class ExceptPlugin extends BasePlugin {
      static {
        this.before(
          () => {
            trace.push("before");
          },
          { except: ["export"] },
        );
      }

      async sync() {
        return this.runAction("sync", () => trace.push("sync"));
      }

      async export() {
        return this.runAction("export", () => trace.push("export"));
      }
    }

    const plugin = new ExceptPlugin(mockRequest, mockEnv, mockCtx);

    await plugin.sync();
    expect(trace).toEqual(["before", "sync"]);
    trace.length = 0;

    await plugin.export();
    expect(trace).toEqual(["export"]);
    reset(ExceptPlugin);
  });

  test("unscoped hooks run for every action", async () => {
    const trace: string[] = [];

    class GlobalPlugin extends BasePlugin {
      static {
        this.before(() => trace.push("global"));
      }

      async sync() {
        return this.runAction("sync", () => trace.push("sync"));
      }

      async export() {
        return this.runAction("export", () => trace.push("export"));
      }
    }

    const plugin = new GlobalPlugin(mockRequest, mockEnv, mockCtx);

    await plugin.sync();
    expect(trace).toEqual(["global", "sync"]);
    trace.length = 0;

    await plugin.export();
    expect(trace).toEqual(["global", "export"]);
    reset(GlobalPlugin);
  });
});

// ── After hook result transformation ──────────────────────────

describe("after hook result transformation", () => {
  test("after hook can transform the return value", async () => {
    class TransformPlugin extends BasePlugin {
      static {
        this.after((_instance, result) => {
          return (result as number) * 2;
        });
      }

      async compute() {
        return this.runAction("compute", () => 21);
      }
    }

    const plugin = new TransformPlugin(mockRequest, mockEnv, mockCtx);
    const result = await plugin.compute();
    expect(result).toBe(42);
    reset(TransformPlugin);
  });
});

// ── Inheritance ───────────────────────────────────────────────

describe("Inheritance", () => {
  test("child inherits parent hooks (parent runs first)", async () => {
    const trace: string[] = [];

    class ParentPlugin extends BasePlugin {
      static {
        this.before(() => trace.push("parent"));
      }
    }

    class ChildPlugin extends ParentPlugin {
      static {
        this.before(() => trace.push("child"));
      }

      async doWork() {
        return this.runAction("doWork", () => trace.push("action"));
      }
    }

    const plugin = new ChildPlugin(mockRequest, mockEnv, mockCtx);
    await plugin.doWork();

    expect(trace).toEqual(["parent", "child", "action"]);
    reset(ParentPlugin, ChildPlugin);
  });
});
