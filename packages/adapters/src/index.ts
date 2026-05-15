/**
 * adapters - Hexagonal Architecture Adapter Framework
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

export interface RegisteredHook<T = any> {
  fn: HookFunction<T> | AfterHookFunction<T> | AroundHookFunction<T>;
  options?: HookOptions;
}

export abstract class DrivingAdapter<
  TInput = unknown,
  TOutput = unknown,
  TPort extends Port<TInput, TOutput> = Port<TInput, TOutput>,
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected port: TPort;

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

  protected abstract mapInput(req: AdapterRequest): Promise<TInput> | TInput;

  protected abstract mapOutput(output: TOutput): AdapterResponse;

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

  async execute(): Promise<Response> {
    try {
      const beforeResult = await this.runBeforeHooks();
      if (beforeResult) {
        return this.toResponse(beforeResult);
      }

      let response = await this.runAroundHooks(async () => {
        const input = await this.mapInput(this.request);
        const result = await this.port.execute(input);

        if (!result.success) {
          return this.handleDomainError(result.error);
        }

        return this.mapOutput(result.data);
      });

      response = await this.runAfterHooks(response);

      return this.toResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

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

  private shouldRunHook(options?: HookOptions): boolean {
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
