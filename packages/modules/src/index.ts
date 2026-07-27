/**
 * noware-modules - BaseModule
 *
 * Standard Gauge: Bounded Context Container (Tier 2)
 *
 * Connection Flow:
 * BaseContext → BaseModule → BaseFeatureHandler
 *
 * Connection: This layer → BaseFeatureHandler (ONE call only)
 *
 * Static Plugin Points:
 * - handlers: Map<string, BaseFeatureHandler>
 */

import type {
  EnvLike,
  ModuleContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { Logger } from "@nowarelabs/telemetry";

export abstract class BaseModule<
  Ctx extends ModuleContext = ModuleContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
  Feature = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseModule>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseModule>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseModule>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  protected abstract feature: Feature;

  protected logger!: Logger;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {
    this.logger = new Logger(request, env, ctx as any, { service: this.constructor.name });
  }
  protected abstract getFeature(): Feature;
}
