/**
 * noware-services - BaseService
 *
 * Standard Gauge: Service layer (S in RCSM)

 */

import type { EnvLike, ServiceContext, RequestLike } from "@nowarelabs/shared";

export abstract class BaseService<
  Ctx extends ServiceContext = ServiceContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Model = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected abstract model: Model;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
  protected abstract getModel(): Model;
}
