import type {
  EnvLike,
  EntrypointContext,
  RouterLike,
  MessageHandlerLike,
  DurableObjectHandlerLike,
  GrpcHandlerLike,
  WorkflowStep,
  WorkflowHandlerLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

import {
  runBeforeHooks,
  runAfterHooks,
  runAroundHooks,
  createRouterContext,
} from "@nowarelabs/shared";

export abstract class BaseEntrypoint<
  TInput,
  TOutput,
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before(fn: HookFunction<BaseEntrypoint<any, any, any, any>>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after(
    fn: AfterHookFunction<BaseEntrypoint<any, any, any, any>>,
    options?: HookOptions,
  ): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around(
    fn: AroundHookFunction<BaseEntrypoint<any, any, any, any>>,
    options?: HookOptions,
  ): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  async handle(input: TInput, env: TEnv, ctx: TCtx): Promise<TOutput> {
    const Ctor = this.constructor;
    const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

    const beforeResult = await runBeforeHooks(
      this,
      BaseEntrypoint.collectHooks(Ctor, "beforeHooks"),
      shouldRunHook,
    );
    if (beforeResult) return beforeResult;

    const output = await runAroundHooks(
      this,
      BaseEntrypoint.collectHooks(Ctor, "aroundHooks"),
      () => this.run(input, env, ctx),
      shouldRunHook,
    );

    return await runAfterHooks(
      this,
      BaseEntrypoint.collectHooks(Ctor, "afterHooks"),
      output,
      shouldRunHook,
    );
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

  protected abstract run(input: TInput, env: TEnv, ctx: TCtx): Promise<TOutput>;

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }
}

export abstract class HttpEntrypoint<
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<Request, Response, TEnv, TCtx> {
  abstract router: RouterLike<Request, TEnv, TCtx>;

  async fetch(request: Request, env: TEnv, ctx: TCtx): Promise<Response> {
    return this.handle(request, env, ctx);
  }

  protected async run(request: Request, env: TEnv, ctx: TCtx): Promise<Response> {
    const routerCtx = createRouterContext();
    Object.assign(routerCtx, ctx);
    return this.router.handle(request, env, routerCtx as unknown as TCtx);
  }
}

export abstract class CliEntrypoint<
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<string[], number, TEnv, TCtx> {
  abstract router: RouterLike<string[], TEnv, TCtx, number>;

  async main(argv: string[], env: TEnv, ctx: TCtx): Promise<number> {
    return this.handle(argv, env, ctx);
  }

  protected async run(argv: string[], env: TEnv, ctx: TCtx): Promise<number> {
    return this.router.handle(argv, env, ctx);
  }
}

export abstract class RpcEntrypoint<
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<Request, Response, TEnv, TCtx> {
  abstract router: RouterLike<Request, TEnv, TCtx>;

  async fetch(request: Request, env: TEnv, ctx: TCtx): Promise<Response> {
    return this.handle(request, env, ctx);
  }

  protected async run(request: Request, env: TEnv, ctx: TCtx): Promise<Response> {
    return this.router.handle(request, env, ctx);
  }
}

export abstract class IotEntrypoint<
  TInput = Uint8Array,
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<TInput, void, TEnv, TCtx> {
  abstract router: RouterLike<TInput, TEnv, TCtx, void>;

  async handleSignal(input: TInput, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handle(input, env, ctx);
  }

  protected async run(input: TInput, env: TEnv, ctx: TCtx): Promise<void> {
    return this.router.handle(input, env, ctx);
  }
}

export abstract class CronEntrypoint<
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<string, void, TEnv, TCtx> {
  abstract router: RouterLike<string, TEnv, TCtx, void>;

  async handleTrigger(cron: string, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handle(cron, env, ctx);
  }

  protected async run(cron: string, env: TEnv, ctx: TCtx): Promise<void> {
    return this.router.handle(cron, env, ctx);
  }
}

export abstract class QueueEntrypoint<
  TBody = unknown,
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<TBody, void, TEnv, TCtx> {
  abstract router: RouterLike<TBody, TEnv, TCtx, void>;

  async handleMessage(body: TBody, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handle(body, env, ctx);
  }

  protected async run(body: TBody, env: TEnv, ctx: TCtx): Promise<void> {
    return this.router.handle(body, env, ctx);
  }
}

export abstract class EmailEntrypoint<
  TMsg = unknown,
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<TMsg, void, TEnv, TCtx> {
  abstract router: RouterLike<TMsg, TEnv, TCtx, void>;

  async handleEmail(msg: TMsg, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handle(msg, env, ctx);
  }

  protected async run(msg: TMsg, env: TEnv, ctx: TCtx): Promise<void> {
    return this.router.handle(msg, env, ctx);
  }
}

export abstract class WebSocketEntrypoint<
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<Request, Response, TEnv, TCtx> {
  abstract router: RouterLike<Request, TEnv, TCtx>;

  async fetch(request: Request, env: TEnv, ctx: TCtx): Promise<Response> {
    return this.handle(request, env, ctx);
  }

  protected async run(request: Request, env: TEnv, ctx: TCtx): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    return this.router.handle(request, env, ctx);
  }
}

export abstract class TcpEntrypoint<
  TPayload = Uint8Array,
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<TPayload, void, TEnv, TCtx> {
  abstract router: RouterLike<TPayload, TEnv, TCtx, void>;

  async onData(data: TPayload, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handle(data, env, ctx);
  }

  protected async run(data: TPayload, env: TEnv, ctx: TCtx): Promise<void> {
    return this.router.handle(data, env, ctx);
  }
}

export abstract class UdpEntrypoint<
  TPayload = Uint8Array,
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<TPayload, void, TEnv, TCtx> {
  abstract router: RouterLike<TPayload, TEnv, TCtx, void>;

  async onDatagram(data: TPayload, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handle(data, env, ctx);
  }

  protected async run(data: TPayload, env: TEnv, ctx: TCtx): Promise<void> {
    return this.router.handle(data, env, ctx);
  }
}

// ─── MessageEntrypoint ─────────────────────────────────────────────

type MessageEvent<TBody, TMetadata> = {
  readonly kind: "message";
  body: TBody;
  metadata: TMetadata;
};

export abstract class MessageEntrypoint<
  TBody = unknown,
  TMetadata = Record<string, unknown>,
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<MessageEvent<TBody, TMetadata>, void, TEnv, TCtx> {
  abstract handler: MessageHandlerLike<TBody, TMetadata, TEnv, TCtx>;

  async handleMessage(body: TBody, metadata: TMetadata, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handle({ kind: "message", body, metadata }, env, ctx);
  }

  protected async run(input: MessageEvent<TBody, TMetadata>, env: TEnv, ctx: TCtx): Promise<void> {
    return this.handler.handle(input.body, input.metadata, env, ctx);
  }
}

// ─── DurableObjectEntrypoint ──────────────────────────────────────

type DurableObjectEvent = { readonly kind: "fetch"; request: Request } | { readonly kind: "alarm" };

type DurableObjectResult = Response | void;

export abstract class DurableObjectEntrypoint<
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<DurableObjectEvent, DurableObjectResult, TEnv, TCtx> {
  abstract handler: DurableObjectHandlerLike<TEnv, TCtx>;

  async fetch(request: Request, env: TEnv, ctx: TCtx): Promise<Response> {
    return this.handle({ kind: "fetch", request }, env, ctx) as Promise<Response>;
  }

  async alarm(env: TEnv, ctx: TCtx): Promise<void> {
    await this.handle({ kind: "alarm" }, env, ctx);
  }

  protected async run(
    input: DurableObjectEvent,
    env: TEnv,
    ctx: TCtx,
  ): Promise<DurableObjectResult> {
    if (input.kind === "fetch") {
      return this.handler.fetch(input.request, env, ctx);
    }
    return this.handler.alarm(env, ctx);
  }
}

// ─── GrpcEntrypoint ───────────────────────────────────────────────

type GrpcEvent =
  | { readonly kind: "unary"; request: Uint8Array }
  | { readonly kind: "serverStream"; request: Uint8Array }
  | { readonly kind: "clientStream"; requests: AsyncIterable<Uint8Array> }
  | { readonly kind: "bidiStream"; requests: AsyncIterable<Uint8Array> };

type GrpcResult = Uint8Array | AsyncIterable<Uint8Array>;

export abstract class GrpcEntrypoint<
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<GrpcEvent, GrpcResult, TEnv, TCtx> {
  abstract handler: GrpcHandlerLike<TEnv, TCtx>;

  async unary(request: Uint8Array, env: TEnv, ctx: TCtx): Promise<Uint8Array> {
    return this.handle({ kind: "unary", request }, env, ctx) as Promise<Uint8Array>;
  }

  async serverStream(
    request: Uint8Array,
    env: TEnv,
    ctx: TCtx,
  ): Promise<AsyncIterable<Uint8Array>> {
    return this.handle({ kind: "serverStream", request }, env, ctx) as Promise<
      AsyncIterable<Uint8Array>
    >;
  }

  async clientStream(
    requests: AsyncIterable<Uint8Array>,
    env: TEnv,
    ctx: TCtx,
  ): Promise<Uint8Array> {
    return this.handle({ kind: "clientStream", requests }, env, ctx) as Promise<Uint8Array>;
  }

  async bidiStream(
    requests: AsyncIterable<Uint8Array>,
    env: TEnv,
    ctx: TCtx,
  ): Promise<AsyncIterable<Uint8Array>> {
    return this.handle({ kind: "bidiStream", requests }, env, ctx) as Promise<
      AsyncIterable<Uint8Array>
    >;
  }

  protected async run(input: GrpcEvent, env: TEnv, ctx: TCtx): Promise<GrpcResult> {
    if (input.kind === "unary") {
      return this.handler.unary(input.request, env, ctx);
    }
    if (input.kind === "serverStream") {
      return this.handler.serverStream(input.request, env, ctx);
    }
    if (input.kind === "clientStream") {
      return this.handler.clientStream(input.requests, env, ctx);
    }
    return this.handler.bidiStream(input.requests, env, ctx);
  }
}

// ─── WorkflowEntrypoint ───────────────────────────────────────────

export abstract class WorkflowEntrypoint<
  TPayload = unknown,
  TResult = unknown,
  TCtx extends EntrypointContext = EntrypointContext,
  TEnv extends EnvLike = EnvLike,
> extends BaseEntrypoint<TPayload, TResult, TEnv, TCtx> {
  abstract handler: WorkflowHandlerLike<TPayload, TResult, TEnv, TCtx>;

  protected step!: WorkflowStep;

  async execute(payload: TPayload, step: WorkflowStep, env: TEnv, ctx: TCtx): Promise<TResult> {
    this.step = step;
    return this.handle(payload, env, ctx);
  }

  protected async run(input: TPayload, env: TEnv, ctx: TCtx): Promise<TResult> {
    return this.handler.run(input, this.step, env, ctx);
  }
}
