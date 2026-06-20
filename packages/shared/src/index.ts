export interface Body {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  formData(): Promise<FormData>;
  json(): Promise<any>;
  text(): Promise<string>;
}

export interface RequestLike extends Body {
  clone(): RequestLike;
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  readonly redirect: string;
  readonly signal: AbortSignal;
  readonly integrity: string;
  readonly keepalive: boolean;
}

export interface ContextLike {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export type EnvLike = Record<string, unknown>;

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

export function createContext(): ContextLike {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}

export function createContextWith<T>(
  ctx: ContextLike,
  props: T,
): ContextLike & { readonly props: T } {
  return Object.assign(ctx, { props });
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
