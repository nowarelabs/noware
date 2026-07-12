/**
 * noware-validators - BaseValidator
 *
 * Standard Gauge: Validator (middleware)
 *
 * Connection: Used by controllers to validate input
 */

import type { EnvLike, ValidatorContext, RequestLike } from "@nowarelabs/shared";

export class BaseValidator<
  Ctx extends ValidatorContext = ValidatorContext,
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
