import type {
  EnvLike,
  ServiceContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { runBeforeHooks, runAfterHooks, runAroundHooks } from "@nowarelabs/shared";

export abstract class BaseService<
  Ctx extends ServiceContext = ServiceContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
  Model = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected abstract model: Model;

  constructor(
    protected request: Req,
    protected env: Env,
    protected ctx: Ctx,
  ) {}

  protected abstract getModel(): Model;

  static before<T extends BaseService>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseService>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseService>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  async execute<T = unknown>(action: string, ...args: any[]): Promise<T> {
    const Ctor = this.constructor as typeof BaseService;
    const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

    await runBeforeHooks(this, Ctor.beforeHooks, shouldRunHook);

    const result = await runAroundHooks(
      this,
      Ctor.aroundHooks,
      async () => {
        const handler = (this as Record<string, unknown>)[action];
        if (typeof handler !== "function") {
          throw new Error(`Service action '${action}' not found`);
        }
        return await (handler as (...args: any[]) => Promise<T>).call(this, ...args);
      },
      shouldRunHook,
    );

    const afterResult = await runAfterHooks(this, Ctor.afterHooks, result, shouldRunHook);
    return afterResult as T;
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }
}
