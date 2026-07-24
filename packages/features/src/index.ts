/**
 * noware-features - Feature Orchestration Layer
 *
 * BaseFeature: The "Kite-Level" or "Summary Goal" Orchestrator
 *
 * Responsibility:
 * - Lifecycle management (validate → prepare → execute → finalize)
 * - Bridge between API/RPC (T1) and Business Logic (T2)
 * - Infrastructure-aware (knows about HTTP/RPC)
 * - Can orchestrate multiple Use Cases for complex workflows
 *
 * Position in Standard Gauge Flow:
 * Actor → RPC/API → BaseFeature → BaseUseCase → BaseService/BaseModel
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike,
  UseCaseResult,
  FeatureContext,
  HookOptions as FeatureHookOptions,
} from "@nowarelabs/shared";
import { Logger } from "@nowarelabs/telemetry";

export type { FeatureContext } from "@nowarelabs/shared";

// ============================================================================
// Core Types
// ============================================================================

// FeatureHookOptions is aliased from HookOptions in imports

export interface RegisteredFeatureHook<T = any> {
  fn: FeatureHookFunction<T>;
  options?: FeatureHookOptions;
}

export type FeatureHookFunction<T = any> = (
  feature: T,
  context: FeatureContext,
) => void | Promise<void>;

export type AfterFeatureHookFunction<T = any> = (
  feature: T,
  result: UseCaseResult<any>,
  context: FeatureContext,
) => void | Promise<void> | UseCaseResult<any> | Promise<UseCaseResult<any>>;

// ============================================================================
// BaseFeature - The Kite-Level Orchestrator
// ============================================================================

/**
 * BaseFeature: Orchestrates the complete lifecycle of a feature request
 *
 * Convention: One feature per "Summary Goal" (can coordinate multiple use cases)
 * Responsibility: Lifecycle hooks, validation, preparation, finalization
 *
 * The Standard Gauge Flow:
 * 1. validate() - Gate-keeping (schema validation, auth checks)
 * 2. prepare() - Data transformation, enrichment
 * 3. execute() - Call use case(s) - THE BUSINESS LOGIC
 * 4. finalize() - Cleanup, audit logs, notifications
 * 5. toResponse() - Convert result to API response
 *
 * @template TInput - What the feature receives from the API
 * @template TOutput - What the feature returns to the API
 * @template TContext - The execution context (env, ctx, request, etc.)
 *
 * @example
 * class PlaceOrderFeature extends BaseFeature<OrderInput, OrderOutput> {
 *   constructor(
 *     private placeOrder: PlaceOrderUseCase,
 *     private sendEmail: SendEmailUseCase
 *   ) {
 *     super();
 *   }
 *
 *   protected async execute(input: OrderInput, ctx: FeatureContext) {
 *     const result = await this.placeOrder.execute(input);
 *
 *     if (result.success) {
 *       // Optional: trigger side effects
 *       await this.sendEmail.execute({ to: input.email });
 *     }
 *
 *     return result;
 *   }
 * }
 */
export abstract class BaseFeature<
  TInput = unknown,
  TOutput = unknown,
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  // Class-level hooks (Rails-style)
  static beforeHooks: RegisteredFeatureHook[] = [];
  static afterHooks: Array<{
    fn: AfterFeatureHookFunction;
    options?: FeatureHookOptions;
  }> = [];

  protected logger!: Logger;

  // ============================================================================
  // The Main Entry Point - The Standard Gauge Lifecycle
  // ============================================================================

  /**
   * Handle the complete feature lifecycle
   * This is called by your RPC/API layer
   */
  async handle(input: TInput, context: FeatureContext<Ctx, Env, Request>): Promise<Response> {
    this.logger = new Logger(context.request as any, context.env as any, context.ctx as any, {
      service: this.constructor.name,
    });

    return this.logger.span(`${this.constructor.name}.handle`, async () => {
      this.logger.info("handle started");
      const start = performance.now();

      try {
        await this.runBeforeHooks(context);

        await this.logger.span("validate", async () => {
          await this.validate(input, context);
        });

        const preparedInput = await this.logger.span("prepare", async () => {
          return await this.prepare(input, context);
        });

        let result = await this.logger.span("execute", async () => {
          return await this.execute(preparedInput, context);
        });

        result = await this.runAfterHooks(result, context);

        await this.logger.span("finalize", async () => {
          await this.finalize(result, context);
        });

        const duration = performance.now() - start;
        this.logger.debug("handle completed");
        this.logger.counter(`${this.constructor.name}.handle.success`);
        this.logger.histogram(`${this.constructor.name}.handle.duration_ms`, duration);

        return this.toResponse(result, context);
      } catch (error) {
        const duration = performance.now() - start;
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error("handle failed", { duration_ms: duration }, err);
        this.logger.counter(`${this.constructor.name}.handle.error`);
        return this.handleError(error, context);
      }
    });
  }

  // ============================================================================
  // Lifecycle Hooks - Override These
  // ============================================================================

  /**
   * Validate input before processing
   *
   * This is the "Feature Gate" - use for:
   * - Schema validation (Zod, Yup, etc.)
   * - Authorization checks
   * - Rate limiting
   * - Input sanitization
   *
   * @throws Error if validation fails
   *
   * @example
   * protected async validate(input: OrderInput, ctx: FeatureContext) {
   *   const schema = z.object({
   *     items: z.array(z.object({ id: z.string(), qty: z.number() })),
   *     total: z.number().positive()
   *   });
   *
   *   schema.parse(input); // Throws if invalid
   * }
   */
  protected async validate(_input: TInput, _context: FeatureContext): Promise<void> {
    // Override in subclasses
  }

  /**
   * Prepare/transform input before execution
   *
   * Use for:
   * - Data enrichment (adding user info, timestamps, etc.)
   * - Format conversion
   * - Default value assignment
   * - Input normalization
   *
   * @example
   * protected async prepare(input: OrderInput, ctx: FeatureContext) {
   *   return {
   *     ...input,
   *     userId: await this.getCurrentUserId(ctx),
   *     timestamp: new Date(),
   *     source: 'web'
   *   };
   * }
   */
  protected async prepare(input: TInput, _context: FeatureContext): Promise<TInput> {
    return input;
  }

  /**
   * Execute the core business logic
   *
   * THIS IS WHERE YOU CALL YOUR USE CASE(S)
   *
   * Can orchestrate multiple use cases for complex workflows:
   * - Call use cases sequentially
   * - Handle their results
   * - Coordinate saga patterns
   *
   * @example
   * // Simple: Single use case
   * protected async execute(input: OrderInput, ctx: FeatureContext) {
   *   return await this.placeOrderUseCase.execute(input);
   * }
   *
   * @example
   * // Complex: Multiple use cases (orchestration)
   * protected async execute(input: OrderInput, ctx: FeatureContext) {
   *   // 1. Place the order
   *   const orderResult = await this.placeOrderUseCase.execute(input);
   *
   *   if (!orderResult.success) {
   *     return orderResult;
   *   }
   *
   *   // 2. Send confirmation email (fire and forget)
   *   ctx.ctx.waitUntil(
   *     this.sendEmailUseCase.execute({
   *       to: input.email,
   *       orderId: orderResult.data.id
   *     })
   *   );
   *
   *   // 3. Update analytics
   *   ctx.ctx.waitUntil(
   *     this.trackEventUseCase.execute({
   *       event: 'order_placed',
   *       data: orderResult.data
   *     })
   *   );
   *
   *   return orderResult;
   * }
   */
  protected abstract execute(
    input: TInput,
    context: FeatureContext,
  ): Promise<UseCaseResult<TOutput>>;

  /**
   * Finalize after execution
   *
   * Use for:
   * - Audit logging
   * - Cleanup
   * - Background job scheduling
   * - Cache invalidation
   * - Event publishing
   *
   * Note: This runs regardless of success/failure
   *
   * @example
   * protected async finalize(result: UseCaseResult<OrderOutput>, ctx: FeatureContext) {
   *   // Log the outcome
   *   await this.auditLog.write({
   *     feature: 'place_order',
   *     success: result.success,
   *     userId: ctx.metadata?.userId,
   *     timestamp: new Date()
   *   });
   *
   *   // Invalidate cache
   *   if (result.success) {
   *     await this.cache.invalidate(`user:${ctx.metadata?.userId}:orders`);
   *   }
   * }
   */
  protected async finalize(
    _result: UseCaseResult<TOutput>,
    _context: FeatureContext,
  ): Promise<void> {
    // Override in subclasses
  }

  /**
   * Convert UseCaseResult to API Response
   *
   * This is where you handle the "delivered" vs "abandoned" states
   * and translate them to HTTP status codes, JSON-RPC responses, etc.
   *
   * @example
   * protected toResponse(result: UseCaseResult<OrderOutput>, ctx: FeatureContext) {
   *   if (result.success) {
   *     return new Response(JSON.stringify({
   *       order_id: result.data.id,
   *       status: result.data.status,
   *       total: result.data.total
   *     }), {
   *       status: 201,
   *       headers: { 'content-type': 'application/json' }
   *     });
   *   }
   *
   *   return new Response(JSON.stringify({
   *     error: result.error.message,
   *     code: this.getErrorCode(result.error)
   *   }), {
   *     status: this.getErrorStatus(result.error),
   *     headers: { 'content-type': 'application/json' }
   *   });
   * }
   */
  protected abstract toResponse(result: UseCaseResult<TOutput>, context: FeatureContext): Response;

  /**
   * Handle catastrophic errors (outside use case flow)
   *
   * These are errors that happened in the lifecycle itself,
   * not business logic failures (those come through UseCaseResult)
   *
   * @example
   * protected handleError(error: unknown, ctx: FeatureContext) {
   *   console.error('Feature error:', error);
   *
   *   return new Response(JSON.stringify({
   *     error: 'Internal server error',
   *     message: error instanceof Error ? error.message : 'Unknown error'
   *   }), {
   *     status: 500,
   *     headers: { 'content-type': 'application/json' }
   *   });
   * }
   */
  protected abstract handleError(error: unknown, context: FeatureContext): Response;

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get environment variable from context
   */
  protected getEnv<T = unknown>(
    context: FeatureContext,
    key: string,
    defaultValue?: T,
  ): T | undefined {
    const value = context.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  /**
   * Schedule work after response
   */
  protected waitUntil(context: FeatureContext, promise: Promise<unknown>): void {
    context.ctx.waitUntil(promise);
  }

  /**
   * Get request metadata
   */
  protected getMetadata<T = unknown>(context: FeatureContext, key: string): T | undefined {
    return context.metadata?.[key] as T | undefined;
  }

  /**
   * Set request metadata
   */
  protected setMetadata(context: FeatureContext, key: string, value: unknown): void {
    if (!context.metadata) {
      context.metadata = {};
    }
    context.metadata[key] = value;
  }

  // ============================================================================
  // Hook Registration - Rails-style
  // ============================================================================

  /**
   * Register a before hook
   * Runs before validation
   *
   * @example
   * class OrderFeature extends BaseFeature {
   *   static {
   *     this.before(this.logRequest);
   *     this.before(this.checkRateLimit);
   *   }
   * }
   */
  static before<T extends BaseFeature>(
    fn: FeatureHookFunction<T>,
    options?: FeatureHookOptions,
  ): void {
    const ctor = this as any;
    if (!Object.hasOwn(ctor, "beforeHooks")) {
      ctor.beforeHooks = [...ctor.beforeHooks];
    }
    ctor.beforeHooks.push({ fn: fn as FeatureHookFunction, options });
  }

  /**
   * Register an after hook
   * Runs after execution, before finalize
   * Can transform the result
   *
   * @example
   * class OrderFeature extends BaseFeature {
   *   static {
   *     this.after(this.addResponseHeaders);
   *   }
   * }
   */
  static after<T extends BaseFeature>(
    fn: AfterFeatureHookFunction<T>,
    options?: FeatureHookOptions,
  ): void {
    const ctor = this as any;
    if (!Object.hasOwn(ctor, "afterHooks")) {
      ctor.afterHooks = [...ctor.afterHooks];
    }
    ctor.afterHooks.push({ fn: fn as AfterFeatureHookFunction, options });
  }

  /**
   * Skip a previously registered before hook
   */
  static skipBefore<T extends BaseFeature>(fn: FeatureHookFunction<T>): void {
    this.beforeHooks = this.beforeHooks.filter((h) => h.fn !== fn);
  }

  /**
   * Skip a previously registered after hook
   */
  static skipAfter<T extends BaseFeature>(fn: AfterFeatureHookFunction<T>): void {
    this.afterHooks = this.afterHooks.filter((h) => h.fn !== fn);
  }

  // ============================================================================
  // Hook Execution - Internal
  // ============================================================================

  private static collectHooks(ctor: object, prop: string): any[] {
    const hooks: any[] = [];
    let current: any = ctor;
    while (current && current !== Function.prototype) {
      if (Object.hasOwn(current, prop)) {
        hooks.unshift(...current[prop]);
      }
      current = Object.getPrototypeOf(current);
    }
    return hooks;
  }

  private async runBeforeHooks(context: FeatureContext): Promise<void> {
    const constructor = this.constructor;
    const hooks = BaseFeature.collectHooks(constructor, "beforeHooks");

    for (const { fn } of hooks) {
      await fn(this, context);
    }
  }

  private async runAfterHooks(
    result: UseCaseResult<TOutput>,
    context: FeatureContext,
  ): Promise<UseCaseResult<TOutput>> {
    const constructor = this.constructor;
    const hooks = BaseFeature.collectHooks(constructor, "afterHooks");
    let currentResult = result;

    for (const { fn } of hooks) {
      const hookResult = await fn(this, currentResult, context);

      // If hook returns a result, use it
      if (hookResult && typeof hookResult === "object" && "success" in hookResult) {
        currentResult = hookResult as UseCaseResult<TOutput>;
      }
    }

    return currentResult;
  }
}

// ============================================================================
// Common Response Helpers
// ============================================================================

/**
 * Helper class for building HTTP responses from features
 * Mix this in or extend it in your BaseFeature subclasses
 */
export class HttpResponseBuilder {
  protected json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
    });
  }

  protected html(content: string, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(content, {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...headers,
      },
    });
  }

  protected text(content: string, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(content, {
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...headers,
      },
    });
  }

  protected redirect(
    location: string,
    status = 302,
    headers: Record<string, string> = {},
  ): Response {
    return new Response(null, {
      status,
      headers: {
        location,
        ...headers,
      },
    });
  }

  protected noContent(headers: Record<string, string> = {}): Response {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  /**
   * Map common error types to HTTP status codes
   */
  protected getErrorStatus(error: Error): number {
    const errorName = error.constructor.name;

    const statusMap: Record<string, number> = {
      ValidationError: 400,
      NotFoundError: 404,
      UnauthorizedError: 401,
      ForbiddenError: 403,
      BusinessRuleError: 422,
      ConflictError: 409,
    };

    return statusMap[errorName] || 500;
  }

  /**
   * Map error types to error codes
   */
  protected getErrorCode(error: Error): string {
    const errorName = error.constructor.name;

    const codeMap: Record<string, string> = {
      ValidationError: "VALIDATION_ERROR",
      NotFoundError: "NOT_FOUND",
      UnauthorizedError: "UNAUTHORIZED",
      ForbiddenError: "FORBIDDEN",
      BusinessRuleError: "BUSINESS_RULE_VIOLATION",
      ConflictError: "CONFLICT",
    };

    return codeMap[errorName] || "INTERNAL_ERROR";
  }
}
