/**
 * noware-ports - Port Interfaces and Base Use Case
 *
 * Based on Alistair Cockburn's Goal-Based Model:
 * - Ports define WHAT the system can do (the contract)
 * - Use Cases define HOW the system does it (the logic)
 * - Every goal has two outcomes: Delivered (success) or Abandoned (failure)
 */

import type { UseCaseResult, HookOptions } from "@nowarelabs/shared";

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

// HookOptions imported from shared

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
 *
 * @example
 * class RegisterUserUseCase extends BaseUseCase<UserRegistration, UserAccount> {
 *   protected async perform(input: UserRegistration): Promise<UserAccount> {
 *     // Main Success Scenario here
 *     const user = await this.userRepo.create(input);
 *     return user;
 *   }
 * }
 */
export abstract class BaseUseCase<TInput = unknown, TOutput = unknown> {
  // Hooks for observability and cross-cutting concerns
  static beforeHooks: Array<{
    fn: (useCase: any, input: any) => void | Promise<void>;
    options?: HookOptions;
  }> = [];

  static afterHooks: Array<{
    fn: (useCase: any, result: UseCaseResult<any>) => void | Promise<void>;
    options?: HookOptions;
  }> = [];

  static aroundHooks: Array<{
    fn: (
      useCase: any,
      input: any,
      next: () => Promise<UseCaseResult<any>>,
    ) => Promise<UseCaseResult<any>>;
    options?: HookOptions;
  }> = [];

  // ============================================================================
  // The Main Entry Point - Cockburn's Goal Lifecycle
  // ============================================================================

  /**
   * Execute the goal with full lifecycle management
   *
   * This handles:
   * 1. Before hooks (logging, validation setup, etc.)
   * 2. The main success scenario (perform)
   * 3. Exception handling (goal abandonment)
   * 4. After hooks (cleanup, notifications, etc.)
   */
  async execute(input: TInput): Promise<UseCaseResult<TOutput>> {
    try {
      // Run before hooks
      await this.runBeforeHooks(input);

      // Run the main flow through around hooks
      const result = await this.runAroundHooks(input, async () => {
        try {
          // THE MAIN SUCCESS SCENARIO
          const data = await this.perform(input);

          // Goal Delivered
          return delivered(data);
        } catch (error) {
          // Goal Abandoned
          return this.handleGoalAbandonment(error, input);
        }
      });

      // Run after hooks
      await this.runAfterHooks(result);

      return result;
    } catch (error) {
      // Catastrophic failure
      return abandoned(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ============================================================================
  // The Developer's Playground - Override This
  // ============================================================================

  /**
   * The Main Success Scenario
   *
   * This is where developers write their business logic.
   * Should contain ONLY the happy path.
   *
   * @throws Error to abandon the goal (triggers handleGoalAbandonment)
   */
  protected abstract perform(input: TInput): Promise<TOutput>;

  // ============================================================================
  // Extension Points
  // ============================================================================

  /**
   * Handle goal abandonment (Cockburn's "Extensions")
   *
   * Override this to customize how different failures are handled
   *
   * @example
   * protected handleGoalAbandonment(error: unknown, input: TInput) {
   *   if (error instanceof ValidationError) {
   *     return abandoned(new Error(`Invalid data: ${error.message}`));
   *   }
   *   if (error instanceof NotFoundError) {
   *     return abandoned(new Error("Resource not found"));
   *   }
   *   return super.handleGoalAbandonment(error, input);
   * }
   */
  protected handleGoalAbandonment(error: unknown, input: TInput): UseCaseResult<TOutput> {
    const err = error instanceof Error ? error : new Error(String(error));

    return abandoned(err);
  }

  /**
   * Validate input before performing the use case
   * Override this for precondition checks
   *
   * @throws Error if validation fails
   */
  protected async validate(input: TInput): Promise<void> {
    // Override in subclasses
  }

  // ============================================================================
  // Sub-Interaction Helpers - For Recursive Use Cases
  // ============================================================================

  /**
   * Execute a sub-use case and handle its result
   *
   * This is for when one use case calls another (subfunction level)
   * Follows Cockburn's recursive model
   *
   * @example
   * const paymentResult = await this.subInteraction(
   *   this.processPayment,
   *   { amount: 100 }
   * );
   * // paymentResult is unwrapped on success, throws on failure
   */
  protected async subInteraction<TSubInput, TSubOutput>(
    subUseCase: BaseUseCase<TSubInput, TSubOutput>,
    input: TSubInput,
  ): Promise<TSubOutput> {
    const result = await subUseCase.execute(input);

    if (!result.success) {
      // Goal abandoned at sub-level, propagate to parent
      throw new SubGoalAbandonedError(`Sub-goal failed: ${result.error.message}`, result.error);
    }

    return result.data;
  }

  /**
   * Execute a sub-use case and get the raw result
   * Use this when you want to handle the failure yourself (pivot/retry)
   *
   * @example
   * const result = await this.trySubInteraction(this.processPayment, data);
   * if (!result.success) {
   *   // Try alternative payment method
   *   return this.tryAlternativePayment(data);
   * }
   */
  protected async trySubInteraction<TSubInput, TSubOutput>(
    subUseCase: BaseUseCase<TSubInput, TSubOutput>,
    input: TSubInput,
  ): Promise<UseCaseResult<TSubOutput>> {
    return subUseCase.execute(input);
  }

  // ============================================================================
  // Hook Registration - Rails-style
  // ============================================================================

  static beforeExecute<T extends BaseUseCase>(
    fn: (useCase: T, input: any) => void | Promise<void>,
    options?: HookOptions,
  ): void {
    this.beforeHooks.push({ fn: fn as any, options });
  }

  static afterExecute<T extends BaseUseCase>(
    fn: (useCase: T, result: UseCaseResult<any>) => void | Promise<void>,
    options?: HookOptions,
  ): void {
    this.afterHooks.push({ fn: fn as any, options });
  }

  static aroundExecute<T extends BaseUseCase>(
    fn: (
      useCase: T,
      input: any,
      next: () => Promise<UseCaseResult<any>>,
    ) => Promise<UseCaseResult<any>>,
    options?: HookOptions,
  ): void {
    this.aroundHooks.push({ fn: fn as any, options });
  }

  // ============================================================================
  // Hook Execution - Internal
  // ============================================================================

  private async runBeforeHooks(input: TInput): Promise<void> {
    const constructor = this.constructor as typeof BaseUseCase;

    for (const { fn } of constructor.beforeHooks) {
      await fn(this, input);
    }
  }

  private async runAfterHooks(result: UseCaseResult<TOutput>): Promise<void> {
    const constructor = this.constructor as typeof BaseUseCase;

    for (const { fn } of constructor.afterHooks) {
      await fn(this, result);
    }
  }

  private async runAroundHooks(
    input: TInput,
    action: () => Promise<UseCaseResult<TOutput>>,
  ): Promise<UseCaseResult<TOutput>> {
    const constructor = this.constructor as typeof BaseUseCase;
    const hooks = constructor.aroundHooks;

    if (hooks.length === 0) {
      return action();
    }

    let index = 0;
    const next = async (): Promise<UseCaseResult<TOutput>> => {
      if (index >= hooks.length) {
        return action();
      }

      const { fn } = hooks[index++];
      return fn(this, input, next);
    };

    return next();
  }
}

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Thrown when a sub-goal is abandoned
 * Helps track the chain of failures in recursive use cases
 */
export class SubGoalAbandonedError extends Error {
  constructor(
    message: string,
    public readonly cause: Error,
  ) {
    super(message);
    this.name = "SubGoalAbandonedError";
  }
}

/**
 * Thrown when validation fails
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Thrown when a resource is not found
 */
export class NotFoundError extends Error {
  constructor(
    public readonly resource: string,
    public readonly id?: string,
  ) {
    super(id ? `${resource} with id ${id} not found` : `${resource} not found`);
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when an operation is not authorized
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown when a business rule is violated
 */
export class BusinessRuleError extends Error {
  constructor(
    message: string,
    public readonly rule: string,
  ) {
    super(message);
    this.name = "BusinessRuleError";
  }
}
