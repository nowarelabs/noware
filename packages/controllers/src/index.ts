/**
 * noware-controllers - BaseController
 *
 * Standard Gauge: Controller layer (C in RCSM)
 *
 * Connection Flow:
 * BaseRpc → BaseController → BaseService
 *
 * Connection: This layer → BaseService (RCSM - ONE call only)
 *
 * Static Plugin Points:
 * - beforeActions: HookConfig[]
 * - afterActions: HookConfig[]
 */

import type { EnvLike, ControllerContext, RequestLike } from "@nowarelabs/shared";

export abstract class BaseController<
  Ctx extends ControllerContext = ControllerContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Service = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected abstract service: Service;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
  protected abstract getService(): Service;
}
