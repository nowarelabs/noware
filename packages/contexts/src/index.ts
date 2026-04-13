/**
 * nomo/contexts - BaseContext, bounded context container
 * 
 * Standard Gauge: BaseContext hosts multiple BaseModules
 * 
 * Connection Flow:
 * BaseContext → BaseModule → BaseFeatureHandler
 */

import { BaseModule } from "nomo/modules";

/* ============================================================================
 * Types
 * ============================================================================ */

export type ContextConfig = Record<string, unknown>;

/* ============================================================================
 * BaseContext
 * ============================================================================ */

/**
 * BaseContext - The Bounded Context "Container"
 * 
 * Connection: This layer → BaseModule (multiple allowed)
 */
export class BaseContext {
  protected modules: Map<string, BaseModule> = new Map();
  protected config: ContextConfig;
  protected env: unknown;
  protected contextName: string;

  // Static plugin points
  static onSetups: Array<(ctx: BaseContext) => Promise<void>> = [];
  static onTeardowns: Array<(ctx: BaseContext) => Promise<void>> = [];
  static contextConfigs: Record<string, ContextConfig> = {};

  constructor(config: ContextConfig = {}, env?: unknown) {
    this.config = config;
    this.env = env;
    this.contextName = this.constructor.name.replace("Context", "");
  }

  /* -------------------------------------------------------------------------
   * Module Management
   * ------------------------------------------------------------------------- */

  /**
   * Load a module
   */
  async loadModule(name: string, module: BaseModule): Promise<void> {
    await module.onLoad();
    this.modules.set(name, module);
  }

  /**
   * Unload a module
   */
  async unloadModule(name: string): Promise<void> {
    const module = this.modules.get(name);
    if (module) {
      await module.onUnload();
      this.modules.delete(name);
    }
  }

  /**
   * Get a module
   */
  getModule<T extends BaseModule>(name: string): T | undefined {
    return this.modules.get(name) as T | undefined;
  }

  /**
   * Get all module names
   */
  getModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }

  /* -------------------------------------------------------------------------
   * Config
   * ------------------------------------------------------------------------- */

  getConfig(key: string, fallback?: unknown): unknown {
    return this.config[key] ?? fallback;
  }

  setConfig(key: string, value: unknown): void {
    this.config[key] = value;
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  /**
   * Setup the context - initialize modules
   */
  async onSetup(): Promise<void> {
    // Run static hooks
    for (const hook of (this.constructor as typeof BaseContext).onSetups) {
      await hook(this);
    }
  }

  /**
   * Teardown the context - cleanup modules
   */
  async onTeardown(): Promise<void> {
    // Unload all modules
    for (const name of this.getModuleNames()) {
      await this.unloadModule(name);
    }

    // Run static hooks
    for (const hook of (this.constructor as typeof BaseContext).onTeardowns) {
      await hook(this);
    }
  }

  /* -------------------------------------------------------------------------
   * Info
   * ------------------------------------------------------------------------- */

  getName(): string {
    return this.contextName;
  }

  getModuleCount(): number {
    return this.modules.size;
  }
}

/* ============================================================================
 * Export
 * ============================================================================ */

export { BaseContext, type ContextConfig };