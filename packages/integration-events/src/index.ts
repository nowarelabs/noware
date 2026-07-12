/**
 * noware-integration-events - Integration Events
 *
 * Standard Gauge: Integration Events (Tier 2)
 *
 * Connection: External system event handlers
 */

import type { EnvLike, IntegrationEventContext, RequestLike } from "@nowarelabs/shared";

export interface IntegrationEvent {
  type: string;
  payload: unknown;
  source: string;
  timestamp: Date;
}

export class BaseIntegrationEvent<
  Ctx extends IntegrationEventContext = IntegrationEventContext,
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
