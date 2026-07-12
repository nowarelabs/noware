import type { ContextLike, EnvLike, RequestLike } from "./shared.ts";

export interface FeatureContext<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  env: Env;
  ctx: Ctx;
  request: Request;
  metadata?: Record<string, unknown>;
}
