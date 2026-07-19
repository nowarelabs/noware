import type {
  EnvLike,
  PluginContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export interface Plugin {
  name: string;
  install(): void;
}

interface ActionFilter {
  only?: string[];
  except?: string[];
}

function hookAppliesToAction(action: string, options?: HookOptions): boolean {
  const filter = options as ActionFilter | undefined;
  if (!filter) return true;
  if (filter.only && !filter.only.includes(action)) return false;
  if (filter.except && filter.except.includes(action)) return false;
  return true;
}

export class BasePlugin<
  Ctx extends PluginContext = PluginContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> implements Plugin {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BasePlugin>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BasePlugin>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BasePlugin>(fn: AroundHookFunction<T>, options?: HookOptions): void {
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

  static pluginName?: string;

  static named(name: string): void {
    this.pluginName = name;
  }

  get name(): string {
    return (this.constructor as typeof BasePlugin).pluginName ?? this.constructor.name;
  }

  protected async runAction<R>(action: string, fn: (this: this) => R | Promise<R>): Promise<R> {
    const ctor = this.constructor as typeof BasePlugin;

    const beforeHooks = BasePlugin.collectHooks(ctor, "beforeHooks").filter((hook) =>
      hookAppliesToAction(action, hook.options),
    );
    const aroundHooks = BasePlugin.collectHooks(ctor, "aroundHooks").filter((hook) =>
      hookAppliesToAction(action, hook.options),
    );
    const afterHooks = BasePlugin.collectHooks(ctor, "afterHooks").filter((hook) =>
      hookAppliesToAction(action, hook.options),
    );

    for (const hook of beforeHooks) {
      await (hook.fn as HookFunction<this>)(this);
    }

    const core = (): Promise<R> => Promise.resolve(fn.call(this));

    const dispatch = aroundHooks.reduceRight<() => Promise<R>>(
      (next, hook) => () =>
        Promise.resolve(
          (hook.fn as AroundHookFunction<this>)(this, next as () => Promise<unknown>),
        ) as Promise<R>,
      core,
    );

    let result = await dispatch();

    for (const hook of afterHooks) {
      const returned = await (hook.fn as AfterHookFunction<this>)(this, result);
      if (returned !== undefined) result = returned as Awaited<R>;
    }

    return result;
  }

  async install(): Promise<void> {
    await this.runAction("install", () => this.setup());
  }

  protected async setup(): Promise<void> {}

  constructor(
    protected request: Request,
    protected env: Env,
    protected ctx: Ctx,
  ) {}
}
