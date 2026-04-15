/**
 * noware-maintenance - Maintenance Utilities
 *
 * Standard Gauge: Maintenance (Tier 1)
 *
 * Connection: System health checks, cleanup
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseMaintenance<
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
