import type {
  EnvLike,
  RouterContext,
  RequestLike,
  RouterLike,
  ControllerLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { runBeforeHooks, runAfterHooks, runAroundHooks } from "@nowarelabs/shared";
import { Logger } from "@nowarelabs/logger";

export interface RouteResult<
  Req extends RequestLike = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends RouterContext = RouterContext,
> {
  Controller: new (request: Req, env: Env, ctx: Ctx) => ControllerLike;
  action: string;
  params: Record<string, string>;
}

export type MiddlewareFn<
  Req extends RequestLike = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends RouterContext = RouterContext,
> = (
  request: Req,
  env: Env,
  ctx: Ctx,
  next: () => Promise<Response>,
) => Promise<Response> | Response;

export interface RouterPlugin<
  Req extends RequestLike = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends RouterContext = RouterContext,
> {
  name: string;
  install(router: BaseRouter<Ctx, Env, Req>): void;
}

export interface RouteDrawerEntry {
  method: string;
  path: string;
  controller: string;
  action: string;
}

export class RouteDrawer {
  private entries: RouteDrawerEntry[] = [];

  add(method: string, path: string, controller: string, action: string): void {
    this.entries.push({ method, path, controller, action });
  }

  getEntries(): RouteDrawerEntry[] {
    return [...this.entries];
  }

  toString(): string {
    if (this.entries.length === 0) return "";

    const maxMethod = Math.max(...this.entries.map((e) => e.method.length));
    const maxPath = Math.max(...this.entries.map((e) => e.path.length));
    const maxController = Math.max(...this.entries.map((e) => e.controller.length));

    return [
      `${"Method".padEnd(maxMethod)}  ${"Path".padEnd(maxPath)}  ${"Controller".padEnd(maxController)}  Action`,
      `${"-".repeat(maxMethod)}  ${"-".repeat(maxPath)}  ${"-".repeat(maxController)}  ${"-".repeat(10)}`,
      ...this.entries
        .sort((a, b) => a.path.localeCompare(b.path))
        .map(
          (e) =>
            `${e.method.padEnd(maxMethod)}  ${e.path.padEnd(maxPath)}  ${e.controller.padEnd(maxController)}  ${e.action}`,
        ),
    ].join("\n");
  }
}

export abstract class BaseRouter<
  Ctx extends RouterContext = RouterContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
> implements RouterLike<Req, Env, Ctx> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before(fn: HookFunction<BaseRouter>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after(fn: AfterHookFunction<BaseRouter>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around(fn: AroundHookFunction<BaseRouter>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  private static collectHooks(ctor: object, prop: string): RegisteredHook[] {
    const hooks: RegisteredHook[] = [];
    let current: any = ctor;
    while (current && current !== Function.prototype) {
      if (Object.hasOwn(current, prop)) {
        hooks.unshift(...current[prop]);
      }
      current = Object.getPrototypeOf(current);
    }
    return hooks;
  }

  private middleware: MiddlewareFn[] = [];
  private plugins: RouterPlugin[] = [];
  public drawer = new RouteDrawer();
  public logger?: Logger;

  use(...fns: MiddlewareFn[]): this {
    this.middleware.push(...fns);
    return this;
  }

  applyMiddleware(...fns: MiddlewareFn[]): this {
    this.middleware.unshift(...fns);
    return this;
  }

  plugin(...plugins: RouterPlugin[]): this {
    for (const p of plugins) {
      p.install(this as any);
      this.plugins.push(p);
    }
    return this;
  }

  withLogger(logger: Logger): this {
    this.logger = logger;
    return this;
  }

  abstract resolveRoute(request: Req): RouteResult<Req, Env, Ctx> | null;

  async handle(request: Req, env: Env, ctx: Ctx): Promise<Response> {
    const Ctor = this.constructor;
    const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

    const beforeResult = await runBeforeHooks(
      this,
      BaseRouter.collectHooks(Ctor, "beforeHooks"),
      shouldRunHook,
    );
    if (beforeResult) return beforeResult;

    const response = await runAroundHooks(
      this,
      BaseRouter.collectHooks(Ctor, "aroundHooks"),
      async () => {
        const route = this.resolveRoute(request);
        if (!route) return new Response("Not Found", { status: 404 });

        const { Controller: ControllerClass, action, params } = route;
        const controllerCtx: Ctx = { ...ctx, params };

        const controller = new ControllerClass(request, env, controllerCtx);

        const enrichedCtx = controllerCtx as Ctx & { logger?: Logger };
        if (this.logger) {
          const req = request as unknown as Request;
          enrichedCtx.logger = this.logger.withContext({
            controller: ControllerClass.name,
            action,
            method: req.method,
            path: new URL(req.url).pathname,
          });
        }

        const handler = async (): Promise<Response> => {
          return await controller.run(action);
        };

        let chain = handler;
        for (let i = this.middleware.length - 1; i >= 0; i--) {
          const mw = this.middleware[i];
          const next = chain;
          chain = async () => await mw(request, env, controllerCtx, next);
        }

        return await chain();
      },
      shouldRunHook,
    );

    return await runAfterHooks(
      this,
      BaseRouter.collectHooks(Ctor, "afterHooks"),
      response,
      shouldRunHook,
    );
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }
}

class RouterTrieNode {
  children = new Map<string, RouterTrieNode>();
  paramName?: string;
  wildcardName?: string;
  entry?: RouteEntry;
}

interface RouteEntry {
  pattern: string;
  paramNames: string[];
  Controller: new (request: any, env: any, ctx: any) => ControllerLike;
  action: string;
}

function normalizePath(path: string): string {
  const normalized = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function extractParamNames(pattern: string): string[] {
  const params: string[] = [];
  for (const segment of pattern.split("/")) {
    if (segment.startsWith(":")) {
      params.push(segment.slice(1));
    } else if (segment.startsWith("*")) {
      params.push(segment.slice(1));
    }
  }
  return params;
}

function insertTrie(root: RouterTrieNode, entry: RouteEntry): void {
  const segments = entry.pattern.split("/").filter(Boolean);
  let node = root;
  for (const segment of segments) {
    if (segment.startsWith(":")) {
      if (!node.children.has(":")) {
        const child = new RouterTrieNode();
        child.paramName = segment.slice(1);
        node.children.set(":", child);
      }
      node = node.children.get(":")!;
    } else if (segment.startsWith("*")) {
      if (!node.children.has("*")) {
        const child = new RouterTrieNode();
        child.wildcardName = segment.slice(1) || "*";
        node.children.set("*", child);
      }
      node = node.children.get("*")!;
    } else {
      if (!node.children.has(segment)) {
        node.children.set(segment, new RouterTrieNode());
      }
      node = node.children.get(segment)!;
    }
  }
  node.entry = entry;
}

function matchTrie(
  node: RouterTrieNode,
  segments: string[],
  depth: number,
): { entry: RouteEntry; params: Record<string, string> } | null {
  if (depth === segments.length) {
    if (node.entry) return { entry: node.entry, params: {} };
    return null;
  }

  const segment = segments[depth];

  const wildcardChild = node.children.get("*");
  if (wildcardChild && wildcardChild.entry) {
    const remaining = segments.slice(depth).join("/");
    return {
      entry: wildcardChild.entry,
      params: { [wildcardChild.wildcardName!]: remaining },
    };
  }

  if (node.children.has(segment)) {
    const result = matchTrie(node.children.get(segment)!, segments, depth + 1);
    if (result) return result;
  }

  const paramChild = node.children.get(":");
  if (paramChild && paramChild.paramName) {
    const result = matchTrie(paramChild, segments, depth + 1);
    if (result) {
      result.params[paramChild.paramName] = segment;
      return result;
    }
  }

  return null;
}

export class HttpRouter<
  Ctx extends RouterContext = RouterContext,
  Env extends EnvLike = EnvLike,
> extends BaseRouter<Ctx, Env, Request> {
  private roots = new Map<string, RouterTrieNode>();

  private getRoot(method: string): RouterTrieNode {
    if (!this.roots.has(method)) {
      this.roots.set(method, new RouterTrieNode());
    }
    return this.roots.get(method)!;
  }

  route(
    method: string,
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    action: string,
  ): this {
    const normalized = normalizePath(path);
    const paramNames = extractParamNames(normalized);
    const entry: RouteEntry = { pattern: normalized, paramNames, Controller, action };

    insertTrie(this.getRoot(method), entry);

    const controllerName = Controller.name || "AnonymousController";
    this.drawer.add(method, normalized, controllerName, action);
    return this;
  }

  get(
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    action: string,
  ): this {
    return this.route("GET", path, Controller, action);
  }

  post(
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    action: string,
  ): this {
    return this.route("POST", path, Controller, action);
  }

  put(
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    action: string,
  ): this {
    return this.route("PUT", path, Controller, action);
  }

  patch(
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    action: string,
  ): this {
    return this.route("PATCH", path, Controller, action);
  }

  delete(
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    action: string,
  ): this {
    return this.route("DELETE", path, Controller, action);
  }

  resources(
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    options: { only?: string[]; except?: string[] } = {},
  ): this {
    const routes: Array<{ method: string; path: string; action: string }> = [
      { method: "GET", path, action: "index" },
      { method: "POST", path, action: "create" },
      { method: "GET", path: `${path}/new`, action: "new" },
      { method: "GET", path: `${path}/:id`, action: "show" },
      { method: "GET", path: `${path}/:id/edit`, action: "edit" },
      { method: "PUT", path: `${path}/:id`, action: "update" },
      { method: "PATCH", path: `${path}/:id`, action: "update" },
      { method: "DELETE", path: `${path}/:id`, action: "destroy" },
    ];

    const { only, except } = options;
    const filtered = routes.filter((r) => {
      if (only && !only.includes(r.action)) return false;
      if (except && except.includes(r.action)) return false;
      return true;
    });

    for (const r of filtered) {
      this.route(r.method, r.path, Controller, r.action);
    }
    return this;
  }

  resourceActions(
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    actions: Record<string, string>,
  ): this {
    for (const [action, method] of Object.entries(actions)) {
      const routePath = action === "index" ? path : `${path}/${action}`;
      this.route(method.toUpperCase(), routePath, Controller, action);
    }
    return this;
  }

  resolveRoute(request: Request): RouteResult<Request, Env, Ctx> | null {
    const method = request.method;
    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);
    const segments = pathname.split("/").filter(Boolean);

    const root = this.roots.get(method);
    if (!root) return null;

    const result = matchTrie(root, segments, 0);
    if (!result) return null;

    return {
      Controller: result.entry.Controller as new (
        request: Request,
        env: Env,
        ctx: Ctx,
      ) => ControllerLike,
      action: result.entry.action,
      params: result.params,
    };
  }
}
