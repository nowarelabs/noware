/**
 * noware-rpc - BaseRpc
 *
 * Standard Gauge: RPC  (Tier 2)
 *
 * Connection Flow:
 * BaseRpc → BaseFeatureHandler → BaseController
 *
 * Connection: This layer → BaseFeatureHandler (ONE call only)
 *
 * Static Plugin Points:
 * - handlers: Map<string, BaseFeatureHandler>
 */

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

export abstract class BaseRpc<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Feature = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected abstract feature: Feature;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
  protected abstract getFeature(): Feature;
}

export abstract class BaseRpcServer extends BaseRpc {
  static handlers: Map<string, unknown> = new Map();

  async handle(_request: RequestLike): Promise<Response> {
    throw new Error("Not implemented");
  }
}
