/**
 * noware-formatters - BaseFormatter
 *
 * Standard Gauge: Formatter (middleware)
 *
 * Connection: Used by controllers to format output
 */

import type { EnvLike, FormatterContext, RequestLike } from "@nowarelabs/shared";

export class BaseFormatter<
  Ctx extends FormatterContext = FormatterContext,
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
