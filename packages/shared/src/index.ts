/**
 * noware-shared - Shared Types
 *
 * Standard Gauge: Core Types (Tier 0)
 *
 * These types abstract away the runtime environment.
 * Works with any runtime that provides: Request, Env, Context
 *
 * Uses structural typing - compatible with Cloudflare Workers, Bun, and Node.js
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
