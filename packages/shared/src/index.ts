/**
 * noware-shared - Shared Types
 */

export interface FlattenedRequest<Cf = unknown> {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  readonly headers: Headers;
  readonly method: string;
  readonly url: string;
  readonly signal: AbortSignal;
  readonly cf?: Cf;

  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  formData(): Promise<FormData>;
  clone(): FlattenedRequest<Cf>;
}

export interface Context {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export type EnvLike = Record<string, unknown>;

export type RequestLike = FlattenedRequest;

export type ContextLike = Context;

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
