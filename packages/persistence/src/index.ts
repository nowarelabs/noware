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

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BasePersistence<
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

