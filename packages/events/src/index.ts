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

import type { EnvLike, EventContext, RequestLike } from "@nowarelabs/shared";

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
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}
