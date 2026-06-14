# @nowarelabs/depends

A predictable, registry-based dependency injection system for Standard Gauge applications. Combines a service locator with typed keys, lazy resolution, and a natural DSL for registration.

**Standard Gauge Position:** Cross-cutting (used by all layers)

## Features

- **Typed keys** — `DependencyKey<T>` with optional lazy default factories
- **Chain-of-responsibility** — Parent registries for scoped overrides (request-level, test-level)
- **Self-keyed types** — `KeyedDependency<T>` lets instances carry their own key
- **Lifecycle hooks** — `setup()` and `didAttach()` on `BaseDepends`
- **Auto-attach** — Registering a `BaseDepends` subclass automatically injects the registry
- **Fluent registration DSL** — `DependencyRegistry.build(give => ...)`
- **Thin — zero runtime dependencies** beyond `@nowarelabs/shared` types
- **No decorators** — no reflection, no TS experimental decorators

## Installation

```bash
npm install @nowarelabs/depends
```

## Quick Start

### 1. Define Keys

```typescript
import { DependencyKey } from "@nowarelabs/depends";

interface Logger {
  log(message: string): void;
}

interface Database {
  query(sql: string): unknown[];
}

export const Keys = {
  Logger: DependencyKey.named<Logger>("logger"),
  Database: DependencyKey.named<Database>("database"),
  // With a lazy default factory (used when nothing is registered):
  Cache: DependencyKey.named<CacheClient>("cache", () => new MemoryCache()),
};
```

### 2. Create a Registry

```typescript
import { DependencyRegistry } from "@nowarelabs/depends";

const registry = DependencyRegistry.build((give) => {
  give(Keys.Logger, new ConsoleLogger());
  give(Keys.Database, new PostgresDatabase());
});
```

### 3. Use in a Class

```typescript
import { BaseDepends, DependencyKey } from "@nowarelabs/depends";

class UserService extends BaseDepends {
  private get logger() {
    return this.inject(Keys.Logger);
  }

  private get db() {
    return this.inject(Keys.Database);
  }

  async findUser(id: string) {
    this.logger.log(`finding user ${id}`);
    return this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
  }
}

registry.register(Keys.UserService, new UserService());
```

**Important:** Use getters with `inject()`, not field initializers. Field initializers run during `new`, before the registry is attached. Getters are evaluated lazily — the registry will be available by the time the property is accessed. This mirrors Swift's `@Dependency` property wrapper behaviour.

## Defining Keys

Keys are lightweight identifiers that pair a unique name with a type and an optional factory for lazy default resolution.

```typescript
// Minimal key (no default — must be registered)
const Key = new DependencyKey<MyType>("my.key");

// With lazy default factory
const Key = new DependencyKey<MyType>("my.key", () => new MyType());

// Static factory shorthand (recommended)
const Key = DependencyKey.named<MyType>("my.key");
const Key = DependencyKey.named<MyType>("my.key", () => new MyType());
```

The factory is called at most once, the first time `resolve()` is called and no explicit registration exists. The result is cached in the registry.

## DependencyRegistry

### Creating a Registry

```typescript
// Empty
const registry = new DependencyRegistry();

// With parent for chain-of-responsibility
const registry = new DependencyRegistry(parentRegistry);

// With builder DSL (recommended for app bootstrap)
const registry = DependencyRegistry.build((give) => {
  give(Keys.Logger, new ConsoleLogger());
  give(Keys.Database, new PostgresDatabase());
});

// With builder DSL and parent
const registry = DependencyRegistry.build((give) => {
  give(Keys.Logger, new ConsoleLogger());
}, parentRegistry);
```

### Registering Dependencies

```typescript
// By key + instance (explicit)
registry.register(Keys.Logger, new ConsoleLogger());

// KeyedDependency (self-keyed — no key argument needed)
registry.register(new EmailService());

// Builder callback
registry.register((give) => {
  give(Keys.Logger, new ConsoleLogger());
  give(new EmailService());
});

// Method chaining
registry
  .register(Keys.Logger, new ConsoleLogger())
  .register(Keys.Database, new PostgresDatabase());
```

### Resolving Dependencies

```typescript
const logger = registry.resolve(Keys.Logger);
logger.log("hello");

// With KeyedDependency, resolve by the key stored on the class:
const email = registry.resolve(EmailService.key);
email.send("user@example.com", "Welcome");
```

Resolution follows the chain-of-responsibility:
1. Check this registry's storage
2. If not found, delegate to the parent registry
3. If no parent and the key has a factory, call it and cache the result
4. Otherwise, throw

### Checking, Unregistering, Clearing

```typescript
registry.has(Keys.Logger);       // boolean
registry.unregister(Keys.Logger);
registry.clear();                 // removes all entries
```

### Fork

Creates a child registry that inherits all parent entries. Safe to mutate without affecting the parent — ideal for per-request scoping or integration tests.

```typescript
const testRegistry = appRegistry.fork();
testRegistry.register(Keys.Database, new MockDatabase());

appRegistry.resolve(Keys.Database);   // unchanged
testRegistry.resolve(Keys.Database);  // MockDatabase
```

## BaseDepends

Extend `BaseDepends` to give a class access to the dependency registry. The registry is automatically attached when the instance is registered via `DependencyRegistry.register()`.

### inject()

Use `inject()` in getters for lazy resolution:

```typescript
class MyService extends BaseDepends {
  private get logger() {
    return this.inject(Keys.Logger);
  }
}
```

### Lifecycle Hooks

```typescript
class MyService extends BaseDepends {
  protected setup(): void {
    // Called once when the registry is first attached.
    // Dependencies are available via inject().
    this.inject(Keys.Cache).set("warmed", true);
  }

  protected didAttach(): void {
    // Called after setup(), when this instance has been fully
    // registered in the DependencyRegistry.
  }
}
```

### Standalone inject() Utility

Works on any `DependsProvider`:

```typescript
import { inject } from "@nowarelabs/depends";

class ConfigService extends BaseDepends {
  get cfg(): string {
    return inject(this, DependencyKey.named<string>("config", () => "default"));
  }
}
```

## KeyedDependency

Dependencies that carry their own key. This mirrors the Swift `KeyedDependency` protocol and lets you register without passing an explicit key.

```typescript
import type { KeyedDependency } from "@nowarelabs/depends";

class EmailService extends BaseDepends implements KeyedDependency<EmailService> {
  static readonly key = DependencyKey.named<EmailService>("email.service");
  readonly dependencyKey = EmailService.key;

  send(to: string, subject: string): void { /* ... */ }
}

// Register without explicit key:
registry.register(new EmailService());

// Resolve by static key:
const email = registry.resolve(EmailService.key);
```

### Builder DSL with KeyedDependency

```typescript
DependencyRegistry.build((give) => {
  give(Keys.Logger, new ConsoleLogger());  // explicit key
  give(new EmailService());                // keyed — key inferred
  give(new SmsService());                  // keyed — key inferred
});
```

## Parent Registry (Scoping)

Child registries delegate unresolved lookups to their parent. This enables layered scoping — for example, an application-level registry with per-request overrides.

```typescript
const appRegistry = new DependencyRegistry();
appRegistry.register(Keys.Database, new PostgresDatabase());
appRegistry.register(Keys.Logger, new ConsoleLogger());

// Request-scoped override:
const reqRegistry = new DependencyRegistry(appRegistry);
reqRegistry.register(Keys.Logger, new RequestScopedLogger());

reqRegistry.resolve(Keys.Logger);   // RequestScopedLogger (from child)
reqRegistry.resolve(Keys.Database); // PostgresDatabase (from parent)
appRegistry.resolve(Keys.Logger);   // ConsoleLogger (unaffected)
```

## Usage with Standard Gauge Layers

Because `BaseDepends` is independent of the request/context types, it composes naturally with any layer:

```typescript
class AuthController extends BaseController {
  private get auth() {
    return this.inject(Keys.Auth);
  }

  async handle() {
    const user = await this.auth.authenticate(this.request);
    return this.json(user);
  }
}
```

The registry is typically bootstrapped at the application entry point and passed through the layer hierarchy or stored in the execution context.

## API Reference

### DependencyKey\<T\>

| Member | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(name: string, factory?: () => T)` | Create a key |
| `static named` | `(name: string, factory?: () => T): DependencyKey<T>` | Create a key (shorthand) |
| `name` | `string` | Unique identifier |
| `factory` | `(() => T) \| undefined` | Optional lazy default |

### DependencyRegistry

| Method | Returns | Description |
|--------|---------|-------------|
| `constructor(parent?)` | — | Create registry, optionally with parent |
| `static build(builder, parent?)` | `DependencyRegistry` | Create via DSL callback |
| `register(key, instance)` | `this` | Register by key |
| `register(instance)` | `this` | Register a KeyedDependency |
| `register(builder)` | `this` | Register via DSL callback |
| `resolve(key)` | `T` | Resolve by key (chain-of-responsibility) |
| `unregister(key)` | `void` | Remove a registration |
| `clear()` | `void` | Remove all registrations |
| `has(key)` | `boolean` | Check if key is registered |
| `fork()` | `DependencyRegistry` | Create child registry |

### BaseDepends (abstract)

| Member | Signature | Description |
|--------|-----------|-------------|
| `dependencies` | `DependencyRegistry` | The attached registry (falls back to empty) |
| `setDependencyRegistry` | `(registry) => void` | Called by registry on registration |
| `inject(key)` | `T` | Resolve a dependency |
| `setup()` | `void` | Lifecycle hook (override) |
| `didAttach()` | `void` | Lifecycle hook (override) |

### KeyedDependency\<T\>

| Member | Signature | Description |
|--------|-----------|-------------|
| `dependencyKey` | `DependencyKey<T>` | The key associated with this instance |

### Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `provide(key, instance)` | `{ key, instance }` | Create a key/instance pair |
| `inject(target, key)` | `T` | Resolve from any DependsProvider |
| `toKeyed(instance)` | `AnyKeyedDependency` | Type-erase a KeyedDependency |

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
