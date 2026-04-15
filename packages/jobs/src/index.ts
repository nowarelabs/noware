/**
 * noware-jobs - JobDispatcher
 *
 * Standard Gauge: Background Jobs (Tier 2)
 *
 * Connection: Dispatches jobs to BaseJob handlers
 *
 * Static Plugin Points:
 * - jobs: Map<string, JobHandler>
 */

import type {
  EnvLike,
  ContextLike,
  RequestLike
} from "noware-shared";

export class BaseJob<
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
