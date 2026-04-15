/**
 * noware-router - BaseRouter
 *
 * Standard Gauge: Router (Tier 2)
 *
 * Connection Flow:
 * BaseRouter → BaseRpcServer → BaseFeatureHandler
 *
 * Connection: This layer → BaseRpcServer (ONE call only)
 *
 * Static Plugin Points:
 * - routes: RouteConfig[]
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseRouter<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Rpc = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected request: RequestLike;
  protected env: EnvLike;
  protected ctx: ContextLike;

  protected abstract rpc: Rpc;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}

  protected abstract getRpc(): Rpc;
}
