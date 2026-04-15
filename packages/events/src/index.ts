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
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseEvent<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected request: RequestLike;
  protected env: EnvLike;
  protected ctx: ContextLike;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
}
