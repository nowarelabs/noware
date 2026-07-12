/**
 * noware-persistence - BasePersistence
 *
 * Standard Gauge: Persistence layer (P in RCSM)
 *
 * Connection Flow:
 * BaseModel → BasePersistence → Database
 *
 * Connection: This layer → Database (Tier 1 - external)
 *
 * Static Plugin Points:
 * - migrations: Migration[]
 * - dialects: Record<string, Dialect>
 */

import type { EnvLike, PersistenceContext, RequestLike } from "@nowarelabs/shared";

export class BasePersistence<
  Ctx extends PersistenceContext = PersistenceContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected db: unknown;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}
