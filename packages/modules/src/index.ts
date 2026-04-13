/**
 * nomo/modules - BaseModule, autoloading, and dependency registry
 * 
 * Standard Gauge: BaseModule registers FeatureHandlers and manages their lifecycle
 * 
 * Connection Flow:
 * BaseContext → BaseModule → BaseFeatureHandler
 */

import { BaseFeatureHandler, FeatureInput, FeatureOutput } from "nomo/features";

/* ============================================================================
 * Types
 * ============================================================================ */

export type ModuleMiddleware = {
  name: string;
  beforeLoad?: () => Promise<void> | void;
  afterLoad?: () => Promise<void> | void;
  beforeUnload?: () => Promise<void> | void;
  afterUnload?: () => Promise<void> | void;
};

/* ============================================================================
 * BaseModule
 * ============================================================================ */

/**
 * BaseModule - Autoloading and dependency registry
 * 
 * Connection: This layer → BaseFeatureHandler (multiple allowed)
 */
export class BaseModule {
  protected features: Map<string, new (...args: any[]) => BaseFeatureHandler<any, any>> = new Map();
  protected featureInstances: Map<string, BaseFeatureHandler<any, any>> = new Map();
  protected plugins: Map<string, unknown> = new Map();
  protected env: unknown;
  protected moduleName: string;

  // Static plugin points
  static onLoads: Array<(module: BaseModule) => Promise<void>> = [];
  static onUnloads: Array<(module: BaseModule) => Promise<void>> = [];
  static autoDiscovers: string[] = [];
  static middlewares: ModuleMiddleware[] = [];

  constructor(env?: unknown, moduleName?: string) {
    this.env = env;
    this.moduleName = moduleName || this.constructor.name;
  }

  /* -------------------------------------------------------------------------
   * Feature Registration
   * ------------------------------------------------------------------------- */

  /**
   * Register a FeatureHandler
   */
  registerFeature<T extends BaseFeatureHandler<any, any>>(
    name: string,
    Handler: new (...args: any[]) => T
  ): void {
    this.features.set(name, Handler);
  }

  /**
   * Get registered feature names
   */
  getFeatureNames(): string[] {
    return Array.from(this.features.keys());
  }

  /**
   * Get a feature by name
   */
  hasFeature(name: string): boolean {
    return this.features.has(name);
  }

  /* -------------------------------------------------------------------------
   * Feature Instance Management
   * ------------------------------------------------------------------------- */

  /**
   * Get or create a feature instance
   */
  getFeature<T extends BaseFeatureHandler<any, any>>(name: string, input: any): T | undefined {
    const FeatureClass = this.features.get(name);
    if (!FeatureClass) return undefined;

    // Check cached instance
    const cached = this.featureInstances.get(name);
    if (cached) return cached as T;

    // Create new instance
    const instance = new FeatureClass(input, this.env);
    this.featureInstances.set(name, instance);
    return instance as T;
  }

  /**
   * Clear feature instance cache
   */
  clearFeatureInstances(): void {
    this.featureInstances.clear();
  }

  /* -------------------------------------------------------------------------
   * Plugin Registration
   * ------------------------------------------------------------------------- */

  /**
   * Register a plugin
   */
  registerPlugin<T>(name: string, plugin: T): void {
    this.plugins.set(name, plugin);
  }

  /**
   * Get a plugin
   */
  getPlugin<T>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  /**
   * Load the module - register features and plugins
   */
  async onLoad(): Promise<void> {
    // Run middlewares
    for (const middleware of (this.constructor as typeof BaseModule).middlewares) {
      await middleware.beforeLoad?.();
    }

    // Run static hooks
    for (const hook of (this.constructor as typeof BaseModule).onLoads) {
      await hook(this);
    }
  }

  /**
   * Unload the module - cleanup
   */
  async onUnload(): Promise<void> {
    // Clear feature instances
    this.clearFeatureInstances();

    // Run static hooks
    for (const hook of (this.constructor as typeof BaseModule).onUnloads) {
      await hook(this);
    }

    // Run middlewares
    for (const middleware of (this.constructor as typeof BaseModule).middlewares) {
      await middleware.afterUnload?.();
    }
  }

  /* -------------------------------------------------------------------------
   * Auto-discovery
   * ------------------------------------------------------------------------- */

  /**
   * Auto-discover features from a directory
   * (can be implemented with file system scanning)
   */
  async autoDiscover(): Promise<void> {
    const autoDiscoverPaths = (this.constructor as typeof BaseModule).autoDiscovers;
    // Implementation depends on filesystem access
    // This is typically called at build time
  }

  /* -------------------------------------------------------------------------
   * Get module info
   * ------------------------------------------------------------------------- */

  getName(): string {
    return this.moduleName;
  }

  getFeatureCount(): number {
    return this.features.size;
  }

  getPluginCount(): number {
    return this.plugins.size;
  }
}

/* ============================================================================
 * Export
 * ============================================================================ */

export { BaseModule, type ModuleMiddleware };