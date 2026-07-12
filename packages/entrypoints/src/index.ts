import type {
  EnvLike,
  EntrypointContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import {
  runBeforeHooks,
  runAfterHooks,
  runAroundHooks,
  createRouterContext,
} from "@nowarelabs/shared";

interface RouterLike<
  Req extends RequestLike = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends EntrypointContext = EntrypointContext,
> {
  handle(request: Req, env: Env, ctx: Ctx): Promise<Response>;
}

export abstract class BaseEntrypoint<
  Ctx extends EntrypointContext = EntrypointContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  abstract router: RouterLike<Req, Env, Ctx>;

  static before<T extends BaseEntrypoint>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseEntrypoint>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseEntrypoint>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  async fetch(request: Req, env: Env, ctx: Ctx): Promise<Response> {
    const Ctor = this.constructor as typeof BaseEntrypoint;
    const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

    const beforeResult = await runBeforeHooks(this, Ctor.beforeHooks, shouldRunHook);
    if (beforeResult) return beforeResult;

    const response = await runAroundHooks(
      this,
      Ctor.aroundHooks,
      () => {
        const routerCtx = createRouterContext();
        Object.assign(routerCtx, ctx);
        return this.router.handle(request, env, routerCtx as unknown as Ctx);
      },
      shouldRunHook,
    );

    return await runAfterHooks(this, Ctor.afterHooks, response, shouldRunHook);
  }

  async handle(request: Req, env: Env, ctx: Ctx): Promise<Response> {
    return this.fetch(request, env, ctx);
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }
}
