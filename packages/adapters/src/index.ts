/**
 * adapters - Hexagonal Architecture Adapter Framework
 *
 * Convention: Adapters ONLY translate. Business logic lives in Ports.
 * Philosophy: Separation of concerns enforced by design, not documentation.
 */

import type { EnvLike, ContextLike, RequestLike, HookOptions, Port } from "@nowarelabs/shared";

type BodyInit =
  | string
  | ReadableStream
  | Blob
  | FormData
  | ArrayBufferView
  | ArrayBuffer
  | null
  | undefined;

// ============================================================================
// Core Types - The Hexagonal Standard
// ============================================================================

export interface AdapterRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  raw: RequestLike;
}

export interface AdapterResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface AdapterContext<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  env: Env;
  ctx: Ctx;
  request: AdapterRequest;
}

// Hook types
export type HookFunction<T = any> = (
  adapter: T,
) => void | Promise<void> | AdapterResponse | Promise<AdapterResponse>;

export type AfterHookFunction<T = any> = (
  adapter: T,
  response: AdapterResponse,
) => void | Promise<void> | AdapterResponse | Promise<AdapterResponse>;

export type AroundHookFunction<T = any> = (
  adapter: T,
  next: () => Promise<AdapterResponse>,
) => Promise<AdapterResponse>;

// Hook options are imported from shared

export interface RegisteredHook<T = any> {
  fn: HookFunction<T> | AfterHookFunction<T> | AroundHookFunction<T>;
  options?: HookOptions;
}

// ============================================================================
// DrivingAdapter - HTTP/CLI → Domain (Inbound)
// ============================================================================

/**
 * DrivingAdapter: Translates external requests into domain operations
 *
 * Convention: One adapter per use case or tight mapping
 * Responsibility: ONLY translation, NO business logic
 *
 * @template TInput - The domain input type (what your use case needs)
 * @template TOutput - The domain output type (what your use case returns)
 * @template TPort - The port interface this adapter drives
 */
export abstract class DrivingAdapter<
  TInput = unknown,
  TOutput = unknown,
  TPort extends Port<TInput, TOutput> = Port<TInput, TOutput>,
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  // Class-level hooks (Rails-style)
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  // The Port - injected, not implemented here
  protected port: TPort;

  // Context available to adapters
  protected context: AdapterContext<Ctx, Env>;
  protected request: AdapterRequest;
  protected params: Record<string, string>;
  protected query: Record<string, string>;
  protected headers: Record<string, string>;

  constructor(port: TPort, request: RequestLike, env: Env, ctx: Ctx) {
    this.port = port;
    this.request = this.buildRequest(request);
    this.params = {};
    this.query = this.request.query;
    this.headers = this.request.headers;
    this.context = {
      env,
      ctx,
      request: this.request,
    };
  }

  // ============================================================================
  // THE CONTRACT - Developers MUST implement these
  // ============================================================================

  /**
   * Map external request to domain input
   * This is PURE TRANSLATION - no business logic!
   *
   * @example
   * protected async mapInput(req: AdapterRequest): Promise<CreateUserInput> {
   *   return {
   *     email: req.body.email,
   *     name: req.body.name,
   *   };
   * }
   */
  protected abstract mapInput(req: AdapterRequest): Promise<TInput> | TInput;

  /**
   * Map domain output to external response
   * This is PURE TRANSLATION - no business logic!
   *
   * @example
   * protected mapOutput(output: User): AdapterResponse {
   *   return this.json({
   *     id: output.id,
   *     email: output.email
   *   }, 201);
   * }
   */
  protected abstract mapOutput(output: TOutput): AdapterResponse;

  // ============================================================================
  // Hook Registration - The Rails Convention
  // ============================================================================

  static before<T extends DrivingAdapter>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends DrivingAdapter>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends DrivingAdapter>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  static skipBefore<T extends DrivingAdapter>(fn: HookFunction<T>): void {
    this.beforeHooks = this.beforeHooks.filter((h) => h.fn !== fn);
  }

  static skipAfter<T extends DrivingAdapter>(fn: AfterHookFunction<T>): void {
    this.afterHooks = this.afterHooks.filter((h) => h.fn !== fn);
  }

  static skipAround<T extends DrivingAdapter>(fn: AroundHookFunction<T>): void {
    this.aroundHooks = this.aroundHooks.filter((h) => h.fn !== fn);
  }

  // ============================================================================
  // Execution - The Hexagonal Flow
  // ============================================================================

  /**
   * Execute the adapter lifecycle:
   * 1. Run before hooks (translation concerns: auth, validation format, etc.)
   * 2. Translate request → domain input (mapInput)
   * 3. Call the port (domain logic)
   * 4. Translate domain output → response (mapOutput)
   * 5. Run after hooks (translation concerns: logging, headers, etc.)
   */
  async execute(): Promise<Response> {
    try {
      // 1. Before hooks (can short-circuit)
      const beforeResult = await this.runBeforeHooks();
      if (beforeResult) {
        return this.toResponse(beforeResult);
      }

      // 2. Run the main flow through around hooks
      let response = await this.runAroundHooks(async () => {
        // 2a. TRANSLATE: External → Domain
        const input = await this.mapInput(this.request);

        // 2b. EXECUTE: Call the port (THE HEXAGON)
        const result = await this.port.execute(input);

        // 2c. TRANSLATE: Domain → External
        if (!result.success) {
          return this.handleDomainError(result.error);
        }

        return this.mapOutput(result.data);
      });

      // 3. After hooks (can transform response)
      response = await this.runAfterHooks(response);

      // 4. Convert to Web Response
      return this.toResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ============================================================================
  // Internal Framework Logic
  // ============================================================================

  protected buildRequest(request: RequestLike): AdapterRequest {
    const url = new URL(request.url);

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    return {
      method: request.method,
      url: request.url,
      headers,
      params: {},
      query,
      body: null,
      raw: request,
    };
  }

  protected async parseBody(): Promise<unknown> {
    if (this.request.body !== null) {
      return this.request.body;
    }

    const contentType = this.request.headers["content-type"] || "";
    const raw = this.request.raw;

    try {
      if (contentType.includes("application/json")) {
        this.request.body = await raw.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await raw.formData();
        this.request.body = Object.fromEntries(formData.entries());
      } else if (contentType.includes("multipart/form-data")) {
        this.request.body = await raw.formData();
      } else if (contentType.includes("text/")) {
        this.request.body = await raw.text();
      } else {
        this.request.body = null;
      }
    } catch {
      this.request.body = null;
    }

    return this.request.body;
  }

  protected async body<T = unknown>(): Promise<T> {
    await this.parseBody();
    return this.request.body as T;
  }

  // ============================================================================
  // Response Helpers - For Translation Only
  // ============================================================================

  protected json(
    data: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ): AdapterResponse {
    return {
      status,
      headers: { "content-type": "application/json", ...headers },
      body: data,
    };
  }

  protected html(
    content: string,
    status = 200,
    headers: Record<string, string> = {},
  ): AdapterResponse {
    return {
      status,
      headers: { "content-type": "text/html; charset=utf-8", ...headers },
      body: content,
    };
  }

  protected text(
    content: string,
    status = 200,
    headers: Record<string, string> = {},
  ): AdapterResponse {
    return {
      status,
      headers: { "content-type": "text/plain; charset=utf-8", ...headers },
      body: content,
    };
  }

  protected redirect(
    location: string,
    status = 302,
    headers: Record<string, string> = {},
  ): AdapterResponse {
    return { status, headers: { location, ...headers }, body: null };
  }

  protected noContent(headers: Record<string, string> = {}): AdapterResponse {
    return { status: 204, headers, body: null };
  }

  protected notFound(message: string | object = "Not Found"): AdapterResponse {
    const body = typeof message === "string" ? { error: message } : message;
    return this.json(body, 404);
  }

  protected unauthorized(message: string | object = "Unauthorized"): AdapterResponse {
    const body = typeof message === "string" ? { error: message } : message;
    return this.json(body, 401);
  }

  protected forbidden(message: string | object = "Forbidden"): AdapterResponse {
    const body = typeof message === "string" ? { error: message } : message;
    return this.json(body, 403);
  }

  protected badRequest(message: string | object = "Bad Request"): AdapterResponse {
    const body = typeof message === "string" ? { error: message } : message;
    return this.json(body, 400);
  }

  protected unprocessableEntity(errors: unknown = "Unprocessable Entity"): AdapterResponse {
    return this.json({ errors }, 422);
  }

  protected internalServerError(
    message: string | object = "Internal Server Error",
  ): AdapterResponse {
    const body = typeof message === "string" ? { error: message } : message;
    return this.json(body, 500);
  }

  // ============================================================================
  // Hook Execution
  // ============================================================================

  private shouldRunHook(options?: HookOptions): boolean {
    // For driving adapters, hooks always run (no action concept)
    // If you need conditional hooks, use hook logic itself
    return true;
  }

  private async runBeforeHooks(): Promise<AdapterResponse | null> {
    const constructor = this.constructor as typeof DrivingAdapter;

    for (const { fn, options } of constructor.beforeHooks) {
      if (!this.shouldRunHook(options)) continue;

      const result = await (fn as HookFunction)(this);
      if (result && typeof result === "object" && "status" in result) {
        return result as AdapterResponse;
      }
    }

    return null;
  }

  private async runAfterHooks(response: AdapterResponse): Promise<AdapterResponse> {
    const constructor = this.constructor as typeof DrivingAdapter;
    let currentResponse = response;

    for (const { fn, options } of constructor.afterHooks) {
      if (!this.shouldRunHook(options)) continue;

      const result = await (fn as AfterHookFunction)(this, currentResponse);
      if (result && typeof result === "object" && "status" in result) {
        currentResponse = result as AdapterResponse;
      }
    }

    return currentResponse;
  }

  private async runAroundHooks(action: () => Promise<AdapterResponse>): Promise<AdapterResponse> {
    const constructor = this.constructor as typeof DrivingAdapter;
    const applicableHooks = constructor.aroundHooks.filter(({ options }) =>
      this.shouldRunHook(options),
    );

    if (applicableHooks.length === 0) {
      return action();
    }

    let index = 0;
    const next = async (): Promise<AdapterResponse> => {
      if (index >= applicableHooks.length) {
        return action();
      }

      const { fn } = applicableHooks[index++];
      return (fn as AroundHookFunction)(this, next);
    };

    return next();
  }

  protected toResponse(adapterResponse: AdapterResponse): Response {
    const { status, headers, body } = adapterResponse;

    let responseBody: BodyInit = undefined;

    if (body !== null && body !== undefined) {
      if (typeof body === "string") {
        responseBody = body;
      } else if (body instanceof ReadableStream) {
        responseBody = body;
      } else if (body instanceof Blob) {
        responseBody = body;
      } else if (body instanceof FormData) {
        responseBody = body;
      } else if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer) {
        responseBody = body as BodyInit;
      } else {
        responseBody = JSON.stringify(body);
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      }
    }

    return new Response(responseBody as any, { status, headers });
  }

  protected handleError(error: unknown): Response {
    console.error(`Error in ${this.constructor.name}:`, error);

    if (error instanceof Error) {
      return this.toResponse(this.internalServerError(error.message));
    }

    return this.toResponse(this.internalServerError());
  }

  protected handleDomainError(error: Error): AdapterResponse {
    // Default error handling for domain errors
    // Adapters should override this if they need specific status codes
    return this.internalServerError(error.message);
  }

  protected getEnv<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.context.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected waitUntil(promise: Promise<unknown>): void {
    this.context.ctx.waitUntil(promise);
  }
}

// ============================================================================
// DrivenAdapter - Domain → Infrastructure (Outbound)
// ============================================================================

/**
 * DrivenAdapter: Translates domain requests into infrastructure calls
 *
 * Convention: Implements a Port interface
 * Responsibility: ONLY translation to/from external systems
 *
 * @example
 * class PostgresUserRepository extends DrivenAdapter implements UserRepositoryPort {
 *   async findById(id: string): Promise<User | null> {
 *     // Translate domain request → SQL
 *     const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
 *
 *     // Translate SQL result → domain entity
 *     return row ? this.toDomain(row) : null;
 *   }
 * }
 */
export abstract class DrivenAdapter<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  protected env: Env;
  protected ctx: Ctx;

  constructor(env: Env, ctx: Ctx) {
    this.env = env;
    this.ctx = ctx;
  }

  protected getEnv<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected waitUntil(promise: Promise<unknown>): void {
    this.ctx.waitUntil(promise);
  }
}

