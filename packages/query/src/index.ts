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

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";
import { Logger } from "@nowarelabs/telemetry";

export abstract class BaseQuery<
  Ctx extends ContextLike = ContextLike,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
  Persistence = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected abstract persistence: Persistence;

  protected logger!: Logger;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {
    this.logger = new Logger(request, env, ctx as any, { service: this.constructor.name });
  }
  protected abstract getPersistence(): Persistence;
}
