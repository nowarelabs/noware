/**
 * noware-gateways - Gateway Implementations
 *
 * Standard Gauge: Gateways (port implementations)
 *
 * Connection: Implements Port interfaces from noware-ports
 */

import type { EnvLike, GatewayContext, RequestLike } from "@nowarelabs/shared";

export class BaseGateway<
  Ctx extends GatewayContext = GatewayContext,
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
