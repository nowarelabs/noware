/**
 * noware-contexts - BaseContext
 *
 * Standard Gauge: Bounded Context Container (Tier 2)
 *
 * Connection Flow:
 * BaseContext → BaseModule (multiple allowed)
 *
 * Connection: This layer → BaseModule[] (multiple allowed)
 *
 * Static Plugin Points:
 * - modules: Map<string, BaseModule>
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseContext<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Module = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected request: RequestLike;
  protected env: EnvLike;
  protected ctx: ContextLike;

  protected abstract module: Module;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: ContextLike,
  ) {}

  protected abstract getModule(): Module;
}

