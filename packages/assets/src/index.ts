/**
 * noware-assets - AssetPipeline
 *
 * Standard Gauge: Asset pipeline (Tier 1 - infrastructure)
 *
 * Connection: This package provides assets to views
 *
 * Static Plugin Points:
 * - loaders: Record<string, LoaderFunction>
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseAsset<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
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
}
