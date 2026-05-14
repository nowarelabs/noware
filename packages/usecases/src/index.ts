/**
 * noware-usecases - BaseUsecase
 *
 * Standard Gauge: Usecase Orchestration Layer (can call multiple RCSM chains)
 *
 * Connection Flow:
 * BaseUsecase → BaseRpc[] (multiple RCSM chains allowed)
 *
 * Static Plugin Points:
 * - rpcs: Map<string, BaseRpc>
 */

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

export abstract class BaseUsecase<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Rpc = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected abstract rpc: Rpc;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
  protected abstract getRpc(): Rpc;
}
