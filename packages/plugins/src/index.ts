/**
 * noware-plugins - Plugin Registry
 *
 * Standard Gauge: Plugin System (infrastructure)
 *
 * Connection: Extends functionality at static points
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BasePlugin<
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
