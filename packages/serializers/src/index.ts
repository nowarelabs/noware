/**
 * noware-serializers - Serializers
 *
 * Standard Gauge: Serializers (Tier 1)
 *
 * Connection: Serialize/deserialize data
 */

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

export class Serializer {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: ContextLike,
  ) {}

  serialize(data: unknown): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): unknown {
    return JSON.parse(data);
  }
}

export class BaseSerializer<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Model = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
}
