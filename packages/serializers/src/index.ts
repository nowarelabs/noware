/**
 * noware-serializers - Serializers
 *
 * Standard Gauge: Serializers (Tier 1)
 *
 * Connection: Serialize/deserialize data
 */

import type {
  EnvLike,
  SerializerContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export class Serializer {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: SerializerContext,
  ) {}

  serialize(data: unknown): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): unknown {
    return JSON.parse(data);
  }
}

export class BaseSerializer<
  Ctx extends SerializerContext = SerializerContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
  _Model = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseSerializer>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseSerializer>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseSerializer>(fn: AroundHookFunction<T>, options?: HookOptions): void {
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

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}
