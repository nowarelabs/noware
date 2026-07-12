/**
 * noware-domains - Domain Types
 *
 * Standard Gauge: Domain Types (Tier 3)
 *
 * Connection: Defines core domain types
 */

import type { EnvLike, DomainContext, RequestLike } from "@nowarelabs/shared";

export class BaseDomain<
  Ctx extends DomainContext = DomainContext,
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
