/**
 * ports
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike,
  UseCaseResult,
  HookOptions,
  Port,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export abstract class BasePort<
  TInput = unknown,
  TOutput = unknown,
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> implements Port<TInput, TOutput> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected env: Env;
  protected ctx: Ctx;
  protected request: Request;
  protected metadata: Record<string, unknown> = {};

  constructor(request: Request, env: Env, ctx: Ctx) {
    this.request = request;
    this.env = env;
    this.ctx = ctx;
  }

  // ============================================================================
  // Hook Registration
  // ============================================================================

  static before<T extends BasePort>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BasePort>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BasePort>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  static skipBefore<T extends BasePort>(fn: HookFunction<T>): void {
    this.beforeHooks = this.beforeHooks.filter((h) => h.fn !== fn);
  }

  static skipAfter<T extends BasePort>(fn: AfterHookFunction<T>): void {
    this.afterHooks = this.afterHooks.filter((h) => h.fn !== fn);
  }

  static skipAround<T extends BasePort>(fn: AroundHookFunction<T>): void {
    this.aroundHooks = this.aroundHooks.filter((h) => h.fn !== fn);
  }

  // ============================================================================
  // Hook Execution
  // ============================================================================

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }

  protected async beforeExecute(): Promise<UseCaseResult<TOutput> | void> {
    // Convention: override in subclasses
  }

  protected async afterExecute(_result: any): Promise<any> {
    // Convention: override in subclasses
  }

  protected async runBeforeHooks<R = any>(): Promise<R | null> {
    const instanceResult = await this.beforeExecute();
    if (instanceResult) return instanceResult as R;

    const constructor = this.constructor as typeof BasePort;
    for (const { fn, options } of constructor.beforeHooks) {
      if (!this.shouldRunHook(options)) continue;
      const result = await (fn as HookFunction)(this);
      if (result !== undefined && result !== null) return result as R;
    }
    return null;
  }

  protected async runAfterHooks<R = any>(result: R): Promise<R> {
    let currentResult = result;
    const instanceResult = await this.afterExecute(currentResult as any);
    if (instanceResult) currentResult = instanceResult as any;

    const constructor = this.constructor as typeof BasePort;
    for (const { fn, options } of constructor.afterHooks) {
      if (!this.shouldRunHook(options)) continue;
      const hookResult = await (fn as AfterHookFunction)(this, currentResult);
      if (hookResult !== undefined && hookResult !== null) currentResult = hookResult as R;
    }
    return currentResult;
  }

  protected async runAroundHooks<R = any>(action: () => Promise<R>): Promise<R> {
    const constructor = this.constructor as typeof BasePort;
    const applicableHooks = constructor.aroundHooks.filter(({ options }) =>
      this.shouldRunHook(options),
    );

    if (applicableHooks.length === 0) return action();

    let index = 0;
    const next = async (): Promise<R> => {
      if (index >= applicableHooks.length) return action();
      const { fn } = applicableHooks[index++];
      return (fn as AroundHookFunction)(this, next);
    };

    return next();
  }

  // ============================================================================
  // Core Execution
  // ============================================================================

  /**
   * Implementation of the port's goal
   */
  protected abstract handleExecute(input: TInput): Promise<UseCaseResult<TOutput>>;

  /**
   * Standard lifecycle for port execution
   */
  async execute(input: TInput): Promise<UseCaseResult<TOutput>> {
    try {
      const beforeResult = await this.runBeforeHooks<UseCaseResult<TOutput>>();
      if (beforeResult) return beforeResult;

      const result = await this.runAroundHooks(async () => {
        return await this.handleExecute(input);
      });

      return await this.runAfterHooks(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected handleError(error: unknown): UseCaseResult<TOutput> {
    console.error(`Error in ${this.constructor.name}:`, error);
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err as any, status: "abandoned" };
  }

  // ============================================================================
  // Infrastructure Helpers
  // ============================================================================

  protected getEnv<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected waitUntil(promise: Promise<unknown>): void {
    this.ctx.waitUntil(promise);
  }

  protected setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  protected getMetadata<T = unknown>(key: string): T | undefined {
    return this.metadata[key] as T;
  }
}
