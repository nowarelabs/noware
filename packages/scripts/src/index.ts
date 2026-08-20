/**
 * noware-scripts - Build Scripts
 *
 * Standard Gauge: Build Scripts (Tier 0)
 *
 * Connection: CLI tools for project setup
 */

import type {
  EnvLike,
  ScriptContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export const GENERATORS = {
  controller: (_name: string) => `// Controller template`,
  service: (_name: string) => `// Service template`,
  model: (_name: string) => `// Model template`,
};

export class ScriptRunner {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: ScriptContext,
  ) {}
}

export class BaseScript<
  Ctx extends ScriptContext = ScriptContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
  _Model = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseScript>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseScript>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseScript>(fn: AroundHookFunction<T>, options?: HookOptions): void {
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
