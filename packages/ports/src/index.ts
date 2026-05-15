// ============================================================================
// BasePort - The Interface/Contract (The Socket)
// ============================================================================

/**
 * BasePort: The contract that adapters interact with
 *
 * Convention: One port per user goal (Sea-Level)
 * Responsibility: Define the interface, not the implementation
 *
 * @template TInput - What the goal needs
 * @template TOutput - What the goal produces (on success)
 *
 * @example
 * interface RegisterUserPort extends BasePort<UserRegistration, UserAccount> {
 *   execute(input: UserRegistration): Promise<UseCaseResult<UserAccount>>;
 * }
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike,
  UseCaseResult,
  HookOptions,
  Port,
} from "@nowarelabs/shared";

export class BasePort<
  TInput = unknown,
  TOutput = unknown,
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> implements Port<TInput, TOutput> {
  // Hooks for cross-cutting concerns
  static beforeHooks: Array<{
    fn: (port: any) => void | Promise<void>;
    options?: HookOptions;
  }> = [];

  static afterHooks: Array<{
    fn: (port: any, result: UseCaseResult<any>) => void | Promise<void>;
    options?: HookOptions;
  }> = [];

  constructor(
    protected request: Request,
    protected env: Env,
    protected ctx: Ctx,
  ) {}

  /**
   * Execute the port's goal
   * This should be overridden by implementing classes
   */
  async execute(input: TInput): Promise<UseCaseResult<TOutput>> {
    throw new Error("execute() must be implemented by subclass");
  }

  // ============================================================================
  // Hook Registration
  // ============================================================================

  static before<T extends BasePort>(
    fn: (port: T) => void | Promise<void>,
    options?: HookOptions,
  ): void {
    this.beforeHooks.push({ fn: fn as any, options });
  }

  static after<T extends BasePort>(
    fn: (port: T, result: UseCaseResult<any>) => void | Promise<void>,
    options?: HookOptions,
  ): void {
    this.afterHooks.push({ fn: fn as any, options });
  }

  // Helper methods that ports can use
  protected getEnv<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected waitUntil(promise: Promise<unknown>): void {
    this.ctx.waitUntil(promise);
  }
}
