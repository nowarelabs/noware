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

import type { EnvLike, AggregateContext, RequestLike } from "@nowarelabs/shared";

export abstract class BaseAggregate<
  Ctx extends AggregateContext = AggregateContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Event = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected abstract event: Event;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
  protected abstract getEvent(): Event;
}
