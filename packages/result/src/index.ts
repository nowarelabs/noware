/**
 * noware-result - Result Type
 *
 * Standard Gauge: Result Type (Tier 1 - infrastructure)
 *
 * Connection: Used by all layers for error handling
 */

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: string): Result<T> {
  return { ok: false, error };
}

export class ResultFactory {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: ContextLike,
  ) {}
}

export class BaseResult<
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
