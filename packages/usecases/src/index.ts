/**
 * noware-usecases - Base Use Case Implementation
 *
 * Based on Alistair Cockburn's Goal-Based Model:
 * - Ports define WHAT the system can do (the contract)
 * - Use Cases define HOW the system does it (the logic)
 * - Every goal has two outcomes: Delivered (success) or Abandoned (failure)
 */

import type {
  UseCaseResult,
  HookOptions,
  EnvLike,
  ContextLike,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

/**
 * Helper to create a successful result
 */
export function delivered<T>(data: T): UseCaseResult<T> {
  return {
    success: true,
    data,
    status: "delivered",
  };
}

/**
 * Helper to create a failed result
 */
export function abandoned<T = never>(error: Error | string): UseCaseResult<T> {
  return {
    success: false,
    error: typeof error === "string" ? new Error(error) : error,
    status: "abandoned",
  };
}

// ============================================================================
// BaseUseCase - The Implementation (The Plug)
// ============================================================================

/**
 * BaseUseCase: Implements a port with business logic
 *
 * Convention: One use case per user goal (Sea-Level)
 * Responsibility: The "Main Success Scenario" and "Extensions" (failure paths)
 *
 * Based on Cockburn's model:
 * - execute() is the lifecycle manager
 * - perform() is where developers write business logic
 * - Sub-interactions use other UseCases via execute()
 *
 * @template TInput - What the goal needs
 * @template TOutput - What the goal produces
 */
export abstract class BaseUseCase<
  TInput = unknown,
  TOutput = unknown,
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected env?: Env;
  protected ctx?: Ctx;
  protected metadata: Record<string, unknown> = {};
  public input?: TInput;

  constructor(env?: Env, ctx?: Ctx) {
    this.env = env;
    this.ctx = ctx;
  }

  // ============================================================================
  // Hook Registration
  // ============================================================================

  static before<T extends BaseUseCase>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseUseCase>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseUseCase>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  static skipBefore<T extends BaseUseCase>(fn: HookFunction<T>): void {
    this.beforeHooks = this.beforeHooks.filter((h) => h.fn !== fn);
  }

  static skipAfter<T extends BaseUseCase>(fn: AfterHookFunction<T>): void {
    this.afterHooks = this.afterHooks.filter((h) => h.fn !== fn);
  }

  static skipAround<T extends BaseUseCase>(fn: AroundHookFunction<T>): void {
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

    const constructor = this.constructor as typeof BaseUseCase;
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

    const constructor = this.constructor as typeof BaseUseCase;
    for (const { fn, options } of constructor.afterHooks) {
      if (!this.shouldRunHook(options)) continue;
      const hookResult = await (fn as AfterHookFunction)(this, currentResult);
      if (hookResult !== undefined && hookResult !== null) currentResult = hookResult as R;
    }
    return currentResult;
  }

  protected async runAroundHooks<R = any>(action: () => Promise<R>): Promise<R> {
    const constructor = this.constructor as typeof BaseUseCase;
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
  // The Main Entry Point - Cockburn's Goal Lifecycle
  // ============================================================================

  async execute(input: TInput): Promise<UseCaseResult<TOutput>> {
    this.input = input;
    try {
      const beforeResult = await this.runBeforeHooks<UseCaseResult<TOutput>>();
      if (beforeResult) return beforeResult;

      const result = await this.runAroundHooks(async () => {
        try {
          await this.validate(input);
          const data = await this.perform(input);
          return delivered(data);
        } catch (error) {
          return this.handleGoalAbandonment(error, input);
        }
      });

      return await this.runAfterHooks(result);
    } catch (error) {
      return abandoned(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ============================================================================
  // The Developer's Playground - Override This
  // ============================================================================

  protected abstract perform(input: TInput): Promise<TOutput>;

  // ============================================================================
  // Extension Points
  // ============================================================================

  protected handleGoalAbandonment(error: unknown, _input: TInput): UseCaseResult<TOutput> {
    const err = error instanceof Error ? error : new Error(String(error));
    return abandoned(err);
  }

  protected async validate(_input: TInput): Promise<void> {
    // Override in subclasses
  }

  // ============================================================================
  // Sub-Interaction Helpers - For Recursive Use Cases
  // ============================================================================

  protected async subInteraction<TSubInput, TSubOutput>(
    subUseCase: BaseUseCase<TSubInput, TSubOutput>,
    input: TSubInput,
  ): Promise<TSubOutput> {
    const result = await subUseCase.execute(input);

    if (!result.success) {
      throw new SubGoalAbandonedError(`Sub-goal failed: ${result.error.message}`, result.error);
    }

    return result.data;
  }

  protected async trySubInteraction<TSubInput, TSubOutput>(
    subUseCase: BaseUseCase<TSubInput, TSubOutput>,
    input: TSubInput,
  ): Promise<UseCaseResult<TSubOutput>> {
    return subUseCase.execute(input);
  }

  // ============================================================================
  // Infrastructure Helpers
  // ============================================================================

  protected getEnv<T = unknown>(key: string, defaultValue?: T): T | undefined {
    if (!this.env) return defaultValue;
    const value = this.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected waitUntil(promise: Promise<unknown>): void {
    if (this.ctx) {
      this.ctx.waitUntil(promise);
    }
  }

  protected setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  protected getMetadata<T = unknown>(key: string): T | undefined {
    return this.metadata[key] as T;
  }
}

// ============================================================================
// Custom Errors
// ============================================================================

export class SubGoalAbandonedError extends Error {
  constructor(
    message: string,
    public readonly cause: Error,
  ) {
    super(message);
    this.name = "SubGoalAbandonedError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(
    public readonly resource: string,
    public readonly id?: string,
  ) {
    super(id ? `${resource} with id ${id} not found` : `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class BusinessRuleError extends Error {
  constructor(
    message: string,
    public readonly rule: string,
  ) {
    super(message);
    this.name = "BusinessRuleError";
  }
}
