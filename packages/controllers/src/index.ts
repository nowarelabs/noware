import type {
  EnvLike,
  ControllerContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { runBeforeHooks, runAfterHooks, runAroundHooks } from "@nowarelabs/shared";

function collectHooks(ctor: object, prop: string): RegisteredHook[] {
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

export abstract class BaseController<
  Ctx extends ControllerContext = ControllerContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
  Svc = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected abstract service: Svc;

  constructor(
    protected request: Req,
    protected env: Env,
    protected ctx: Ctx,
  ) {}

  protected abstract getService(): Svc;

  static before<T extends BaseController>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseController>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseController>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  async run(action: string, ...args: any[]): Promise<Response> {
    const Ctor = this.constructor;
    const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

    const instanceBefore = await this.beforeAction();
    if (instanceBefore) return instanceBefore;

    const beforeResult = await runBeforeHooks(
      this,
      collectHooks(Ctor, "beforeHooks"),
      shouldRunHook,
    );
    if (beforeResult) return beforeResult;

    const response = await runAroundHooks(
      this,
      collectHooks(Ctor, "aroundHooks"),
      async () => {
        const handler = (this as Record<string, unknown>)[action];
        if (typeof handler !== "function") {
          return new Response(`Action '${action}' not found`, { status: 404 });
        }
        return await (handler as (...args: any[]) => Promise<Response>).call(this, ...args);
      },
      shouldRunHook,
    );

    const afterResponse = await runAfterHooks(
      this,
      collectHooks(Ctor, "afterHooks"),
      response,
      shouldRunHook,
    );

    const instanceAfter = await this.afterAction(afterResponse);
    return instanceAfter ?? afterResponse;
  }

  protected async beforeAction(): Promise<Response | void> {}

  protected async afterAction(_result: Response): Promise<Response | void> {}

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }

  protected json(data: unknown, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(data), { ...init, headers });
  }

  protected html(content: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "text/html");
    return new Response(content, { ...init, headers });
  }

  protected text(content: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "text/plain");
    return new Response(content, { ...init, headers });
  }

  protected redirect(url: string, status: number = 302): Response {
    return new Response(null, { status, headers: { Location: url } });
  }

  protected unauthorized(message = "Unauthorized"): Response {
    return new Response(message, { status: 401 });
  }

  protected notFound(message = "Not Found"): Response {
    return new Response(message, { status: 404 });
  }

  protected badRequest(message = "Bad Request"): Response {
    return new Response(message, { status: 400 });
  }

  protected serverError(message = "Internal Server Error"): Response {
    return new Response(message, { status: 500 });
  }
}
