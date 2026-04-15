/**
 * noware-gateways - Gateway Implementations
 *
 * Standard Gauge: Gateways (port implementations)
 *
 * Connection: Implements Port interfaces from noware-ports
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseGateway<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected request: RequestLike;
  protected env: EnvLike;
  protected ctx: ContextLike;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}
}
