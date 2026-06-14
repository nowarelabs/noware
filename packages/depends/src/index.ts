/**
 * @nowarelabs/depends - Dependency Injection for Standard Gauge
 *
 * A predictable, registry-based dependency injection system.
 * Combines service locator with typed keys and a natural DSL.
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
