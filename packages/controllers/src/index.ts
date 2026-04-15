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

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export abstract class BaseController<
  Ctx extends ContextLike = ContextLike,
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
    protected ctx: ContextLike,
  ) {}
  protected abstract getService(): Service;
}

