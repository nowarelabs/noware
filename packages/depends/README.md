# @nowarelabs/depends

A predictable, registry-based dependency injection system for Standard Gauge applications. Two layers: a **Rails-inspired DSL** for everyday use, and **primitives** underneath for framework authors and edge cases.

**Standard Gauge Position:** Cross-cutting (used by all layers)

## Features

- **Rails-inspired DSL** — `container()`, `scope()`, `fake()`, `uses()`. No decorators, no decorator config.
- **Typed keys** — `DependencyKey<T>` with optional lazy default factories
- **Chain-of-responsibility** — Parent registries for scoped overrides (request-level, test-level)
- **Self-keyed types** — `KeyedDependency<T>` lets instances carry their own key
- **Lifecycle hooks** — `setup()` and `didAttach()` on `BaseDepends`
- **Auto-attach** — Registering a `BaseDepends` subclass automatically injects the registry
- **Fluent registration DSL** — `DependencyRegistry.build(give => ...)`
- **Thin — zero runtime dependencies** beyond `@nowarelabs/shared` types
- **No decorators, no reflection**

## Installation

```bash
npm install @nowarelabs/depends
```

## Quick Start (DSL)

The DSL is the 90% layer — enough for most applications. When you need more control, the primitives are a single import away.

### 1. Declare Dependencies

```typescript
import { DependsOn, container, uses, DependencyKey } from "@nowarelabs/depends";

class EmailService extends DependsOn {
  send(to: string, subject: string) {
    return `Emailed ${to}: ${subject}`;
  }
}

class ReportService extends DependsOn {
  private db = uses(DependencyKey.named<Database>("Database"));
  private email = uses(EmailService);

  run() {
    this.db.query("SELECT 1");
    return this.email.send("admin@co.com", "Report");
  }
}
```

### 2. Bootstrap

```typescript
const registry = container({
  Logger: () => new ConsoleLogger(),
  Database: () => new PostgresDatabase(env.DATABASE_URL),
  services: [EmailService, ReportService],
});
```

### 3. Use

```typescript
const report = app.resolve(ReportService);
report.run();
```

### 4. Scope (per-request overrides)

```typescript
const req = app.scope({
  Logger: () => new RequestScopedLogger(requestId),
});
```

### 5. Fake (testing)

```typescript
const { resolve } = app.fake({
  Database: () => new MockDatabase(),
});

report = resolve(ReportService);
```

---

## DSL Reference

### `container(config)`

Creates a registry from a plain config object. Named entries are factory functions called eagerly at bootstrap. The `services` key registers class constructors — instances are created (with no constructor arguments) and their `uses()` calls resolve against the active container context.

```typescript
const registry = container({
  Logger: () => new ConsoleLogger(),
  Database: () => new PostgresDatabase(),
  services: [EmailService, ReportService],
});
```

### `uses(source)`

A standalone function (no `this.` needed) that resolves a dependency eagerly at construction time. Accepts either a `DependencyKey<T>` or a class constructor registered in the `services` array.

```typescript
class ReportService extends DependsOn {
  private db = uses(Keys.Database); // DependencyKey
  private email = uses(EmailService); // class reference
}
```

`uses()` only works inside a `container()` or `scope()` call — outside those it throws.

**Important:** `uses()` resolves eagerly — the dependency is captured when the field initializer runs (inside `new Ctor()`). For class references in `services`, dependents must appear _after_ their dependencies in the array. Named `container()` factories are always registered before services and can be referenced by `DependencyKey` in any order.

### `DependsOn`

Marker base class for DI-managed services. Alias for `BaseDepends` — extends it directly, so `inject()`, `setup()`, and `didAttach()` are all available. Extending it is optional (any class registered via `services` works), but self-documents that the class participates in DI.

### `registry.resolve(source)`

Resolves a dependency by `DependencyKey` or class constructor.

```typescript
app.resolve(ReportService).run();
app.resolve(Keys.Database);
```

### `registry.scope(config)`

Creates a child registry that inherits all parent registrations and can override named factories. Parent is unmodified. Lazy `scope()` override of a named factory affects only newly-resolved callers — services already constructed in the parent hold their original eagerly-resolved reference.

```typescript
const req = app.scope({
  Logger: () => new RequestScopedLogger(id),
});

req.resolve(Keys.Logger); // RequestScopedLogger
req.resolve(Keys.Database); // PostgresDatabase (inherited)
app.resolve(Keys.Logger); // ConsoleLogger (unaffected)
```

### `registry.fake(config)`

Returns `{ resolve }` — a function that resolves against a scoped registry with faked overrides. No full registry object, just resolve what you need. Ideal for tests. Note that services already constructed in the parent hold their eagerly-resolved references, so fakes only affect fresh resolutions.

```typescript
const { resolve } = app.fake({
  Database: () => new MockDatabase(),
});

resolve(Keys.Database); // MockDatabase
resolve(ReportService); // real ReportService (inherited)
```

---

## Primitives Reference

The primitives are the framework-author layer. Use them when the DSL's conventions don't fit — custom lifetimes, programmatic registration, complex scoping.

### Defining Keys

```typescript
import { DependencyKey } from "@nowarelabs/depends";

// Minimal key (no default — must be registered)
const Key = new DependencyKey<MyType>("my.key");

// With lazy default factory
const Key = new DependencyKey<MyType>("my.key", () => new MyType());

// Static factory shorthand (recommended)
const Key = DependencyKey.named<MyType>("my.key");
const Key = DependencyKey.named<MyType>("my.key", () => new MyType());
```

The factory is called at most once and cached.

### DependencyRegistry

```typescript
import { DependencyRegistry } from "@nowarelabs/depends";

// Create
const registry = new DependencyRegistry();
const registry = new DependencyRegistry(parentRegistry);

// Builder DSL (recommended for app bootstrap)
const registry = DependencyRegistry.build((give) => {
  give(Keys.Logger, new ConsoleLogger());
  give(new EmailService()); // KeyedDependency — key inferred
});

// Register
registry.register(Keys.Logger, new ConsoleLogger());
registry.register(new EmailService()); // KeyedDependency
registry.register((give) => {
  give(Keys.Logger, new ConsoleLogger());
});

// Resolve
const logger = registry.resolve(Keys.Logger);

// Chain-of-responsibility: checks self → parent → key factory → throw

// Unregister / clear / has
registry.unregister(Keys.Logger);
registry.clear();
registry.has(Keys.Logger);

// Fork (child registry, safe to mutate)
const testRegistry = appRegistry.fork();
```

### BaseDepends

Extend `BaseDepends` to get `inject()` (lazy, use in getters) and lifecycle hooks.

```typescript
import { BaseDepends } from "@nowarelabs/depends";

class MyService extends BaseDepends {
  private get logger() {
    return this.inject(Keys.Logger);
  }

  protected setup(): void {
    // Called once when registry is first attached.
  }

  protected didAttach(): void {
    // Called after registration in the DependencyRegistry.
  }
}
```

**Important:** Use getters with `inject()`, not field initializers. Field initializers run during `new`, before the registry is attached. Getters are evaluated lazily — this mirrors Swift's `@Dependency` property wrapper.

### KeyedDependency

Dependencies that carry their own key, enabling registration without an explicit key argument.

```typescript
import type { KeyedDependency } from "@nowarelabs/depends";

class EmailService extends BaseDepends implements KeyedDependency<EmailService> {
  static readonly key = DependencyKey.named<EmailService>("email.service");
  readonly dependencyKey = EmailService.key;

  send(to: string, subject: string): void {
    /* ... */
  }
}

registry.register(new EmailService());
registry.resolve(EmailService.key);
```

## API Reference

### DependencyKey\<T\>

| Member         | Signature                                             | Description              |
| -------------- | ----------------------------------------------------- | ------------------------ |
| `constructor`  | `(name: string, factory?: () => T)`                   | Create a key             |
| `static named` | `(name: string, factory?: () => T): DependencyKey<T>` | Create a key (shorthand) |
| `name`         | `string`                                              | Unique identifier        |
| `factory`      | `(() => T) \| undefined`                              | Optional lazy default    |

### DependencyRegistry

| Method                           | Returns              | Description                              |
| -------------------------------- | -------------------- | ---------------------------------------- |
| `constructor(parent?)`           | —                    | Create registry, optionally with parent  |
| `static build(builder, parent?)` | `DependencyRegistry` | Create via DSL callback                  |
| `register(key, instance)`        | `this`               | Register by key                          |
| `register(instance)`             | `this`               | Register a KeyedDependency               |
| `register(builder)`              | `this`               | Register via DSL callback                |
| `resolve(key)`                   | `T`                  | Resolve by key (chain-of-responsibility) |
| `unregister(key)`                | `void`               | Remove a registration                    |
| `clear()`                        | `void`               | Remove all registrations                 |
| `has(key)`                       | `boolean`            | Check if key is registered               |
| `fork()`                         | `DependencyRegistry` | Create child registry                    |

### BaseDepends (abstract)

| Member                  | Signature            | Description                                 |
| ----------------------- | -------------------- | ------------------------------------------- |
| `dependencies`          | `DependencyRegistry` | The attached registry (falls back to empty) |
| `setDependencyRegistry` | `(registry) => void` | Called by registry on registration          |
| `inject(key)`           | `T`                  | Resolve a dependency                        |
| `setup()`               | `void`               | Lifecycle hook (override)                   |
| `didAttach()`           | `void`               | Lifecycle hook (override)                   |

### KeyedDependency\<T\>

| Member          | Signature          | Description                           |
| --------------- | ------------------ | ------------------------------------- |
| `dependencyKey` | `DependencyKey<T>` | The key associated with this instance |

### DSL

| Export                     | Signature     | Description                                                    |
| -------------------------- | ------------- | -------------------------------------------------------------- |
| `container(config)`        | `Registry`    | Bootstrap registry from config                                 |
| `registry.scope(config)`   | `Registry`    | Create scoped child                                            |
| `registry.fake(config)`    | `{ resolve }` | Create faked resolve function                                  |
| `registry.resolve(source)` | `T`           | Resolve by key or class                                        |
| `uses(source)`             | `T`           | Resolve eagerly at construction time                           |
| `DependsOn`                | `class`       | Marker base class (alias for BaseDepends, extends it directly) |

## Development

```bash
# Install dependencies
vp install

# Run tests
vp test

# Type check and lint
vp check

# Build
vp pack
```

## License

MIT — See LICENSE file for details.
