/**
 * noware-serializers - Serializers
 *
 * Standard Gauge: Serializers (Tier 1)
 *
 * Connection: Serialize/deserialize data
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseSerializer<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Model = unknown,
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
