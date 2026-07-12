import type {
  EnvLike,
  RouterContext,
  RequestLike,
  ContextLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { runBeforeHooks, runAfterHooks, runAroundHooks } from "@nowarelabs/shared";

interface ControllerLike {
  run(action: string, ...args: any[]): Promise<Response>;
}

export interface RouteResult<
  Req extends RequestLike = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends ContextLike = ContextLike,
> {
  Controller: new (request: Req, env: Env, ctx: Ctx) => ControllerLike;
  action: string;
  params: Record<string, string>;
}

export abstract class BaseRouter<
  Ctx extends RouterContext = RouterContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseRouter>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseRouter>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseRouter>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  abstract resolveRoute(request: Req): RouteResult<Req, Env, Ctx> | null;

  async handle(request: Req, env: Env, ctx: Ctx): Promise<Response> {
    const Ctor = this.constructor as typeof BaseRouter;

    const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

    const beforeResult = await runBeforeHooks(this, Ctor.beforeHooks, shouldRunHook);
    if (beforeResult) return beforeResult;

    const response = await runAroundHooks(
      this,
      Ctor.aroundHooks,
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

    return await runAfterHooks(this, Ctor.afterHooks, response, shouldRunHook);
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }
}
