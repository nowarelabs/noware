/**
 * noware-adapters - Adapters
 */

import type { EnvLike, ContextLike, RequestLike } from "noware-shared";

export class BaseAdapter<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];
  static aroundHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
}
