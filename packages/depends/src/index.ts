/**
 * @nowarelabs/depends - Dependency Injection for Standard Gauge
 *
 * A predictable, registry-based dependency injection system for Standard Gauge.
 * Combines convention-driven wiring with typed keys and a natural DSL.
 *
 * Core Concepts:
 * - DependencyKey<T>: A typed key with optional default factory
 * - DependencyRegistry: Central registry with chain-of-responsibility
 * - DependsProvider: Interface for DI-capable classes
 * - BaseDepends: Abstract base class with inject() helper
 * - KeyedDependency: A dependency that declares its own key
 * - DependsBuilder: DSL for clean registration
 *
 * Standard Gauge Position: Cross-cutting (used by all layers)
 */

// ============================================================================
// DependencyKey
// ============================================================================

export class DependencyKey<T> {
  readonly factory?: () => T;

  constructor(
    readonly name: string,
    factory?: () => T,
  ) {
    this.factory = factory;
  }

  static named<T>(name: string, factory?: () => T): DependencyKey<T> {
    return new DependencyKey(name, factory);
  }
}

// ============================================================================
// DependsProvider Interface
// ============================================================================

export interface DependsProvider {
  readonly dependencies: DependencyRegistry;
}

// ============================================================================
// BaseDepends
// ============================================================================

export abstract class BaseDepends implements DependsProvider {
  private _dependencies?: DependencyRegistry;

  get dependencies(): DependencyRegistry {
    if (!this._dependencies) {
      return new DependencyRegistry();
    }
    return this._dependencies;
  }

  setDependencyRegistry(registry: DependencyRegistry): void {
    if (this._dependencies === registry) return;
    const isNew = this._dependencies === undefined;
    this._dependencies = registry;
    if (isNew) {
      this.setup();
      this.didAttach();
    }
  }

  protected inject<T>(key: DependencyKey<T>): T {
    return this.dependencies.resolve(key);
  }

  protected setup(): void {
    // Override in subclasses for post-dependency configuration
  }

  protected didAttach(): void {
    // Override in subclasses for post-registration lifecycle
  }
}

// ============================================================================
// KeyedDependency
// ============================================================================

export interface KeyedDependency<T = unknown> {
  readonly dependencyKey: DependencyKey<T>;
}

export interface AnyKeyedDependency {
  readonly storageKey: string;
  readonly dependency: unknown;
}

export function toKeyed<T extends KeyedDependency<any>>(instance: T): AnyKeyedDependency {
  return {
    storageKey: instance.dependencyKey.name,
    dependency: instance,
  };
}

// ============================================================================
// GiveFn - The DSL callback signature
// ============================================================================

export type GiveFn = {
  <T>(key: DependencyKey<T>, instance: T): void;
  <T extends KeyedDependency<any>>(instance: T): void;
};

// ============================================================================
// DependsBuilder DSL
// ============================================================================

export class DependsBuilder {
  private entries: Array<{ key: DependencyKey<any>; instance: any }> = [];

  give<T>(key: DependencyKey<T>, instance: T): this;
  give<T extends KeyedDependency<any>>(instance: T): this;
  give<T>(keyOrInstance: DependencyKey<T> | T, instance?: T): this {
    if (instance !== undefined) {
      this.entries.push({ key: keyOrInstance as DependencyKey<T>, instance });
    } else {
      const keyed = keyOrInstance as unknown as KeyedDependency;
      this.entries.push({ key: keyed.dependencyKey, instance: keyed });
    }
    return this;
  }

  build(): Array<{ key: DependencyKey<any>; instance: any }> {
    return this.entries;
  }
}

// ============================================================================
// DependencyRegistry
// ============================================================================

export class DependencyRegistry {
  private storage = new Map<string, unknown>();
  private parent?: DependencyRegistry;

  constructor(parent?: DependencyRegistry) {
    this.parent = parent;
  }

  static build(builder: (give: GiveFn) => void, parent?: DependencyRegistry): DependencyRegistry {
    const registry = new DependencyRegistry(parent);
    const b = new DependsBuilder();

    const give: GiveFn = <T>(keyOrInstance: DependencyKey<T> | KeyedDependency, instance?: T) => {
      if (instance !== undefined) {
        b.give(keyOrInstance as DependencyKey<T>, instance);
      } else {
        b.give(keyOrInstance as KeyedDependency);
      }
    };

    builder(give);

    for (const { key, instance } of b.build()) {
      registry._register(key, instance);
    }
    return registry;
  }

  register<T>(key: DependencyKey<T>, instance: T): this;
  register<T extends KeyedDependency<any>>(instance: T): this;
  register(builder: (give: GiveFn) => void): this;
  register<T>(
    keyOrBuilderOrInstance: DependencyKey<T> | ((give: GiveFn) => void) | KeyedDependency,
    instance?: T,
  ): this {
    if (typeof keyOrBuilderOrInstance === "function") {
      const b = new DependsBuilder();

      const give: GiveFn = <T>(keyOrInstance: DependencyKey<T> | KeyedDependency, instance?: T) => {
        if (instance !== undefined) {
          b.give(keyOrInstance as DependencyKey<T>, instance);
        } else {
          b.give(keyOrInstance as KeyedDependency);
        }
      };

      keyOrBuilderOrInstance(give);

      for (const { key, instance: dep } of b.build()) {
        this._register(key, dep);
      }
      return this;
    }

    if (instance !== undefined) {
      this._register(keyOrBuilderOrInstance as DependencyKey<T>, instance);
    } else {
      const keyed = keyOrBuilderOrInstance as unknown as KeyedDependency;
      this._register(keyed.dependencyKey, keyed);
    }

    return this;
  }

  resolve<T>(key: DependencyKey<T>): T {
    if (this.storage.has(key.name)) {
      return this.storage.get(key.name) as T;
    }

    if (this.parent) {
      return this.parent.resolve(key);
    }

    if (key.factory) {
      const instance = key.factory();
      this._register(key, instance);
      return instance;
    }

    throw new Error(
      `Dependency not registered: ${key.name} ` +
        `(expected ${key.name} to be registered in this registry or a parent)`,
    );
  }

  unregister<T>(key: DependencyKey<T>): void {
    this.storage.delete(key.name);
  }

  clear(): void {
    this.storage.clear();
  }

  has<T>(key: DependencyKey<T>): boolean {
    if (this.storage.has(key.name)) return true;
    return this.parent?.has(key) ?? false;
  }

  fork(): DependencyRegistry {
    return new DependencyRegistry(this);
  }

  private _register<T>(key: DependencyKey<T>, instance: T): void {
    this.storage.set(key.name, instance);

    if (instance instanceof BaseDepends) {
      instance.setDependencyRegistry(this);
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

export function provide<T>(
  key: DependencyKey<T>,
  instance: T,
): { key: DependencyKey<T>; instance: T } {
  return { key, instance };
}

export function inject<T>(target: DependsProvider, key: DependencyKey<T>): T {
  return target.dependencies.resolve(key);
}

// ============================================================================
// DSL — 90 % Layer
// ============================================================================

/**
 * @nowarelabs/depends — Rails-inspired DI DSL
 *
 * A thin 90% layer over the primitives (DependencyKey, DependencyRegistry, BaseDepends).
 * No decorators, no decorator config, no reflection — just factories and naming conventions.
 *
 * @example
 * ```ts
 * // bootstrap
 * const registry = container({
 *   Logger:   () => new ConsoleLogger(),
 *   Database: () => new PostgresDatabase(env.DATABASE_URL),
 *   services: [EmailService, ReportService],
 * });
 *
 * // scoped override (per-request)
 * const req = registry.scope({
 *   Logger: () => new RequestScopedLogger(requestId),
 * });
 *
 * // test
 * const { resolve } = registry.fake({
 *   Database: () => new MockDatabase(),
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type ClassConstructor<T = any> = new () => T;
export type ContainerConfig = Record<string, (() => any) | ClassConstructor<any>[]>;
export type ResolveFn = <T>(source: DependencyKey<T> | ClassConstructor<T>) => T;

// ============================================================================
// Active Registry Context
// ============================================================================

let _activeRegistry: Registry | null = null;

// ============================================================================
// uses() — standalone, no this. needed
// ============================================================================

export function uses<T>(source: DependencyKey<T> | ClassConstructor<T>): T {
  if (!_activeRegistry) {
    throw new Error(
      `[depends] uses() can only be called while a Registry is active. ` +
        `Make sure your class is registered via container() or scope().`,
    );
  }
  return _activeRegistry.resolve(source);
}

// ============================================================================
// Registry
// ============================================================================

// ---- Bootstrap (not exported — use container()/scope()/fake()) ------------

/** Creates a Registry and runs its _configure with _activeRegistry set. */
function _bootstrap(config: ContainerConfig, parent?: Registry): Registry {
  const r = new Registry(parent);

  const prev = _activeRegistry;
  _activeRegistry = r;
  try {
    r._configure(config);
  } finally {
    _activeRegistry = prev;
  }

  return r;
}

export class Registry {
  private registry: DependencyRegistry;
  private classToKey = new Map<Function, DependencyKey<any>>();
  private parent: Registry | null;

  /** @internal */
  constructor(parent?: Registry) {
    this.parent = parent ?? null;
    this.registry = parent ? new DependencyRegistry(parent.registry) : new DependencyRegistry();
  }

  // ---- Bootstrap --------------------------------------------------------

  /** @internal */
  _configure(config: ContainerConfig): void {
    const constructors: ClassConstructor[] = [];

    for (const [name, value] of Object.entries(config)) {
      if (name === "services") {
        constructors.push(...(value as ClassConstructor[]));
        continue;
      }

      const factory = value as () => any;
      const key = DependencyKey.named<any>(name);
      this.registry.register(key, factory());
    }

    // pass 1 — register all keys so classToKey is populated before any constructor runs
    for (const Ctor of constructors) {
      const key = DependencyKey.named<any>(Ctor.name);
      this.classToKey.set(Ctor, key);
    }

    // pass 2 — construct and register instances
    for (const Ctor of constructors) {
      const key = this.classToKey.get(Ctor)!;
      const instance = new Ctor();
      this.registry.register(key, instance);
    }
  }

  // ---- Resolution -------------------------------------------------------

  resolve<T>(source: DependencyKey<T> | ClassConstructor<T>): T {
    if (source instanceof DependencyKey) {
      return this.registry.resolve(source as DependencyKey<T>);
    }

    const key = this.classToKey.get(source) ?? this.parent?._findKeyForClass(source);

    if (!key) {
      throw new Error(
        `[depends] Class ${source.name} is not registered in the container. ` +
          `Add it to container({ services: [...] }).`,
      );
    }

    return this.registry.resolve(key);
  }

  private _findKeyForClass(ctor: Function): DependencyKey<any> | undefined {
    return this.classToKey.get(ctor) ?? this.parent?._findKeyForClass(ctor);
  }

  // ---- Scoping & Testing ------------------------------------------------

  scope(config: ContainerConfig): Registry {
    return _bootstrap(config, this);
  }

  fake(config: ContainerConfig): { resolve: ResolveFn } {
    const scoped = _bootstrap(config, this);
    return { resolve: (source) => scoped.resolve(source) };
  }
}

// DependsOn is a Rails-flavoured alias for BaseDepends.
export abstract class DependsOn extends BaseDepends {}

export function container(config: ContainerConfig): Registry {
  return _bootstrap(config);
}
