import type { EnvLike, RouterContext, RequestLike } from "@nowarelabs/shared";

export abstract class BaseRouter<
  Ctx extends RouterContext = RouterContext,
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
