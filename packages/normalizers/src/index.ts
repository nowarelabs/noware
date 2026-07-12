/**
 * noware-normalizers - BaseNormalizer
 *
 * Standard Gauge: Normalizer (middleware)
 *
 * Connection: Used by controllers to normalize input
 */

import type { EnvLike, NormalizerContext, RequestLike } from "@nowarelabs/shared";

export class BaseNormalizer<
  Ctx extends NormalizerContext = NormalizerContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}
