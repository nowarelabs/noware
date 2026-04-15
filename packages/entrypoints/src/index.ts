/**
 * noware-entrypoints - BaseEntrypoint
 *
 * Standard Gauge: Worker Entry Point (Tier 2)
 *
 * Connection: Handles incoming requests, delegates to Router
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseEntrypoint<
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
