/**
 * noware-dtos - Data Transfer Objects
 *
 * Standard Gauge: DTOs (Tier 3)
 *
 * Connection: Define data transfer structures
 */

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

export abstract class Dto {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: ContextLike,
  ) {}

  toJSON(): Record<string, unknown> {
    return {};
  }

  static fromJSON(data: Record<string, unknown>): Dto {
    return new Dto();
  }
}

export class BaseDto<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
}
