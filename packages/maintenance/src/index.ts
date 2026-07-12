/**
 * noware-maintenance - Maintenance Utilities
 *
 * Standard Gauge: Maintenance (Tier 1)
 *
 * Connection: System health checks, cleanup
 */

import type { EnvLike, MaintenanceContext, RequestLike } from "@nowarelabs/shared";

export class Maintenance {
  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: MaintenanceContext,
  ) {}

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

export class BaseMaintenance<
  Ctx extends MaintenanceContext = MaintenanceContext,
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
