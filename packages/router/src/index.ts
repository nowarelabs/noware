import type {
  EnvLike,
  RouterContext,
  RequestLike,
  ContextLike,
  RouterLike,
  ControllerLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { runBeforeHooks, runAfterHooks, runAroundHooks } from "@nowarelabs/shared";

export interface RouteResult<
  Req extends RequestLike = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends RouterContext = RouterContext,
> {
  Controller: new (request: Req, env: Env, ctx: Ctx) => ControllerLike;
  action: string;
  params: Record<string, string>;
}

export abstract class BaseRouter<
  Ctx extends RouterContext = RouterContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
> implements RouterLike<Req, Env, Ctx> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseRouter>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseRouter>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseRouter>(fn: AroundHookFunction<T>, options?: HookOptions): void {
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
        const controllerCtx = Object.assign(ctx as ContextLike, { params });

        const controller = new ControllerClass(request, env, controllerCtx as Ctx);
        return await controller.run(action);
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

// ─── HttpRouter ────────────────────────────────────────────────────

interface RouteEntry {
  pattern: string;
  paramNames: string[];
  Controller: new (request: any, env: any, ctx: any) => ControllerLike;
  action: string;
}

function matchPath(
  pattern: string,
  paramNames: string[],
  pathname: string,
): Record<string, string> | null {
  const patternSegments = pattern.split("/");
  const pathSegments = pathname.split("/");

  if (patternSegments.length !== pathSegments.length) {
    if (pattern.endsWith("/*")) {
      const prefixSegments = patternSegments.slice(0, -1);
      if (pathSegments.length < prefixSegments.length) return null;
      for (let i = 0; i < prefixSegments.length; i++) {
        if (prefixSegments[i] !== pathSegments[i]) return null;
      }
      return {};
    }
    return null;
  }

  const params: Record<string, string> = {};
  let paramIdx = 0;

  for (let i = 0; i < patternSegments.length; i++) {
    const ps = patternSegments[i];
    const p = pathSegments[i];

    if (ps.startsWith(":")) {
      params[paramNames[paramIdx++]] = p;
    } else if (ps !== p) {
      return null;
    }
  }

  return params;
}

export class HttpRouter<
  Ctx extends RouterContext = RouterContext,
  Env extends EnvLike = EnvLike,
> extends BaseRouter<Ctx, Env, Request> {
  private routes = new Map<string, RouteEntry[]>();

  route(
    method: string,
    path: string,
    Controller: new (request: Request, env: Env, ctx: Ctx) => ControllerLike,
    action: string,
  ): this {
    const normalizedPath = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
    const paramNames: string[] = [];
    const segments = normalizedPath.split("/");
    for (const segment of segments) {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
      }
    }

    const entry: RouteEntry = { pattern: normalizedPath, paramNames, Controller, action };
    const methodRoutes = this.routes.get(method) ?? [];
    methodRoutes.push(entry);
    this.routes.set(method, methodRoutes);
    return this;
  }

  resolveRoute(request: Request): RouteResult<Request, Env, Ctx> | null {
    const method = request.method;
    const url = new URL(request.url);
    const pathname =
      url.pathname.endsWith("/") && url.pathname.length > 1
        ? url.pathname.slice(0, -1)
        : url.pathname;

    const methodRoutes = this.routes.get(method);
    if (!methodRoutes) return null;

    for (const entry of methodRoutes) {
      const params = matchPath(entry.pattern, entry.paramNames, pathname);
      if (params !== null) {
        return {
          Controller: entry.Controller as new (
            request: Request,
            env: Env,
            ctx: Ctx,
          ) => ControllerLike,
          action: entry.action,
          params,
        };
      }
    }

    return null;
  }
}
