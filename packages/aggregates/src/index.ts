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
import { Logger } from "@nowarelabs/telemetry";

export abstract class BaseAggregate<
  Ctx extends AggregateContext = AggregateContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
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

  protected abstract event: Event;

  protected logger!: Logger;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {
    this.logger = new Logger(request, env, ctx as any, { service: this.constructor.name });
  }
  protected abstract getEvent(): Event;
}
