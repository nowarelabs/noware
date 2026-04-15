/**
 * noware-modules - BaseModule
 *
 * Standard Gauge: Bounded Context Container (Tier 2)
 *
 * Connection Flow:
 * BaseContext → BaseModule → BaseFeatureHandler
 *
 * Connection: This layer → BaseFeatureHandler (ONE call only)
 *
 * Static Plugin Points:
 * - handlers: Map<string, BaseFeatureHandler>
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export abstract class BaseModule<
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
