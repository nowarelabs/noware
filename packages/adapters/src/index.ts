/**
 * adapters
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike,
  HookOptions,
  Port,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
  AdapterRequest,
  AdapterResponse,
  AdapterContext,
} from "@nowarelabs/shared";

export type { AdapterRequest, AdapterResponse, AdapterContext } from "@nowarelabs/shared";

type BodyInit =
  | string
  | ReadableStream
  | Blob
  | FormData
  | ArrayBufferView
  | ArrayBuffer
  | null
  | undefined;

export abstract class BaseAdapter<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected env: Env;
  protected ctx: Ctx;
  protected metadata: Record<string, unknown> = {};

  constructor(env: Env, ctx: Ctx) {
    this.env = env;
    this.ctx = ctx;
  }

  protected setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  protected getMetadata<T = unknown>(key: string): T | undefined {
    return this.metadata[key] as T;
  }

  static before<T extends BaseAdapter>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseAdapter>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseAdapter>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  static skipBefore<T extends BaseAdapter>(fn: HookFunction<T>): void {
    this.beforeHooks = this.beforeHooks.filter((h) => h.fn !== fn);
  }

  static skipAfter<T extends BaseAdapter>(fn: AfterHookFunction<T>): void {
    this.afterHooks = this.afterHooks.filter((h) => h.fn !== fn);
  }

  static skipAround<T extends BaseAdapter>(fn: AroundHookFunction<T>): void {
    this.aroundHooks = this.aroundHooks.filter((h) => h.fn !== fn);
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }

  protected async beforeExecute(): Promise<AdapterResponse | void> {
    // Convention: override in subclasses
  }

  protected async afterExecute(_result: any): Promise<any> {
    // Convention: override in subclasses
  }

  protected async runBeforeHooks<R = any>(): Promise<R | null> {
    const instanceResult = await this.beforeExecute();
    if (instanceResult) return instanceResult as R;

    const constructor = this.constructor as typeof BaseAdapter;

    for (const { fn, options } of constructor.beforeHooks) {
      if (!this.shouldRunHook(options)) continue;

      const result = await (fn as HookFunction)(this);
      if (result !== undefined && result !== null) {
        return result as R;
      }
    }

    return null;
  }

  protected async runAfterHooks<R = any>(result: R): Promise<R> {
    let currentResult = result;

    const instanceResult = await this.afterExecute(currentResult);
    if (instanceResult) currentResult = instanceResult as R;

    const constructor = this.constructor as typeof BaseAdapter;

    for (const { fn, options } of constructor.afterHooks) {
      if (!this.shouldRunHook(options)) continue;

      const hookResult = await (fn as AfterHookFunction)(this, currentResult);
      if (hookResult !== undefined && hookResult !== null) {
        currentResult = hookResult as R;
      }
    }

    return currentResult;
  }

  protected async runAroundHooks<R = any>(action: () => Promise<R>): Promise<R> {
    const constructor = this.constructor as typeof BaseAdapter;
    const applicableHooks = constructor.aroundHooks.filter(({ options }) =>
      this.shouldRunHook(options),
    );

    if (applicableHooks.length === 0) {
      return action();
    }

    let index = 0;
    const next = async (): Promise<R> => {
      if (index >= applicableHooks.length) {
        return action();
      }

      const { fn } = applicableHooks[index++];
      return (fn as AroundHookFunction)(this, next);
    };

    return next();
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

  protected internalServerError(
    message: string | object = "Internal Server Error",
  ): AdapterResponse {
    const body = typeof message === "string" ? { error: message } : message;
    return this.json(body, 500);
  }

  protected unprocessableEntity(errors: unknown = "Unprocessable Entity"): AdapterResponse {
    return this.json({ errors }, 422);
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

  protected getEnv<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected waitUntil(promise: Promise<unknown>): void {
    this.ctx.waitUntil(promise);
  }
}

export abstract class DrivingAdapter<
  TInput = unknown,
  TOutput = unknown,
  TPort extends Port<TInput, TOutput> = Port<TInput, TOutput>,
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> extends BaseAdapter<Ctx, Env> {
  protected port: TPort;

  protected context: AdapterContext<Ctx, Env>;
  protected request: AdapterRequest;
  protected params: Record<string, string>;
  protected query: Record<string, string>;
  protected headers: Record<string, string>;

  constructor(port: TPort, request: RequestLike, env: Env, ctx: Ctx) {
    super(env, ctx);
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

    // Convention: Auto-populate common metadata
    this.setMetadata("method", this.request.method);
    this.setMetadata("url", this.request.url);
  }

  protected async mapInput(_req: AdapterRequest): Promise<TInput> {
    // Convention: default to body mapping
    return await this.body<TInput>();
  }

  protected mapOutput(output: TOutput): AdapterResponse {
    // Convention: default to JSON response
    return this.json(output);
  }

  async execute(): Promise<Response> {
    try {
      const beforeResult = await this.runBeforeHooks<AdapterResponse>();
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

  protected handleDomainError(error: any): AdapterResponse {
    // Convention: automatic mapping of domain error patterns to status codes
    const status = error.status || error.statusCode || (error.code === "NOT_FOUND" ? 404 : 500);
    const message = error.message || "Internal Server Error";

    if (status === 404) return this.notFound(message);
    if (status === 401) return this.unauthorized(message);
    if (status === 403) return this.forbidden(message);
    if (status === 400) return this.badRequest(message);
    if (status === 422) return this.unprocessableEntity(message);

    return this.internalServerError(message);
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
}

export abstract class DrivenAdapter<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> extends BaseAdapter<Ctx, Env> {
  protected abstract handleExternalError(error: unknown): Error;

  protected async call<T = unknown>(action: () => Promise<T>): Promise<T> {
    try {
      await this.runBeforeHooks();
      const result = await this.runAroundHooks(action);
      return await this.runAfterHooks(result);
    } catch (error) {
      throw this.handleExternalError(error);
    }
  }
}
