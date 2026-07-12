/**
 * noware-serializers - Serializers
 *
 * Standard Gauge: Serializers (Tier 1)
 *
 * Connection: Serialize/deserialize data
 */

import type { EnvLike, SerializerContext, RequestLike } from "@nowarelabs/shared";

export class Serializer {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: SerializerContext,
  ) {}

  serialize(data: unknown): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): unknown {
    return JSON.parse(data);
  }
}

export class BaseSerializer<
  Ctx extends SerializerContext = SerializerContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Model = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}
