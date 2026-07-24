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
import { Logger } from "@nowarelabs/telemetry";

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
  protected logger: Logger;

  constructor(
    protected request: Req,
    protected env: Env,
    protected ctx: Ctx,
  ) {
    this.logger = new Logger(request, env, ctx, { service: this.constructor.name });
  }

  protected abstract getModel(): Model;

  static before<T extends BaseService>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseService>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseService>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  private static collectHooks(ctor: object, prop: string): RegisteredHook[] {
    const hooks: RegisteredHook[] = [];
    let current: any = ctor;
    while (current && current !== Function.prototype) {
      if (Object.hasOwn(current, prop)) {
        hooks.unshift(...current[prop]);
      }
      current = Object.getPrototypeOf(current);
    }
    return hooks;
  }

  async run<T = unknown>(action: string, ...args: any[]): Promise<T> {
    return this.logger.span(`${this.constructor.name}.${action}`, async () => {
      this.logger.info(`${action} started`);
      const start = performance.now();

      const Ctor = this.constructor;
      const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

      const beforeResult = await runBeforeHooks(
        this,
        BaseService.collectHooks(Ctor, "beforeHooks"),
        shouldRunHook,
      );
      if (beforeResult) return beforeResult as T;

      try {
        const result = await runAroundHooks(
          this,
          BaseService.collectHooks(Ctor, "aroundHooks"),
          async () => {
            const handler = (this as Record<string, unknown>)[action];
            if (typeof handler !== "function") {
              throw new Error(`Service action '${action}' not found`);
            }
            return await (handler as (...args: any[]) => Promise<T>).call(this, ...args);
          },
          shouldRunHook,
        );

        const afterResult = await runAfterHooks(
          this,
          BaseService.collectHooks(Ctor, "afterHooks"),
          result,
          shouldRunHook,
        );

        const duration = performance.now() - start;
        this.logger.debug(`${action} completed`);
        this.logger.counter(`${this.constructor.name}.${action}.success`);
        this.logger.histogram(`${this.constructor.name}.${action}.duration_ms`, duration);
        return afterResult as T;
      } catch (error) {
        const duration = performance.now() - start;
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`${action} failed`, { duration_ms: duration }, err);
        this.logger.counter(`${this.constructor.name}.${action}.error`);
        throw error;
      }
    });
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }
}
