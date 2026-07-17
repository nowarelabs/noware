/**
 * noware-rpc - BaseRpc
 *
 * Standard Gauge: RPC  (Tier 2)
 *
 * Connection Flow:
 * BaseRpc → BaseFeatureHandler → BaseController
 *
 * Connection: This layer → BaseFeatureHandler (ONE call only)
 *
 * Static Plugin Points:
 * - handlers: Map<string, BaseFeatureHandler>
 */

import type {
  EnvLike,
  RpcContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export abstract class BaseRpc<
  Ctx extends RpcContext = RpcContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Feature = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseRpc>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseRpc>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseRpc>(fn: AroundHookFunction<T>, options?: HookOptions): void {
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

  protected abstract feature: Feature;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
  protected abstract getFeature(): Feature;
}

export abstract class BaseRpcServer extends BaseRpc {
  static handlers: Map<string, unknown> = new Map();

  async handle(_request: RequestLike): Promise<Response> {
    throw new Error("Not implemented");
  }
}
