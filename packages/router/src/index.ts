import { z } from "zod";
import type { WorkflowEvent } from "cloudflare:workers";

import {
  trace,
  context,
  propagation,
  SpanStatusCode,
} from "@opentelemetry/api";

import {
  BasicTracerProvider,
  AlwaysOnSampler,
} from "@opentelemetry/sdk-trace-base";

import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

import type {
  ExecutionContext,
  DurableObjectState,
  MessageBatch
} from "@cloudflare/workers-types";

import { Logger, LogLevel } from "nomo/logger";

interface MiddlewareEntry<Env = unknown, Ctx = ExecutionContext> {
  path: string;
  handler: Middleware<Env, Ctx>;
}

export type AppExecutionContext = ExecutionContext | DurableObjectState | WorkflowEvent<any> | MessageBatch<any>;

export function tryDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function isValidPath(path: string): boolean {
  const normalized = path.normalize("NFC");

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code <= 31 || code === 127 || (code >= 128 && code <= 159)) {
      return false;
    }
  }

  const forbidden = "<>\"'`\\^|[]{}";
  for (let i = 0; i < normalized.length; i++) {
    if (forbidden.indexOf(normalized[i]) !== -1) {
      return false;
    }
  }

  return true;
}

export function splitPath(path: string, maxDepth = 32): string[] {
  const normalized = path.normalize("NFC");
  const segments = normalized.split("/");

  if (segments[0] === "") segments.shift();

  if (segments.length > maxDepth) {
    throw new Error(`Path depth exceeded limit (${maxDepth}).`);
  }

  return segments;
}

export function parseNestedParams(
  params: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    const parts = key.split(/[\[\]]/).filter((p, i) => {
      return p !== "" || (i > 0 && key[key.indexOf("[]")] !== undefined);
    });

    const matches = key.matchAll(/([^\[\]]+)|(\[\])/g);
    const segments: string[] = [];
    for (const match of matches) {
      segments.push(match[0] === "[]" ? "" : match[0]);
    }

    if (segments.length === 0) {
      result[key] = value;
      continue;
    }

    if (segments.length === 1 && segments[0] !== "") {
      result[segments[0]] = value;
      continue;
    }

    let current = result;
    for (let i = 0; i < segments.length; i++) {
      const part = segments[i];
      const isLast = i === segments.length - 1;

      if (isLast) {
        if (part === "") {
        } else {
          current[part] = value;
        }
      } else {
        const nextPart = segments[i + 1];
        if (nextPart === "") {
          if (!Array.isArray(current[part])) {
            current[part] = [];
          }
          if (Array.isArray(value)) {
            current[part].push(...value);
          } else {
            current[part].push(value);
          }
          break;
        }

        if (!current[part] || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }

  return result;
}

export function parseQuery(queryString: string): Record<string, any> {
  if (!queryString) return {};
  const search = queryString.startsWith("?")
    ? queryString.slice(1)
    : queryString;
  const params = new URLSearchParams(search);
  const flat: Record<string, any> = {};

  for (const [key, value] of params.entries()) {
    if (flat[key] !== undefined) {
      if (Array.isArray(flat[key])) {
        flat[key].push(value);
      } else {
        flat[key] = [flat[key], value];
      }
    } else {
      flat[key] = value;
    }
  }

  return parseNestedParams(flat);
}

export class RouterTrieNode {
  children: Record<string, RouterTrieNode>;
  methodHandlers: Record<string, Function>;
  isParam: boolean;
  isWildcard: boolean;
  paramName: string | null;

  constructor() {
    this.children = Object.create(null);
    this.methodHandlers = Object.create(null);
    this.isParam = false;
    this.isWildcard = false;
    this.paramName = null;
  }
}

export type RouterContextSource = 
  | 'http'
  | 'rpc'
  | 'durable_object'
  | 'workflow'
  | 'queue'
  | 'service'
  | 'model';

export interface RouterContext<
  Env = any,
  Ctx = ExecutionContext,
> extends Record<string, any> {
  requestId: string;
  params: Record<string, string>;
  query: Record<string, any>;
  headers: Record<string, string>;
  env: Env;
  executionCtx: Ctx;
  logger: Logger;
  isCapnwebRpc: boolean;
  source: RouterContextSource;
  sourceMetadata?: Record<string, any>;
  json: <T = any>(data: T, init?: ResponseInit) => Response;
  text: (data: string, init?: ResponseInit) => Response;
  html: (data: string, init?: ResponseInit) => Response;
  redirect: (url: string, status?: number) => Response;
  cache: (seconds: number) => void;
  parseJson: <T = any>() => Promise<T | null>;
  fetch: (
    input: string | Request | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  rewrite: (response: Response, handlers: Record<string, any>) => Response;
  router: IRouter<Env, Ctx>;
}

export interface RouteConfig {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  request?: {
    body?: {
      content: {
        "application/json": {
          schema: z.ZodTypeAny;
        };
      };
      description?: string;
      required?: boolean;
    };
    params?: z.ZodObject<any>;
    query?: z.ZodObject<any>;
    headers?: z.ZodObject<any>;
  };
  responses: Record<
    string,
    {
      description: string;
      content?: {
        "application/json": {
          schema: z.ZodTypeAny;
        };
      };
    }
  >;
}

export type RouteHandler<Env = any, Ctx = ExecutionContext> = (
  request: Request,
  env: Env,
  ctx: RouterContext<Env, Ctx>,
) => Response | Promise<Response>;

export type Next = () => Promise<Response>;

export type Middleware<Env = any, Ctx = ExecutionContext> = (
  request: Request,
  env: Env,
  ctx: RouterContext<Env, Ctx>,
  next: Next,
) => Response | Promise<Response>;

export interface IRouter<Env = any, Ctx = ExecutionContext> {
  handle(
    request: Request,
    env: Env,
    executionCtx: Ctx,
  ): Response | Promise<Response>;
  rpc(method: string, args: any[], env: Env, executionCtx: Ctx): Promise<any>;
}

export interface IDrawableRouter<
  Env = any,
  Ctx = ExecutionContext,
> extends IRouter<Env, Ctx> {
  get(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ): void;
  post(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ): void;
  put(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ): void;
  patch(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ): void;
  delete(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ): void;
  all(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ): void;
  resources(path: string, controller: any): void;
  resourceActions(path: string, controller: any): void;
  provide(name: string, service: any): void;
  inject<T = any>(name: string): T;
  use(middleware: Middleware<Env, Ctx>): void;
  version(v: string, callback: (drawer: any) => void): void;
}

export interface RouterOptions<Env = any, Ctx = ExecutionContext> {
  strict?: boolean;
  drawer?: new (router: any, ...args: any[]) => any;
}

export type Constructor<T> = new (...args: any[]) => T;

export class HttpError extends Error {
  constructor(
    public message: string,
    public status: number,
    public details?: any,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Not Found", details?: any) {
    super(message, 404, details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string = "Conflict", details?: any) {
    super(message, 409, details);
    this.name = "ConflictError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string = "Bad Request", details?: any) {
    super(message, 400, details);
    this.name = "BadRequestError";
  }
}

export class ConstraintError extends HttpError {
  constructor(
    message: string = "Constraint Violation",
    constraintType: string,
    details?: any
  ) {
    super(message, 409, { constraintType, ...details });
    this.name = "ConstraintError";
  }
}

export class ValidationError extends HttpError {
  constructor(message: string = "Validation Error", details?: any) {
    super(message, 422, details);
    this.name = "ValidationError";
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string = "Unprocessable Entity", details?: any) {
    super(message, 422, details);
    this.name = "UnprocessableEntityError";
  }
}

export abstract class RouteDrawer<Env = any, Ctx = any> {
  protected providers: Map<string, any> = new Map();

  constructor(
    protected router: IDrawableRouter<Env, Ctx>,
    protected prefix: string = "",
  ) {}

  use(middleware: Middleware<Env, Ctx>) {
    this.router.use(middleware);
  }

  get(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.router.get(this.join(path), ...handlers);
  }

  post(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.router.post(this.join(path), ...handlers);
  }

  put(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.router.put(this.join(path), ...handlers);
  }

  patch(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.router.patch(this.join(path), ...handlers);
  }

  delete(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.router.delete(this.join(path), ...handlers);
  }

  all(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.router.all(this.join(path), ...handlers);
  }

  resources(path: string, controller: any) {
    const resourcePath = path;

    this.get(resourcePath, controller.action("index"));
    this.post(resourcePath, controller.action("create"));
    this.post(`${resourcePath}/search`, controller.action("findAllBy"));
    this.get(`${resourcePath}/:id`, controller.action("show"));
    this.patch(`${resourcePath}/:id`, controller.action("update"));
    this.delete(`${resourcePath}/:id`, controller.action("destroy"));
  }

  resourceActions(path: string, controller: any) {
    const resourcePath = path;

    // Basic CRUD (collection)
    this.get(resourcePath, controller.action("index"));
    this.post(resourcePath, controller.action("create"));
    this.post(`${resourcePath}/search`, controller.action("findAllBy"));

    // Basic CRUD (member)
    this.get(`${resourcePath}/:id`, controller.action("show"));
    this.patch(`${resourcePath}/:id`, controller.action("update"));
    this.delete(`${resourcePath}/:id`, controller.action("destroy"));

    // Lifecycle actions (member)
    this.post(`${resourcePath}/:id/trash`, controller.action("trash"));
    this.post(`${resourcePath}/:id/restore`, controller.action("restore"));
    this.post(`${resourcePath}/:id/hide`, controller.action("hide"));
    this.post(`${resourcePath}/:id/unhide`, controller.action("unhide"));
    this.post(`${resourcePath}/:id/flag`, controller.action("flag"));
    this.post(`${resourcePath}/:id/unflag`, controller.action("unflag"));
    this.delete(`${resourcePath}/:id/purge`, controller.action("purge"));
    this.post(`${resourcePath}/:id/retire`, controller.action("retire"));
    this.post(`${resourcePath}/:id/unretire`, controller.action("unretire"));

    // Async actions (member)
    this.post(`${resourcePath}/:id/queue`, controller.action("queue"));
    this.post(`${resourcePath}/:id/cron`, controller.action("cron"));

    // Special actions (member)
    this.post(`${resourcePath}/:id/add`, controller.action("add"));
    this.post(`${resourcePath}/:id/remove`, controller.action("remove"));
    this.post(`${resourcePath}/:id/assign`, controller.action("assign"));
    this.post(`${resourcePath}/:id/unassign`, controller.action("unassign"));

    // Relationship traversal (member)
    this.get(`${resourcePath}/:id/child_ids`, controller.action("listChildIds"));
    this.get(`${resourcePath}/:id/parent_ids`, controller.action("listParentIds"));
    this.get(`${resourcePath}/:id/sibling_ids`, controller.action("listSiblingIds"));
    this.get(`${resourcePath}/:id/cousin_ids`, controller.action("listCousinIds"));
    this.get(`${resourcePath}/:id/ancestor_ids`, controller.action("listAncestorIds"));
    this.get(`${resourcePath}/:id/descendant_ids`, controller.action("listDescendantIds"));
    this.get(`${resourcePath}/:id/associated_through_ids`, controller.action("listAssociatedThroughIds"));
    this.get(`${resourcePath}/:id/related_ids`, controller.action("listRelatedIds"));
  }

  provide(name: string, service: any) {
    this.providers.set(name, service);
  }

  inject<T = any>(name: string): T {
    return this.providers.get(name);
  }

  scope(path: string, callback: (drawer: this) => void) {
    const scopedDrawer = new (this.constructor as any)(
      this.router,
      this.join(path),
    );
    this.providers.forEach((val, key) => scopedDrawer.provide(key, val));
    callback(scopedDrawer);
  }

  namespace(name: string, callback: (drawer: this) => void) {
    this.scope(name, callback);
  }

  version(v: string, callback: (drawer: this) => void) {
    this.scope(`v${v}`, callback);
  }

  protected join(path: string): string {
    const cleanedPrefix = this.prefix.endsWith("/")
      ? this.prefix.slice(0, -1)
      : this.prefix;
    const cleanedPath = path.startsWith("/") ? path.slice(1) : path;

    if (!cleanedPrefix) return `/${cleanedPath}`;
    return `${cleanedPrefix}/${cleanedPath}`;
  }

  root(handler: Middleware<Env, Ctx> | RouteHandler<Env, Ctx>) {
    this.router.get(this.join("/"), handler);
  }


  abstract draw(): void;

  static draw<E, C>(router: any, DrawerClass: any, ...args: any[]) {
    const drawer = new DrawerClass(router, ...args);
    drawer.draw();
  }
}

export class Router<Env = unknown, Ctx = ExecutionContext> {
  private root: RouterTrieNode;
  private middlewares: MiddlewareEntry<Env, Ctx>[];
  private errorHandler?: (
    err: any,
    request: Request,
    env: Env,
    ctx: RouterContext<Env, Ctx>,
  ) => Response | Promise<Response>;
  private strict: boolean;
  public openAPIRegistry: OpenAPIRegistry;
  private static tracingInitialized = false;

  constructor(private options: RouterOptions<Env, Ctx> = {}) {
    this.root = new RouterTrieNode();
    this.middlewares = [];
    this.strict = options.strict ?? false;
    this.openAPIRegistry = new OpenAPIRegistry();

    this.initializeTracing();

    if (options.drawer) {
      const drawer = new options.drawer(this, "");
      drawer.draw();
    }
  }

  private initializeTracing() {
    if (Router.tracingInitialized) return;

    try {
      const contextManager = new AsyncLocalStorageContextManager();
      contextManager.enable();
      context.setGlobalContextManager(contextManager);

      const provider = new BasicTracerProvider({
        sampler: new AlwaysOnSampler(),
      });
      provider.register();
      Router.tracingInitialized = true;
    } catch (e) {
    }
  }

  draw(DrawerClass: new (router: any, prefix: string) => { draw: () => void }) {
    const drawer = new DrawerClass(this, "");
    drawer.draw();
    return this;
  }

  private addRoute(
    method: string,
    path: string,
    handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[],
  ) {
    if (!isValidPath(path)) {
      throw new Error(
        `Invalid route path: ${path}. Paths must not contain forbidden characters.`,
      );
    }
    if (handlers.length === 0) {
      throw new Error(
        `Route ${method} ${path} must have at least one handler.`,
      );
    }

    const rawParts = splitPath(path);

    let node = this.root;

    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i];
      const isParam = part.startsWith(":");
      const isWildcard = part === "*";
      const partKey = isWildcard ? "*" : isParam ? ":" : part;

      if (!node.children[partKey]) {
        node.children[partKey] = new RouterTrieNode();
        node.children[partKey].isParam = isParam;
        node.children[partKey].isWildcard = isWildcard;
        if (isParam) {
          node.children[partKey].paramName = part.slice(1);
        }
      }
      node = node.children[partKey];

      if (isWildcard && i < rawParts.length - 1) {
        throw new Error("Wildcard '*' must be the last segment in a path.");
      }
    }

    const finalHandler: RouteHandler<Env, Ctx> = async (req, env, ctx) => {
      let index = 0;
      const next: Next = async () => {
        const currentHandler = handlers[index++];
        if (index < handlers.length) {
          return await (currentHandler as Middleware<Env, Ctx>)(
            req,
            env,
            ctx,
            next,
          );
        } else {
          return await (currentHandler as RouteHandler<Env, Ctx>)(
            req,
            env,
            ctx,
          );
        }
      };
      return await next();
    };
    node.methodHandlers[method.toUpperCase()] = finalHandler;
  }

  private rpcHandlers = new Map<string, Function>();

  rpc(method: string, args: any[], env: Env, executionCtx: Ctx): Promise<any> {
    const handler = this.rpcHandlers.get(method);
    if (!handler) {
      throw new Error(`RPC method ${method} not found`);
    }

    const tracer = trace.getTracer("nomo-rpc");
    return tracer.startActiveSpan(`rpc ${method}`, async (span) => {
      try {
        return await handler(args, { env, executionCtx });
      } catch (err: any) {
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  registerRpc(name: string, handler: Function) {
    this.rpcHandlers.set(name, handler);
  }

  use(path: string | Middleware<Env, Ctx>, middleware?: Middleware<Env, Ctx>) {
    if (typeof path === "function") {
      this.middlewares.push({ path: "*", handler: path });
    } else if (middleware) {
      this.middlewares.push({ path, handler: middleware });
    }
  }

  static zValidator<
    S extends z.ZodTypeAny,
    Env = unknown,
    Ctx = ExecutionContext,
  >(
    target: "json" | "query" | "header" | "param",
    schema: S,
  ): Middleware<Env, Ctx> {
    return async (req, env, ctx, next) => {
      let value: any;
      if (target === "json") {
        value = await ctx.parseJson();
      } else if (target === "query") {
        value = ctx.query;
      } else if (target === "header") {
        value = ctx.headers;
      } else if (target === "param") {
        value = ctx.params;
      }

      const result = await schema.safeParseAsync(value);
      if (!result.success) {
        ctx.logger.warn(`[VALIDATION FAILED] ${target}`, {
          target,
          issues: result.error.issues,
        });
        return ctx.json(
          {
            error: "Validation failed",
            target,
            issues: result.error.issues,
          },
          { status: 400 },
        );
      }

      (ctx as any)[`valid${target.charAt(0).toUpperCase() + target.slice(1)}`] =
        result.data;

      ctx.logger.debug(`[VALIDATION PASSED] ${target}`);
      return await next();
    };
  }

  private matchPath(pattern: string, path: string): boolean {
    if (pattern === "*") return true;
    if (pattern === path) return true;
    if (pattern.endsWith("/") && path.startsWith(pattern)) return true;
    if (!pattern.endsWith("/") && path.startsWith(pattern + "/")) return true;
    return false;
  }

  async applyMiddleware(
    request: Request,
    env: Env,
    ctx: RouterContext<Env, Ctx>,
    finalHandler: () => Promise<Response>,
  ): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const matchedMiddlewares = this.middlewares.filter((m) =>
      this.matchPath(m.path, pathname),
    );

    ctx.logger.debug(
      `[MIDDLEWARE] ${matchedMiddlewares.length} middleware(s) matched for ${pathname}`,
      {
        request_id: ctx.requestId
      }
    );

    let index = 0;

    const next: Next = async () => {
      if (index < matchedMiddlewares.length) {
        const middleware = matchedMiddlewares[index++];
        ctx.logger.debug(
          `[MIDDLEWARE RUNNING] ${index}/${matchedMiddlewares.length}`,
          {
            pathname: pathname,
            request_id: ctx.requestId
          }
        );
        return await middleware.handler(request, env, ctx, next);
      }

      ctx.logger.debug(
        `[HANDLER RUNNING] ${pathname}`,
        {
          pathname: pathname,
          request_id: ctx.requestId
        }
      );
      return await finalHandler();
    };

    return await next();
  }

  on(
    method: string,
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.addRoute(method, path, handlers);
  }

  get(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.on("GET", path, ...handlers);
  }

  post(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.on("POST", path, ...handlers);
  }

  put(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.on("PUT", path, ...handlers);
  }

  delete(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.on("DELETE", path, ...handlers);
  }

  patch(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.on("PATCH", path, ...handlers);
  }

  all(
    path: string,
    ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]
  ) {
    this.on("ALL", path, ...handlers);
  }

  openapi<T extends RouteConfig>(config: T, handler: RouteHandler<Env, Ctx>) {
    const routingPath = config.path.replace(/{([^}]+)}/g, ":$1");

    const handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[] = [];

    if (config.request?.params) {
      handlers.push(Router.zValidator("param", config.request.params));
    }
    if (config.request?.query) {
      handlers.push(Router.zValidator("query", config.request.query));
    }
    if (config.request?.headers) {
      handlers.push(Router.zValidator("header", config.request.headers));
    }
    if (config.request?.body?.content["application/json"]?.schema) {
      handlers.push(
        Router.zValidator(
          "json",
          config.request.body.content["application/json"].schema,
        ),
      );
    }

    handlers.push(handler);

    this.on(config.method.toUpperCase(), routingPath, ...handlers);

    this.registerOpenApiRoute(config);
  }

  resources(path: string, controller: any) {
    const resourcePath = path.startsWith("/") ? path : `/${path}`;

    this.get(resourcePath, controller.action("index"));
    this.post(resourcePath, controller.action("create"));
    this.get(`${resourcePath}/:id`, controller.action("show"));
    this.patch(`${resourcePath}/:id`, controller.action("update"));
    this.delete(`${resourcePath}/:id`, controller.action("destroy"));
  }

  resourceActions(path: string, controller: any) {
    const resourcePath = path.startsWith("/") ? path : `/${path}`;

    // Basic CRUD (collection)
    this.get(resourcePath, controller.action("index"));
    this.post(resourcePath, controller.action("create"));

    // Basic CRUD (member)
    this.get(`${resourcePath}/:id`, controller.action("show"));
    this.patch(`${resourcePath}/:id`, controller.action("update"));
    this.delete(`${resourcePath}/:id`, controller.action("destroy"));

    // Lifecycle actions (member)
    this.post(`${resourcePath}/:id/trash`, controller.action("trash"));
    this.post(`${resourcePath}/:id/restore`, controller.action("restore"));
    this.post(`${resourcePath}/:id/hide`, controller.action("hide"));
    this.post(`${resourcePath}/:id/unhide`, controller.action("unhide"));
    this.post(`${resourcePath}/:id/flag`, controller.action("flag"));
    this.post(`${resourcePath}/:id/unflag`, controller.action("unflag"));
    this.delete(`${resourcePath}/:id/purge`, controller.action("purge"));
    this.post(`${resourcePath}/:id/retire`, controller.action("retire"));
    this.post(`${resourcePath}/:id/unretire`, controller.action("unretire"));

    // Async actions (member)
    this.post(`${resourcePath}/:id/queue`, controller.action("queue"));
    this.post(`${resourcePath}/:id/cron`, controller.action("cron"));

    // Special actions (member)
    this.post(`${resourcePath}/:id/add`, controller.action("add"));
    this.post(`${resourcePath}/:id/remove`, controller.action("remove"));
    this.post(`${resourcePath}/:id/assign`, controller.action("assign"));
    this.post(`${resourcePath}/:id/unassign`, controller.action("unassign"));

    // Relationship traversal (member)
    this.get(`${resourcePath}/:id/child_ids`, controller.action("listChildIds"));
    this.get(`${resourcePath}/:id/parent_ids`, controller.action("listParentIds"));
    this.get(`${resourcePath}/:id/sibling_ids`, controller.action("listSiblingIds"));
    this.get(`${resourcePath}/:id/cousin_ids`, controller.action("listCousinIds"));
    this.get(`${resourcePath}/:id/ancestor_ids`, controller.action("listAncestorIds"));
    this.get(`${resourcePath}/:id/descendant_ids`, controller.action("listDescendantIds"));
    this.get(`${resourcePath}/:id/associated_through_ids`, controller.action("listAssociatedThroughIds"));
    this.get(`${resourcePath}/:id/related_ids`, controller.action("listRelatedIds"));
  }

  provide(name: string, service: any) {
    throw new Error(
      "provide() should be called on a RouteDrawer, not the Router directly.",
    );
  }

  inject<T = any>(name: string): T {
    throw new Error(
      "inject() should be called on a RouteDrawer, not the Router directly.",
    );
  }

  private registerOpenApiRoute(config: RouteConfig) {
    const responses: any = {};
    for (const [code, res] of Object.entries(config.responses)) {
      responses[code] = {
        description: res.description,
        content: res.content,
      };
    }

    this.openAPIRegistry.registerPath({
      method: config.method as any,
      path: config.path,
      request: {
        params: config.request?.params,
        query: config.request?.query,
        headers: config.request?.headers,
        body: config.request?.body,
      },
      responses,
    });
  }

  getOpenApiDocument(info: {
    title: string;
    version: string;
    description?: string;
  }): any {
    const generator = new OpenApiGeneratorV3(this.openAPIRegistry.definitions);
    return generator.generateDocument({
      openapi: "3.0.0",
      info,
    });
  }

  onError(
    handler: (
      err: any,
      request: Request,
      env: Env,
      ctx: RouterContext<Env, Ctx>,
    ) => Response | Promise<Response>,
  ) {
    this.errorHandler = handler;
  }

  findRoute(
    method: string,
    path: string,
  ): {
    handler: RouteHandler<Env, Ctx>;
    params: Record<string, string>;
  } | null {
    let truePath = path;
    if (!this.strict && truePath.length > 1 && truePath.endsWith("/")) {
      truePath = truePath.slice(0, -1);
    }

    const trueParts = splitPath(truePath);

    let node = this.root;
    const params: Record<string, string> = Object.create(null);

    for (let i = 0; i < trueParts.length; i++) {
      const part = trueParts[i];

      const exactChild = node.children[part];
      const paramChild = node.children[":"];
      const wildcardChild = node.children["*"];

      if (exactChild) {
        node = exactChild;
      } else if (paramChild) {
        if (paramChild.paramName) {
          params[paramChild.paramName] = part;
        }
        node = paramChild;
      } else if (wildcardChild) {
        params["*"] = trueParts.slice(i).join("/");
        node = wildcardChild;
        break;
      } else {
        return null;
      }
    }

    const handler = node.methodHandlers[method.toUpperCase()] as
      | RouteHandler<Env, Ctx>
      | undefined;
    return handler ? { handler, params } : null;
  }

  async handle(
    request: Request,
    env: Env,
    executionCtx: Ctx,
  ): Promise<Response> {
    if ((env as any).ENVIRONMENT) {
      Logger.ENVIRONMENT = (env as any).ENVIRONMENT;
    }

    if ((env as any).LOG_LEVEL) {
      Logger.LEVEL = (env as any).LOG_LEVEL;
    } else if (Logger.ENVIRONMENT === "development") {
      Logger.LEVEL = LogLevel.DEBUG;
    }

    const url = new URL(request.url);
    const method = request.method;

    const decodedPath = tryDecode(url.pathname).normalize("NFC");

    try {
      splitPath(decodedPath);
    } catch (e: any) {
      return new Response(e.message, { status: 414 });
    }

    if (!isValidPath(decodedPath)) {
      return new Response("Malformed Path", { status: 400 });
    }

    const responseHeaders = new Headers();

    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

    const ctx: RouterContext<Env, Ctx> = {
      requestId,
      params: Object.create(null),
      query: Object.create(null),
      headers: Object.create(null),
      env,
      executionCtx,
      logger: new Logger({
        service: "router",
        environment: (env as any).ENVIRONMENT || "production",
        level: (env as any).LOG_LEVEL || LogLevel.DEBUG,
        context: {
          request_id: requestId,
          method: request.method,
          path: decodedPath,
        },
      }),
      json: (data, init) => {
        const headers = new Headers(init?.headers);
        responseHeaders.forEach((v, k) => headers.append(k, v));
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify(data), { ...init, headers });
      },
      text: (data, init) => {
        const headers = new Headers(init?.headers);
        responseHeaders.forEach((v, k) => headers.append(k, v));
        const status = init?.status || 200;
        if (status === 204 || status === 304)
          return new Response(null, { ...init, headers });
        return new Response(data, { ...init, headers });
      },
      html: (data, init) => {
        const headers = new Headers(init?.headers);
        responseHeaders.forEach((v, k) => headers.append(k, v));
        headers.set("Content-Type", "text/html; charset=utf-8");
        const status = init?.status || 200;
        if (status === 204 || status === 304)
          return new Response(null, { ...init, headers });
        return new Response(data, { ...init, headers });
      },
      redirect: (url, status = 302) => Response.redirect(url, status),
      cache: (seconds) => {
        responseHeaders.set("Cache-Control", `public, max-age=${seconds}`);
      },
      parseJson: async () => {
        if ((ctx as any).validJson) return (ctx as any).validJson;
        try {
          return await request.json();
        } catch {
          return null;
        }
      },
      fetch: async (input: string | Request | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        propagation.inject(context.active(), headers as any);
        return await fetch(input, { ...init, headers });
      },
      router: this,
      isCapnwebRpc: !!request.headers.get("Capnweb-RPC"),
      source: 'http' as RouterContextSource,
      rewrite: (response: Response, handlers: any) => {
        // @ts-ignore - HTMLRewriter is available in Cloudflare Workers
        const rewriter = new HTMLRewriter();
        if (Array.isArray(handlers)) {
          for (const { selector, handler } of handlers) {
            rewriter.on(selector, handler);
          }
        } else {
          for (const [selector, handler] of Object.entries(handlers)) {
            rewriter.on(selector, handler as any);
          }
        }
        const transformed = rewriter.transform(response);
        const headers = new Headers(transformed.headers);
        headers.delete("Content-Length");
        return new Response(transformed.body, {
          status: transformed.status,
          statusText: transformed.statusText,
          headers,
        });
      },
    };

    ctx.query = parseQuery(url.search);
    request.headers.forEach((v, k) => {
      ctx.headers[k] = v;
    });

    const isRpcEndpoint = url.pathname.includes('/rpc/');
    
    if (!isRpcEndpoint && ctx.headers["content-type"]?.includes("application/json")) {
      try {
        const body = await request.json();
        (ctx as any).validJson = parseNestedParams(body as any);
      } catch (e) {
        return new Response("Malformed JSON", { status: 400 });
      }
    }

    const tracer = trace.getTracer("nomo-router");

    const parentContext = propagation.extract(
      context.active(),
      request.headers,
      {
        get: (headers, key) => (headers as Headers).get(key) || undefined,
        keys: (headers) => Array.from((headers as Headers).keys()),
      },
    );

    return await context.with(parentContext, async () => {
      return await tracer.startActiveSpan(
        `${method} ${decodedPath}`,
        async (span) => {
          span.setAttributes({
            "http.method": method,
            "http.url": request.url,
            "http.user_agent": request.headers.get("user-agent") || undefined,
            "http.client_ip":
              request.headers.get("cf-connecting-ip") || undefined,
          });
          try {
            ctx.logger.info(
              `[REQUEST] ${method} ${decodedPath}`, {
                method,
                pattern: decodedPath,
                request_id: ctx.requestId,
                ip: request.headers.get('cf-connecting-ip') || 'unknown'
              }
            );

            const response = await this.applyMiddleware(
              request,
              env,
              ctx,
              async () => {
                const routeMatch = this.findRoute(method, decodedPath);
                if (routeMatch) {
                  const { handler, params } = routeMatch;
                  ctx.params = params;
                  ctx.logger.debug(
                    `[ROUTE MATCHED] ${method} ${decodedPath}`,
                    {
                      method,
                      pattern: decodedPath,
                      params: JSON.stringify(ctx.params),
                      request_id: ctx.requestId
                    }
                  );
                  return await handler(request, env, ctx);
                }

                ctx.logger.warn(
                  `[ROUTE NOT FOUND] ${method} ${decodedPath}`,
                  {
                    method,
                    pattern: decodedPath,
                    params: JSON.stringify(ctx.params),
                    request_id: ctx.requestId
                  }
                );
                return new Response(
                  `${decodedPath} not found`,
                  {
                    status: 404,
                    statusText: "Not Found",
                  }
                );
              },
            );

            if (response.status >= 400) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: response.statusText,
              });
            } else {
              span.setStatus({ code: SpanStatusCode.OK });
            }
            span.setAttribute("http.status_code", response.status);

            ctx.logger.debug(
              `[RESPONSE SENT] ${method} ${decodedPath}`,
              {
                method,
                pattern: decodedPath,
                status: response.status,
                request_id: ctx.requestId
              }
            );
            return response;
          } catch (err: any) {
            span.recordException(err as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: err.message,
            });

            if (err instanceof HttpError) {
              ctx.logger.warn(
                `[HANDLED ERROR] ${method} ${decodedPath}`,
                {
                  method,
                  pattern: decodedPath,
                  status: err.status,
                  error: err.message,
                  request_id: ctx.requestId,
                  details: err.details,
                }
              );
              return ctx.json(
                {
                  error: err.message,
                  details: err.details,
                },
                { status: err.status },
              );
            }

            ctx.logger.error(
              `[INTERNAL ERROR] ${method} ${decodedPath}`,
              {
                method,
                pattern: decodedPath,
                error: err.message,
                request_id: ctx.requestId
              },
              err as Error
            );
            if (this.errorHandler) {
              return await this.errorHandler(err, request, env, ctx);
            }
            return new Response("Internal Server Error", { status: 500 });
          } finally {
            span.end();
          }
        },
      );
    });
  }
}
