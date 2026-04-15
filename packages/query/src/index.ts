/**
 * noware-query - BaseQueryProjection
 *
 * Standard Gauge: CQRS Read Side (Tier 2)
 *
 * Connection Flow:
 * BaseRpcServer → BaseQuery → BasePersistence
 *
 * Connection: This layer → BasePersistence (RCSM - ONE call only)
 *
 * Static Plugin Points:
 * - eventHandlers: Array<(event) => void>
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export abstract class BaseQuery<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Persistence = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];
  
  protected abstract persistence: Persistence;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
  protected abstract getPersistence(): Persistence;
}
