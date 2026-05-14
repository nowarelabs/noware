/**
 * noware-migrations - Migration
 *
 * Standard Gauge: Migration System (Tier 1)
 *
 * Connection: Used by BasePersistence for schema changes
 */

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

export abstract class Migration {
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

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}

export class BaseMigration<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
}
