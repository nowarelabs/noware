import { z } from "zod";
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import type { ExecutionContext } from "@cloudflare/workers-types";

import RouterTrieNode from "./lib/routerTrieNode";
import { isValidPath, splitPath, tryDecode } from "./utils/url";

export interface RouterContext<Env = unknown, Ctx = ExecutionContext> extends Record<string, any> {
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  env: Env;
  executionCtx: Ctx;
  json: <T = any>(data: T, init?: ResponseInit) => Response;
  text: (data: string, init?: ResponseInit) => Response;
  html: (data: string, init?: ResponseInit) => Response;
  redirect: (url: string, status?: number) => Response;
  cache: (seconds: number) => void;
  parseJson: <T = any>() => Promise<T | null>;
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

export type RouteHandler<Env = unknown, Ctx = ExecutionContext> = (
  request: Request,
  env: Env,
  ctx: RouterContext<Env, Ctx>,
) => Response | Promise<Response>;

export type Next = () => Promise<Response>;

export type Middleware<Env = unknown, Ctx = ExecutionContext> = (
  request: Request,
  env: Env,
  ctx: RouterContext<Env, Ctx>,
  next: Next,
) => Response | Promise<Response>;

interface MiddlewareEntry<Env = unknown, Ctx = ExecutionContext> {
  path: string;
  handler: Middleware<Env, Ctx>;
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

  constructor(options: { strict?: boolean } = {}) {
    this.root = new RouterTrieNode();
    this.middlewares = [];
    this.strict = options.strict ?? false;
    this.openAPIRegistry = new OpenAPIRegistry();
  }

  private addRoute(
    method: string,
    path: string,
    handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[],
  ) {
    if (!isValidPath(path)) {
      throw new Error(`Invalid route path: ${path}. Paths must not contain forbidden characters.`);
    }
    if (handlers.length === 0) {
      throw new Error(`Route ${method} ${path} must have at least one handler.`);
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

      // Recursive wildcard must be at the end
      if (isWildcard && i < rawParts.length - 1) {
        throw new Error("Wildcard '*' must be the last segment in a path.");
      }
    }

    // Chain handlers
    const finalHandler: RouteHandler<Env, Ctx> = async (req, env, ctx) => {
      let index = 0;
      const next: Next = async () => {
        const currentHandler = handlers[index++];
        if (index < handlers.length) {
          // It's a middleware
          return await (currentHandler as Middleware<Env, Ctx>)(req, env, ctx, next);
        } else {
          // It's the final handler
          return await (currentHandler as RouteHandler<Env, Ctx>)(req, env, ctx);
        }
      };
      return await next();
    };

    node.methodHandlers[method.toUpperCase()] = finalHandler;
  }

  use(path: string | Middleware<Env, Ctx>, middleware?: Middleware<Env, Ctx>) {
    if (typeof path === "function") {
      this.middlewares.push({ path: "*", handler: path });
    } else if (middleware) {
      this.middlewares.push({ path, handler: middleware });
    }
  }

  /**
   * Zod validation middleware
   * @param target The part of the request to validate (json, query, header, param)
   * @param schema The Zod schema to validate against
   */
  static zValidator<S extends z.ZodTypeAny, Env = unknown, Ctx = ExecutionContext>(
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
        return ctx.json(
          {
            error: "Validation failed",
            target,
            issues: result.error.issues,
          },
          { status: 400 },
        );
      }

      // Store validated data in context
      (ctx as any)[`valid${target.charAt(0).toUpperCase() + target.slice(1)}`] = result.data;

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
    const matchedMiddlewares = this.middlewares.filter((m) => this.matchPath(m.path, pathname));

    let index = 0;

    const next: Next = async () => {
      if (index < matchedMiddlewares.length) {
        const middleware = matchedMiddlewares[index++];
        return await middleware.handler(request, env, ctx, next);
      }
      return await finalHandler();
    };

    return await next();
  }

  on(method: string, path: string, ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]) {
    this.addRoute(method, path, handlers);
  }

  get(path: string, ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]) {
    this.on("GET", path, ...handlers);
  }

  post(path: string, ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]) {
    this.on("POST", path, ...handlers);
  }

  put(path: string, ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]) {
    this.on("PUT", path, ...handlers);
  }

  delete(path: string, ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]) {
    this.on("DELETE", path, ...handlers);
  }

  patch(path: string, ...handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[]) {
    this.on("PATCH", path, ...handlers);
  }

  openapi<T extends RouteConfig>(config: T, handler: RouteHandler<Env, Ctx>) {
    // Transform {id} to :id for the router
    const routingPath = config.path.replace(/{([^}]+)}/g, ":$1");

    const handlers: (Middleware<Env, Ctx> | RouteHandler<Env, Ctx>)[] = [];

    // Apply automatic validation middleware based on config
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
        Router.zValidator("json", config.request.body.content["application/json"].schema),
      );
    }

    handlers.push(handler);

    this.on(config.method.toUpperCase(), routingPath, ...handlers);

    // Register in OpenAPI
    this.registerOpenApiRoute(config);
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

  getOpenApiDocument(info: { title: string; version: string; description?: string }): any {
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
    // The path passed here should already be decoded and NFC normalized
    let truePath = path;
    if (!this.strict && truePath.length > 1 && truePath.endsWith("/")) {
      truePath = truePath.slice(0, -1);
    }

    const trueParts = splitPath(truePath);

    let node = this.root;
    const params: Record<string, string> = Object.create(null);

    for (let i = 0; i < trueParts.length; i++) {
      const part = trueParts[i];

      // Priority: Exact match > Parameter > Wildcard
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
        // Wildcard matches ALL remaining segments
        params["*"] = trueParts.slice(i).join("/");
        node = wildcardChild;
        break; // Exit loop as wildcard is terminal
      } else {
        return null;
      }
    }

    const handler = node.methodHandlers[method.toUpperCase()] as RouteHandler<Env, Ctx> | undefined;
    return handler ? { handler, params } : null;
  }

  async handle(request: Request, env: Env, executionCtx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Decode the path safely and normalize
    const decodedPath = tryDecode(url.pathname).normalize("NFC");

    // DoS Protection: Limit path segments
    try {
      splitPath(decodedPath);
    } catch (e: any) {
      return new Response(e.message, { status: 414 });
    }

    if (!isValidPath(decodedPath)) {
      return new Response("Malformed Path", { status: 400 });
    }

    // We use the original url.pathname for routing to preserve trailing slash behavior
    // but normalize it for matching consistency.
    const _pathname = url.pathname;

    const responseHeaders = new Headers();

    const ctx: RouterContext<Env, Ctx> = {
      params: Object.create(null),
      query: Object.create(null),
      headers: Object.create(null),
      env,
      executionCtx,
      json: (data, init) => {
        const headers = new Headers(init?.headers);
        responseHeaders.forEach((v, k) => headers.append(k, v));
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify(data), { ...init, headers });
      },
      text: (data, init) => {
        const headers = new Headers(init?.headers);
        responseHeaders.forEach((v, k) => headers.append(k, v));
        return new Response(data, { ...init, headers });
      },
      html: (data, init) => {
        const headers = new Headers(init?.headers);
        responseHeaders.forEach((v, k) => headers.append(k, v));
        headers.set("Content-Type", "text/html; charset=utf-8");
        return new Response(data, { ...init, headers });
      },
      redirect: (url, status = 302) => Response.redirect(url, status),
      cache: (seconds) => {
        responseHeaders.set("Cache-Control", `public, max-age=${seconds}`);
      },
      parseJson: async () => {
        try {
          return await request.json();
        } catch {
          return null;
        }
      },
    };

    // Populate hardened query and headers
    url.searchParams.forEach((v, k) => {
      ctx.query[k] = v;
    });
    request.headers.forEach((v, k) => {
      ctx.headers[k] = v;
    });

    // Handle CORS preflight automatically if CORS middleware is used
    if (request.method === "OPTIONS") {
      const pathname =
        url.pathname === "/" || !url.pathname.endsWith("/")
          ? url.pathname
          : url.pathname.slice(0, -1);
      const _preflightHeaders = new Headers();
      const _matchedCORS = this.middlewares.filter(
        (m) => m.path === "*" || this.matchPath(m.path, pathname),
      );
      // Note: This logic depends on the specific CORS middleware implementation below
    }

    try {
      return await this.applyMiddleware(request, env, ctx, async () => {
        const routeMatch = this.findRoute(method, decodedPath);
        if (routeMatch) {
          const { handler, params } = routeMatch;
          ctx.params = params;
          return await handler(request, env, ctx);
        }

        return new Response(`"${decodedPath}" not found`, {
          status: 404,
          statusText: "Not Found",
        });
      });
    } catch (err) {
      if (this.errorHandler) {
        return await this.errorHandler(err, request, env, ctx);
      }
      console.error(err);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
}
