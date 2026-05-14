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

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

export class EventEmitter {
  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}

  on(event: string, handler: unknown): void {}
  emit(event: string, data: unknown): void {}
}

export class BaseEvent<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
}
