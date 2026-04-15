/**
 * noware-sql - Query Builder
 *
 * Standard Gauge: SQL Builder (Tier 1)
 *
 * Connection: Used by BasePersistence for database queries
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseSql<
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
