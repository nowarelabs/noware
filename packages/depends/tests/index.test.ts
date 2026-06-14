import { describe, expect, test } from "vite-plus/test";
import {
  BaseDepends,
  DependencyKey,
  DependencyRegistry,
  DependsBuilder,
  KeyedDependency,
  toKeyed,
  provide,
  inject,
} from "../src/index.ts";

// ============================================================================
// Fixtures
// ============================================================================

interface Logger {
  log(message: string): void;
}

interface Database {
  query(sql: string): unknown[];
}

const DatabaseKey = DependencyKey.named<Database>("database");

// ============================================================================
// DependencyKey
// ============================================================================

describe("DependencyKey", () => {
  test("creates a key with name", () => {
    const key = new DependencyKey<string>("my.key");
    expect(key.name).toBe("my.key");
  });

  test("static named() factory shorthand", () => {
    const key = DependencyKey.named<number>("count");
    expect(key.name).toBe("count");
  });

  test("keys with same name are equal", () => {
    const a = new DependencyKey<string>("same");
    const b = new DependencyKey<string>("same");
    expect(a.name).toBe(b.name);
  });

  test("keys with different names are different", () => {
    const a = new DependencyKey<string>("alpha");
    const b = new DependencyKey<string>("beta");
    expect(a.name).not.toBe(b.name);
  });

  test("factory is accessible", () => {
    const factory = () => 42;
    const key = new DependencyKey<number>("answer", factory);
    expect(key.factory).toBe(factory);
  });

  test("factory is undefined when not provided", () => {
    const key = new DependencyKey<string>("no-default");
    expect(key.factory).toBeUndefined();
  });
});

// ============================================================================
// KeyedDependency
// ============================================================================

describe("KeyedDependency", () => {
  class AuthService implements KeyedDependency<AuthService> {
    static readonly key = DependencyKey.named<AuthService>("auth.service");
    readonly dependencyKey = AuthService.key;
  }

  class LoggerService implements KeyedDependency<LoggerService> {
    static readonly key = DependencyKey.named<LoggerService>("logger.service");
    readonly dependencyKey = LoggerService.key;
  }

  test("keyed dependency has a dependencyKey", () => {
    const auth = new AuthService();
    expect(auth.dependencyKey.name).toBe("auth.service");
  });

  test("register keyed dependency without explicit key", () => {
    const registry = new DependencyRegistry();
    registry.register(new AuthService());
    expect(registry.resolve(AuthService.key)).toBeInstanceOf(AuthService);
  });

  test("register multiple keyed dependencies", () => {
    const registry = new DependencyRegistry();
    registry.register(new AuthService());
    registry.register(new LoggerService());
    expect(registry.resolve(AuthService.key)).toBeInstanceOf(AuthService);
    expect(registry.resolve(LoggerService.key)).toBeInstanceOf(LoggerService);
  });

  test("register keyed dependency with explicit key takes priority", () => {
    const registry = new DependencyRegistry();
    const overrideKey = DependencyKey.named<AuthService>("auth.override");
    registry.register(overrideKey, new AuthService());
    expect(registry.resolve(overrideKey)).toBeInstanceOf(AuthService);
  });

  test("toKeyed creates an AnyKeyedDependency", () => {
    const auth = new AuthService();
    const anyKeyed = toKeyed(auth);
    expect(anyKeyed.storageKey).toBe("auth.service");
    expect(anyKeyed.dependency).toBe(auth);
  });

  test("keyed dependency with BaseDepends auto-attaches", () => {
    const registry = new DependencyRegistry();

    class MyService extends BaseDepends implements KeyedDependency<MyService> {
      static readonly key = DependencyKey.named<MyService>("my-service");
      readonly dependencyKey = MyService.key;
    }

    const service = new MyService();
    registry.register(service);
    expect(service.dependencies).toBe(registry);
  });

  test("DSL builder accepts keyed dependencies", () => {
    const registry = DependencyRegistry.build((give) => {
      give(new AuthService());
      give(new LoggerService());
    });

    expect(registry.resolve(AuthService.key)).toBeInstanceOf(AuthService);
    expect(registry.resolve(LoggerService.key)).toBeInstanceOf(LoggerService);
  });

  test("DSL builder accepts mixed explicit and keyed", () => {
    const explicitKey = DependencyKey.named<string>("title");

    const registry = DependencyRegistry.build((give) => {
      give(explicitKey, "hello");
      give(new AuthService());
    });

    expect(registry.resolve(explicitKey)).toBe("hello");
    expect(registry.resolve(AuthService.key)).toBeInstanceOf(AuthService);
  });

  test("register builder overload accepts keyed dependencies", () => {
    const registry = new DependencyRegistry();
    registry.register((give) => {
      give(new AuthService());
    });

    expect(registry.resolve(AuthService.key)).toBeInstanceOf(AuthService);
  });
});

// ============================================================================
// Basic Registry
// ============================================================================

describe("DependencyRegistry", () => {
  test("register and resolve", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("greeting");
    registry.register(key, "hello");
    expect(registry.resolve(key)).toBe("hello");
  });

  test("resolve returns the same registered instance", () => {
    const registry = new DependencyRegistry();
    const db: Database = { query: () => ["row1"] };
    registry.register(DatabaseKey, db);
    expect(registry.resolve(DatabaseKey)).toBe(db);
  });

  test("register overwrites existing value", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("name");
    registry.register(key, "first");
    registry.register(key, "second");
    expect(registry.resolve(key)).toBe("second");
  });

  test("register returns this for chaining", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("key");
    const result = registry.register(key, "value");
    expect(result).toBe(registry);
  });

  test("unregister removes a dependency", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("temp");
    registry.register(key, "value");
    registry.unregister(key);
    expect(() => registry.resolve(key)).toThrow();
  });

  test("clear removes all dependencies", () => {
    const registry = new DependencyRegistry();
    registry.register(DependencyKey.named("a"), 1);
    registry.register(DependencyKey.named("b"), 2);
    registry.clear();
    expect(() => registry.resolve(DependencyKey.named("a"))).toThrow();
    expect(() => registry.resolve(DependencyKey.named("b"))).toThrow();
  });

  test("has returns true for registered keys", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("existing");
    registry.register(key, "value");
    expect(registry.has(key)).toBe(true);
  });

  test("has returns false for unregistered keys", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("missing");
    expect(registry.has(key)).toBe(false);
  });

  test("throws when resolving unregistered key with no factory", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("unregistered");
    expect(() => registry.resolve(key)).toThrow("Dependency not registered");
  });

  test("resolves default from key factory when not registered", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("with-default", () => "default");
    expect(registry.resolve(key)).toBe("default");
  });

  test("key factory is called lazily and cached", () => {
    const registry = new DependencyRegistry();
    let callCount = 0;
    const key = DependencyKey.named<number>("lazy", () => {
      callCount++;
      return callCount;
    });

    const first = registry.resolve(key);
    const second = registry.resolve(key);

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(callCount).toBe(1);
  });

  test("registered value takes priority over key factory", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("override", () => "default");
    registry.register(key, "explicit");
    expect(registry.resolve(key)).toBe("explicit");
  });
});

// ============================================================================
// Parent Chain-of-Responsibility
// ============================================================================

describe("DependencyRegistry parent chain", () => {
  test("child resolves from parent when not in child", () => {
    const parent = new DependencyRegistry();
    const child = new DependencyRegistry(parent);

    const key = DependencyKey.named<string>("shared");
    parent.register(key, "from-parent");

    expect(child.resolve(key)).toBe("from-parent");
  });

  test("child resolution takes priority over parent", () => {
    const parent = new DependencyRegistry();
    const child = new DependencyRegistry(parent);

    const key = DependencyKey.named<string>("overridden");
    parent.register(key, "parent-value");
    child.register(key, "child-value");

    expect(child.resolve(key)).toBe("child-value");
  });

  test("parent is not affected by child registrations", () => {
    const parent = new DependencyRegistry();
    const child = new DependencyRegistry(parent);

    const key = DependencyKey.named<string>("only-child");
    child.register(key, "child-value");

    expect(() => parent.resolve(key)).toThrow();
  });

  test("deep chain resolves correctly", () => {
    const root = new DependencyRegistry();
    const mid = new DependencyRegistry(root);
    const leaf = new DependencyRegistry(mid);

    const key = DependencyKey.named<string>("deep");
    root.register(key, "root-value");

    expect(leaf.resolve(key)).toBe("root-value");
  });
});

// ============================================================================
// Builder DSL
// ============================================================================

describe("DependsBuilder DSL", () => {
  test("DependencyRegistry.build() accepts builder callback", () => {
    const registry = DependencyRegistry.build((give) => {
      give(DependencyKey.named("a"), 1);
      give(DependencyKey.named("b"), 2);
    });

    expect(registry.resolve(DependencyKey.named("a"))).toBe(1);
    expect(registry.resolve(DependencyKey.named("b"))).toBe(2);
  });

  test("DependencyRegistry.build() with parent", () => {
    const parent = new DependencyRegistry();
    parent.register(DependencyKey.named("shared"), "from-parent");

    const child = DependencyRegistry.build((give) => {
      give(DependencyKey.named("local"), "from-child");
    }, parent);

    expect(child.resolve(DependencyKey.named("local"))).toBe("from-child");
    expect(child.resolve(DependencyKey.named("shared"))).toBe("from-parent");
  });

  test("DependsBuilder give returns this for chaining", () => {
    const builder = new DependsBuilder();
    const result = builder.give(DependencyKey.named("x"), 1);
    expect(result).toBe(builder);
  });

  test("DependsBuilder build returns all entries", () => {
    const builder = new DependsBuilder();
    builder.give(DependencyKey.named("x"), 1);
    builder.give(DependencyKey.named("y"), 2);
    expect(builder.build()).toHaveLength(2);
  });

  test("register() overload accepts builder callback", () => {
    const registry = new DependencyRegistry();
    registry.register((give) => {
      give(DependencyKey.named("x"), 10);
      give(DependencyKey.named("y"), 20);
    });

    expect(registry.resolve(DependencyKey.named("x"))).toBe(10);
    expect(registry.resolve(DependencyKey.named("y"))).toBe(20);
  });

  test("register(builder) returns this for chaining", () => {
    const registry = new DependencyRegistry();
    const result = registry.register((give) => {
      give(DependencyKey.named("x"), 1);
    });

    expect(result).toBe(registry);
  });
});

// ============================================================================
// BaseDepends
// ============================================================================

describe("BaseDepends", () => {
  test("inject resolves registered dependencies", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("service");
    registry.register(key, "injected-value");

    class MyService extends BaseDepends {
      get value(): string {
        return this.inject(key);
      }
    }

    const instance = new MyService();
    instance.setDependencyRegistry(registry);

    expect(instance.value).toBe("injected-value");
  });

  test("dependencies fallback returns empty registry when not set", () => {
    class MyService extends BaseDepends {}
    const instance = new MyService();
    expect(instance.dependencies).toBeInstanceOf(DependencyRegistry);
  });

  test("setup() is called when registry is set", () => {
    const registry = new DependencyRegistry();
    let setupCalled = false;

    class MyService extends BaseDepends {
      protected setup(): void {
        setupCalled = true;
      }
    }

    const instance = new MyService();
    instance.setDependencyRegistry(registry);
    expect(setupCalled).toBe(true);
  });

  test("setup() is called only on first registry set", () => {
    let callCount = 0;

    class MyService extends BaseDepends {
      protected setup(): void {
        callCount++;
      }
    }

    const instance = new MyService();
    instance.setDependencyRegistry(new DependencyRegistry());
    instance.setDependencyRegistry(new DependencyRegistry());
    expect(callCount).toBe(1);
  });

  test("setup() can use inject", () => {
    const key = DependencyKey.named<string>("config", () => "configured");
    const registry = new DependencyRegistry();

    let resolvedValue: string | undefined;

    class MyService extends BaseDepends {
      protected setup(): void {
        resolvedValue = this.inject(key);
      }
    }

    const instance = new MyService();
    instance.setDependencyRegistry(registry);
    expect(resolvedValue).toBe("configured");
  });

  test("didAttach() is called when registered in registry", () => {
    let attached = false;

    class MyService extends BaseDepends {
      protected didAttach(): void {
        attached = true;
      }
    }

    const registry = new DependencyRegistry();
    const key = DependencyKey.named<MyService>("service");
    registry.register(key, new MyService());

    expect(attached).toBe(true);
  });
});

// ============================================================================
// Auto-Attach
// ============================================================================

describe("BaseDepends auto-attach on registration", () => {
  test("BaseDepends instance gets registry set when registered", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<BaseDepends>("dep");

    class MyService extends BaseDepends {
      get registry(): DependencyRegistry | undefined {
        return (this as any)._dependencies;
      }
    }

    const instance = new MyService();
    registry.register(key, instance);

    expect(instance.dependencies).toBe(registry);
  });

  test("inject works after auto-attach", () => {
    const dbKey = DependencyKey.named<Database>("db");
    const db: Database = { query: () => ["data"] };
    const registry = new DependencyRegistry();
    registry.register(dbKey, db);

    const serviceKey = DependencyKey.named<BaseDepends>("service");

    class UserService extends BaseDepends {
      get db(): Database {
        return this.inject(dbKey);
      }
    }

    const service = new UserService();
    registry.register(serviceKey, service);

    expect(service.db).toBe(db);
  });
});

// ============================================================================
// Fork
// ============================================================================

describe("DependencyRegistry fork", () => {
  test("fork creates child with same parent", () => {
    const parent = new DependencyRegistry();
    const key = DependencyKey.named<string>("shared");
    parent.register(key, "shared-value");

    const child = parent.fork();
    expect(child.resolve(key)).toBe("shared-value");
  });

  test("forked registry inherits parent storage", () => {
    const parent = new DependencyRegistry();
    parent.register(DependencyKey.named("a"), 1);

    const child = parent.fork();
    child.register(DependencyKey.named("b"), 2);

    expect(child.resolve(DependencyKey.named("a"))).toBe(1);
    expect(child.resolve(DependencyKey.named("b"))).toBe(2);
    expect(() => parent.resolve(DependencyKey.named("b"))).toThrow();
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("utility functions", () => {
  test("provide creates a key/instance pair", () => {
    const key = DependencyKey.named<string>("greeting");
    const pair = provide(key, "hello");

    expect(pair.key).toBe(key);
    expect(pair.instance).toBe("hello");
  });

  test("inject resolves from a DependsProvider", () => {
    const registry = new DependencyRegistry();
    const key = DependencyKey.named<string>("msg");
    registry.register(key, "from-inject");

    class MyService extends BaseDepends {
      get injected(): string {
        return inject(this, key);
      }
    }

    const instance = new MyService();
    instance.setDependencyRegistry(registry);

    expect(instance.injected).toBe("from-inject");
  });
});

// ============================================================================
// Real-World Scenarios
// ============================================================================

describe("real-world scenarios", () => {
  test("service depends on another service", () => {
    const loggerKey = DependencyKey.named<Logger>("logger");
    const userServiceKey = DependencyKey.named<BaseDepends>("user-service");

    const logger: Logger = { log: (_m: string) => {} };

    class UserService extends BaseDepends {
      private get logger(): Logger {
        return this.inject(loggerKey);
      }

      greet(name: string): string {
        this.logger.log(`greeting ${name}`);
        return `Hello, ${name}!`;
      }
    }

    const registry = DependencyRegistry.build((give) => {
      give(loggerKey, logger);
      give(userServiceKey, new UserService());
    });

    const userService = registry.resolve(userServiceKey) as UserService;
    expect(userService.greet("World")).toBe("Hello, World!");
  });

  test("scoped overrides with forked registry", () => {
    const configKey = DependencyKey.named<string>("config");
    const parent = new DependencyRegistry();
    parent.register(configKey, "production-config");

    const testRegistry = parent.fork();
    testRegistry.register(configKey, "test-config");

    expect(parent.resolve(configKey)).toBe("production-config");
    expect(testRegistry.resolve(configKey)).toBe("test-config");
  });

  test("builder DSL for clean service registration", () => {
    const authKey = DependencyKey.named<{ login(): string }>("auth");
    const apiKey = DependencyKey.named<{ fetch(): string }>("api");

    const registry = new DependencyRegistry();
    registry.register((give) => {
      give(authKey, { login: () => "token" });
      give(apiKey, { fetch: () => "data" });
    });

    expect(registry.resolve(authKey).login()).toBe("token");
    expect(registry.resolve(apiKey).fetch()).toBe("data");
  });
});
