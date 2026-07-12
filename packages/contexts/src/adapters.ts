import type { ContextLike, EnvLike, RequestLike } from "./shared.ts";

export interface AdapterRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  raw: RequestLike;
}

export interface AdapterResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface AdapterContext<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  env: Env;
  ctx: Ctx;
  request: AdapterRequest;
}
