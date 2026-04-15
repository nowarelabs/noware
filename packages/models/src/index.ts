/**
 * noware-models - BaseModel
 *
 * Standard Gauge: Model layer (M in RCSM)
 *
 * Connection Flow:
 * BaseService → BaseModel → BasePersistence
 *
 * Connection: This layer → BasePersistence (RCSM - ONE call only)
 *
 * Static Plugin Points:
 * - columnTypes: Record<string, string>
 * - relations: Record<string, RelationConfig>
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export abstract class BaseModel<
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
