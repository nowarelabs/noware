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

export type EnvLike = Record<string, unknown>;

export interface ContextLike {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
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
