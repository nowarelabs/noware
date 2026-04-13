/**
 * nomo/plugins - BaseGlobalPlugin for aspect-oriented cross-cutting concerns
 * 
 * Standard Gauge: BaseGlobalPlugin intercepts ALL layers (global scope)
 */

export type PluginContext = Record<string, unknown>;

/* ============================================================================
 * BaseGlobalPlugin
 * ============================================================================ */

/**
 * BaseGlobalPlugin - Aspect-Oriented Concerns (All Contexts)
 * 
 * Connection: This layer → can intercept ALL layers (global)
 */
export class BaseGlobalPlugin {
  static readonly name: string;
  static readonly version: string;
  protected env: unknown;

  // Static plugin points - GLOBAL scope
  static onInits: Array<() => Promise<void>> = [];
  static onShutdowns: Array<() => Promise<void>> = [];
  static aroundFeatures: Array<(ctx: PluginContext, next: () => Promise<unknown>) => Promise<unknown>> = [];
  static aroundControllers: Array<(ctx: PluginContext, next: () => Promise<unknown>) => Promise<unknown>> = [];
  static aroundServices: Array<(ctx: PluginContext, next: () => Promise<unknown>) => Promise<unknown>> = [];
  static aroundModels: Array<(ctx: PluginContext, next: () => Promise<unknown>) => Promise<unknown>> = [];

  // Instance hooks
  beforeFeatureExecutes: Array<(ctx: PluginContext) => Promise<void>> = [];
  beforeControllerActions: Array<(ctx: PluginContext) => Promise<void>> = [];
  beforeServiceCalls: Array<(ctx: PluginContext) => Promise<void>> = [];
  beforeModelSaves: Array<(ctx: PluginContext) => Promise<void>> = [];

  afterFeatureExecutes: Array<(ctx: PluginContext, result: unknown) => Promise<void>> = [];
  afterControllerActions: Array<(ctx: PluginContext, result: unknown) => Promise<void>> = [];
  afterServiceCalls: Array<(ctx: PluginContext, result: unknown) => Promise<void>> = [];
  afterModelSaves: Array<(ctx: PluginContext, result: unknown) => Promise<void>> = [];

  constructor(env?: unknown) {
    this.env = env;
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  async onInit(): Promise<void> {
    for (const hook of (this.constructor as typeof BaseGlobalPlugin).onInits) {
      await hook();
    }
  }

  async onShutdown(): Promise<void> {
    for (const hook of (this.constructor as typeof BaseGlobalPlugin).onShutdowns) {
      await hook();
    }
  }

  /* -------------------------------------------------------------------------
   * Around Hooks (wrap execution)
   * ------------------------------------------------------------------------- */

  async aroundFeature(ctx: PluginContext, next: () => Promise<unknown>): Promise<unknown> {
    for (const hook of (this.constructor as typeof BaseGlobalPlugin).aroundFeatures) {
      return await hook(ctx, next);
    }
    return next();
  }

  async aroundController(ctx: PluginContext, next: () => Promise<unknown>): Promise<unknown> {
    for (const hook of (this.constructor as typeof BaseGlobalPlugin).aroundControllers) {
      return await hook(ctx, next);
    }
    return next();
  }

  async aroundService(ctx: PluginContext, next: () => Promise<unknown>): Promise<unknown> {
    for (const hook of (this.constructor as typeof BaseGlobalPlugin).aroundServices) {
      return await hook(ctx, next);
    }
    return next();
  }

  async aroundModel(ctx: PluginContext, next: () => Promise<unknown>): Promise<unknown> {
    for (const hook of (this.constructor as typeof BaseGlobalPlugin).aroundModels) {
      return await hook(ctx, next);
    }
    return next();
  }

  /* -------------------------------------------------------------------------
   * Before/After Hooks
   * ------------------------------------------------------------------------- */

  async beforeFeatureExecute(ctx: PluginContext): Promise<void> {
    for (const hook of this.beforeFeatureExecutes) {
      await hook(ctx);
    }
  }

  async afterFeatureExecute(ctx: PluginContext, result: unknown): Promise<void> {
    for (const hook of this.afterFeatureExecutes) {
      await hook(ctx, result);
    }
  }

  async beforeControllerAction(ctx: PluginContext): Promise<void> {
    for (const hook of this.beforeControllerActions) {
      await hook(ctx);
    }
  }

  async afterControllerAction(ctx: PluginContext, result: unknown): Promise<void> {
    for (const hook of this.afterControllerActions) {
      await hook(ctx, result);
    }
  }
}

/* ============================================================================
 * Plugin Registry
 * ============================================================================ */

export class PluginRegistry {
  private plugins: Map<string, BaseGlobalPlugin> = new Map();

  register(name: string, plugin: BaseGlobalPlugin): void {
    this.plugins.set(name, plugin);
  }

  get<T extends BaseGlobalPlugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  getAll(): BaseGlobalPlugin[] {
    return Array.from(this.plugins.values());
  }

  async initialize(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.onInit();
    }
  }

  async shutdown(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.onShutdown();
    }
  }
}
