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

import type { EnvLike, JobContext, RequestLike } from "@nowarelabs/shared";

export class BaseJob<
  Ctx extends JobContext = JobContext,
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
