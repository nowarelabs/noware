/**
 * noware-durable-objects - DurableObject Utilities
 *
 * Standard Gauge: Durable Object Utilities (Tier 1)
 *
 * Connection: Used for Cloudflare Durable Objects
 *
 * Note: This package is Cloudflare-specific due to DurableObjectState.
 * Other types use noware-shared for runtime-agnostic compatibility.
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseDurableObject<
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
