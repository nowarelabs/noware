import type { ContextLike, RequestLike, EnvLike, EntrypointContext } from "@nowarelabs/contexts";
import { createContext } from "@nowarelabs/contexts";

export type {
  Body,
  RequestLike,
  EnvLike,
  ContextLike,
  RouterContext,
  ControllerContext,
  ServiceContext,
  ModelContext,
  ViewContext,
  EntrypointContext,
  FeatureContext,
  AdapterRequest,
  AdapterResponse,
  AdapterContext,
  ModuleContext,
  RpcContext,
  IntegrationEventContext,
  UseCaseContext,
  PortContext,
  AggregateContext,
  EventContext,
  QueryContext,
  GatewayContext,
  PersistenceContext,
  SqlContext,
  MigrationContext,
  LoggerContext,
  JobContext,
  AssetContext,
  DurableObjectContext,
  CfourContext,
  DtoContext,
  NormalizerContext,
  ValidatorContext,
  FormatterContext,
  SerializerContext,
  MaintenanceContext,
  PluginContext,
  ScriptContext,
  DomainContext,
} from "@nowarelabs/contexts";

export {
  createContext,
  createContextWith,
  createRouterContext,
  createControllerContext,
  createServiceContext,
  createModelContext,
  createViewContext,
  enhanceRouterContext,
  enhanceControllerContext,
  enhanceServiceContext,
  enhanceModelContext,
  enhanceViewContext,
} from "@nowarelabs/contexts";

export interface RouterLike<
  Req = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends ContextLike = ContextLike,
  TOutput = Response,
> {
  handle(request: Req, env: Env, ctx: Ctx): Promise<TOutput>;
}

// ── Handler-like interfaces (protocol-specific dispatch targets) ──

export interface MessageHandlerLike<
  TBody = unknown,
  TMetadata = Record<string, unknown>,
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  handle(body: TBody, metadata: TMetadata, env: TEnv, ctx: TCtx): Promise<void>;
}

export interface DurableObjectHandlerLike<
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  fetch(request: Request, env: TEnv, ctx: TCtx): Promise<Response>;
  alarm(env: TEnv, ctx: TCtx): Promise<void>;
}

export interface GrpcHandlerLike<
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  unary(request: Uint8Array, env: TEnv, ctx: TCtx): Promise<Uint8Array>;
  serverStream(request: Uint8Array, env: TEnv, ctx: TCtx): AsyncIterable<Uint8Array>;
  clientStream(requests: AsyncIterable<Uint8Array>, env: TEnv, ctx: TCtx): Promise<Uint8Array>;
  bidiStream(requests: AsyncIterable<Uint8Array>, env: TEnv, ctx: TCtx): AsyncIterable<Uint8Array>;
}

export interface WorkflowStep {
  do<T>(
    name: string,
    fn: (ctx: { state: { finished: boolean } }) => Promise<T>,
  ): Promise<T>;
  sleep(name: string, duration: string): Promise<void>;
  sleepUntil(name: string, timestamp: Date | number): Promise<void>;
}

export interface WorkflowHandlerLike<
  TPayload = unknown,
  TResult = unknown,
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  run(payload: TPayload, step: WorkflowStep, env: TEnv, ctx: TCtx): Promise<TResult>;
}

export type UseCaseResult<TOutput, TError = Error> =
  | { success: true; data: TOutput; status: "delivered" }
  | { success: false; error: TError; status: "abandoned" };

export interface HookOptions {
  only?: string[];
  except?: string[];
}

export interface Port<TInput = unknown, TOutput = unknown> {
  execute(input: TInput): Promise<UseCaseResult<TOutput>>;
}

export type HookFunction<T = any, R = any> = (instance: T) => R | Promise<R> | void | Promise<void>;

export type AfterHookFunction<T = any, R = any> = (
  instance: T,
  result: R,
) => R | Promise<R> | void | Promise<void>;

export type AroundHookFunction<T = any, R = any> = (
  instance: T,
  next: () => Promise<R>,
) => Promise<R>;

export interface RegisteredHook<T = any, R = any> {
  fn: HookFunction<T, R> | AfterHookFunction<T, R> | AroundHookFunction<T, R>;
  options?: HookOptions;
}

export async function runBeforeHooks<T, R = any>(
  instance: T,
  hooks: readonly RegisteredHook<T, R>[],
  shouldRun?: (options?: HookOptions) => boolean,
): Promise<R | null> {
  for (const { fn, options } of hooks) {
    if (shouldRun && !shouldRun(options)) continue;
    const result = await (fn as HookFunction<T, R>)(instance);
    if (result !== undefined && result !== null) return result as R;
  }
  return null;
}

export async function runAfterHooks<T, R>(
  instance: T,
  hooks: readonly RegisteredHook<T, R>[],
  result: R,
  shouldRun?: (options?: HookOptions) => boolean,
): Promise<R> {
  let current = result;
  for (const { fn, options } of hooks) {
    if (shouldRun && !shouldRun(options)) continue;
    const hookResult = await (fn as AfterHookFunction<T, R>)(instance, current);
    if (hookResult !== undefined && hookResult !== null) current = hookResult as R;
  }
  return current;
}

export async function runAroundHooks<T, R>(
  instance: T,
  hooks: readonly RegisteredHook<T, R>[],
  action: () => Promise<R>,
  shouldRun?: (options?: HookOptions) => boolean,
): Promise<R> {
  const applicable = hooks.filter((h) => !shouldRun || shouldRun(h.options));
  if (applicable.length === 0) return action();
  let index = 0;
  const next = async (): Promise<R> => {
    if (index >= applicable.length) return action();
    const { fn } = applicable[index++];
    return (fn as AroundHookFunction<T, R>)(instance, next);
  };
  return next();
}

export function fromCloudflareRequest(request: {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  readonly redirect: string;
  readonly signal: AbortSignal;
  readonly integrity: string;
  readonly keepalive: boolean;
  clone(): any;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  formData(): Promise<FormData>;
  json(): Promise<any>;
  text(): Promise<string>;
}): RequestLike {
  return request as unknown as RequestLike;
}

export function fromCloudflareContext(ctx: {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
  readonly props: unknown;
}): ContextLike {
  return ctx as ContextLike;
}

export function fromCloudflareEnv<T extends Record<string, unknown>>(env: T): EnvLike {
  return env;
}

export function fromWebRequest(request: Request): RequestLike {
  return request as RequestLike;
}

export function fromWebContext(): ContextLike {
  return createContext();
}

export function fromWebEnv<T extends Record<string, unknown>>(env: T): EnvLike {
  return env;
}

interface NodeIncomingMessage {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { encrypted?: boolean };
}

export function fromNodeIncomingMessage(
  nodeReq: NodeIncomingMessage,
  body?: Uint8Array,
): RequestLike {
  const protocol = (nodeReq.socket as { encrypted?: boolean } | undefined)?.encrypted
    ? "https"
    : "http";
  const host = Array.isArray(nodeReq.headers.host)
    ? nodeReq.headers.host[0]
    : (nodeReq.headers.host ?? "localhost");
  const url = `${protocol}://${host}${nodeReq.url ?? "/"}`;
  const method = nodeReq.method ?? "GET";

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? (body ?? null) : null,
  }) as RequestLike;
}
