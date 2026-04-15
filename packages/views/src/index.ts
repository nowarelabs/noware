/**
 * noware-views - BaseView
 *
 * Standard Gauge: View/Template layer (Tier 3)
 *
 * Connection: This layer consumes assets from AssetPipeline
 *
 * Static Plugin Points:
 * - components: Map<string, ViewComponent>
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export abstract class BaseView<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Component = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];
 
  protected abstract component: Component;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}

  protected abstract getComponent(): Component;
}

