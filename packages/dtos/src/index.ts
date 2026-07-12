/**
 * noware-dtos - Data Transfer Objects
 *
 * Standard Gauge: DTOs (Tier 3)
 *
 * Connection: Define data transfer structures
 */

import type { EnvLike, DtoContext, RequestLike } from "@nowarelabs/shared";

export abstract class Dto {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: DtoContext,
  ) {}

  toJSON(): Record<string, unknown> {
    return {};
  }

  static fromJSON(data: Record<string, unknown>): Dto {
    return new Dto();
  }
}

export class BaseDto<
  Ctx extends DtoContext = DtoContext,
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
