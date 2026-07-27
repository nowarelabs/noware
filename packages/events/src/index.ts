/**
 * noware-events - EventEmitter
 *
 * Standard Gauge: Event System (infrastructure)
 *
 * Connection: This package dispatches events to handlers
 *
 * Static Plugin Points:
 * - handlers: Map<string, EventHandler[]>
 */

import type {
  EnvLike,
  EventContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { Logger } from "@nowarelabs/telemetry";

export class EventEmitter {
  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: EventContext,
  ) {}

  on(event: string, handler: unknown): void {}
  emit(event: string, data: unknown): void {}
}

export class BaseEvent<
  Ctx extends EventContext = EventContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseEvent>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseEvent>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseEvent>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  protected logger!: Logger;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {
    this.logger = new Logger(request, env, ctx as any, { service: this.constructor.name });
  }
}
