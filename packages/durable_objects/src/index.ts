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

import type { EnvLike, DurableObjectContext, RequestLike } from "@nowarelabs/shared";

export type DurableObjectState = {
  id: {
    name: string;
    toString(): string;
  };
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    list<T>(options?: {
      prefix?: string;
      limit?: number;
    }): Promise<{ keys: Array<{ name: string }> }>;
  };
};

export class BaseDurableObject<
  Ctx extends DurableObjectContext = DurableObjectContext,
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
