/**
 * noware-aggregates - BaseAggregate
 *
 * Standard Gauge: Event Sourcing Consistency Boundary (Tier 2)
 *
 * Connection Flow:
 * BaseService → BaseAggregate → EventStore
 *
 * Connection: This layer → EventStore (ONE call only)
 *
 * Static Plugin Points:
 * - commandHandlers: Array<(aggregate, command) => void>
 * - eventAppliers: Array<(event) => void>
 */

import type {
  EnvLike,
  AggregateContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export abstract class BaseAggregate<
  Ctx extends AggregateContext = AggregateContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Event = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseAggregate>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseAggregate>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseAggregate>(fn: AroundHookFunction<T>, options?: HookOptions): void {
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

  protected abstract event: Event;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
  protected abstract getEvent(): Event;
}
