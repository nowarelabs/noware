/**
 * noware-ports - Port Interfaces
 *
 * Standard Gauge: Ports (abstraction layer)
 *
 * Connection: Defines interfaces that gateways must implement
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BasePort<
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
