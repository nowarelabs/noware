/**
 * noware-scripts - Build Scripts
 *
 * Standard Gauge: Build Scripts (Tier 0)
 *
 * Connection: CLI tools for project setup
 */

import type { EnvLike, ScriptContext, RequestLike } from "@nowarelabs/shared";

export const GENERATORS = {
  controller: (name: string) => `// Controller template`,
  service: (name: string) => `// Service template`,
  model: (name: string) => `// Model template`,
};

export class ScriptRunner {
  constructor(
    protected request?: RequestLike,
    protected env?: EnvLike,
    protected ctx?: ScriptContext,
  ) {}
}

export class BaseScript<
  Ctx extends ScriptContext = ScriptContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
  Model = unknown,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}
