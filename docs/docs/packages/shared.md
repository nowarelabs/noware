# Shared

Platform-agnostic types and runtime utilities for Standard Gauge applications.

These types are structurally compatible with Cloudflare Workers but do not depend on `cloudflare:workers`, making them portable across Cloudflare, Node.js, Bun, and Deno.

## Types

### RequestLike

A minimal request interface compatible with Cloudflare's `Request`, the standard Web API `Request`, and Node's `IncomingMessage`.

```typescript
import type { RequestLike } from "@nowarelabs/shared";

interface RequestLike extends Body {
  clone(): RequestLike;
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  readonly redirect: string;
  readonly signal: AbortSignal;
  readonly integrity: string;
  readonly keepalive: boolean;
}
```

### ContextLike

A minimal context interface with `waitUntil` and `passThroughOnException`. These are the only two methods available across all serverless platforms.

```typescript
import type { ContextLike } from "@nowarelabs/shared";

interface ContextLike {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
```

### EnvLike

A plain record for environment bindings, matching Cloudflare's `Env` pattern.

```typescript
import type { EnvLike } from "@nowarelabs/shared";

type EnvLike = Record<string, unknown>;
```

### Body

The body-read interface shared by `Request` and `Response`.

```typescript
import type { Body } from "@nowarelabs/shared";

interface Body {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  formData(): Promise<FormData>;
  json(): Promise<any>;
  text(): Promise<string>;
}
```

### Hooks & Ports

The package also provides hook types used by controllers, services, and other Standard Gauge layers:

```typescript
import type {
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
  Port,
  UseCaseResult,
} from "@nowarelabs/shared";
```

## Runtime Utilities

The runtime utilities help adapt platform-native objects to the Standard Gauge types.

```typescript
import {
  createContext,
  fromCloudflareRequest,
  fromCloudflareContext,
  fromCloudflareEnv,
  fromWebRequest,
  fromWebContext,
  fromWebEnv,
  fromNodeIncomingMessage,
} from "@nowarelabs/shared";
```

### createContext

Creates a `ContextLike` with no-op `waitUntil` and `passThroughOnException` handlers. Use this outside Cloudflare (Node.js, Bun, Deno) where no native execution context exists.

```typescript
import { createContext } from "@nowarelabs/shared";

// In a Bun or Deno HTTP handler
const ctx = createContext();
await handle(request, env, ctx);
```

### Converter Functions

| Function | Input | Output | Use Case |
|---|---|---|---|
| `fromCloudflareRequest` | Cloudflare `Request` | `RequestLike` | Casts native CF request (identity cast) |
| `fromCloudflareContext` | Cloudflare `ExecutionContext` | `ContextLike` | Extracts context (identity cast) |
| `fromCloudflareEnv` | Cloudflare env bindings | `EnvLike` | Casts env (identity cast) |
| `fromWebRequest` | Standard `Request` | `RequestLike` | Casts Web API Request (identity cast) |
| `fromWebContext` | — | `ContextLike` | Creates noop context |
| `fromWebEnv` | Plain object | `EnvLike` | Wraps an object as env (identity cast) |
| `fromNodeIncomingMessage` | `http.IncomingMessage` | `RequestLike` | Converts Node's request to `RequestLike` |

### Usage Examples

**Cloudflare Worker** — no adaptation needed, Cloudflare's types satisfy the interfaces structurally:

```typescript
import { Router } from "@nowarelabs/router";
import type { RequestLike, ContextLike } from "@nowarelabs/shared";

const router = new Router<Env, ExecutionContext>({ drawer: AppRoutes });

export default class AppWorker extends BaseWorker<Env> {
  router = router;
}
```

**Bun server** — needs `createContext` since Bun has no native `waitUntil`:

```typescript
import { createContext } from "@nowarelabs/shared";
import type { RequestLike, ContextLike, EnvLike } from "@nowarelabs/shared";

Bun.serve({
  async fetch(request: Request) {
    const ctx = createContext();
    const env = { DB: process.env.DB };
    return await handle(request as RequestLike, env, ctx);
  },
});
```

**Node.js (Express)** — needs conversion from `IncomingMessage`:

```typescript
import { createContext, fromNodeIncomingMessage } from "@nowarelabs/shared";
import type { EnvLike } from "@nowarelabs/shared";
import express from "express";

const app = express();

app.post("/api", async (nodeReq, nodeRes) => {
  const request = fromNodeIncomingMessage(nodeReq);
  const ctx = createContext();
  const env: EnvLike = { DB: process.env.DB };
  const response = await handle(request, env, ctx);
  nodeRes.status(response.status).send(await response.text());
});
```

**Node.js (raw http)** — collect body and convert:

```typescript
import { createContext, fromNodeIncomingMessage } from "@nowarelabs/shared";
import { createServer } from "http";

const server = createServer(async (nodeReq, nodeRes) => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of nodeReq) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const request = fromNodeIncomingMessage(nodeReq, body);
  const ctx = createContext();
  const response = await handle(request, {}, ctx);

  nodeRes.statusCode = response.status;
  response.headers.forEach((v, k) => nodeRes.setHeader(k, v));
  nodeRes.end(await response.text());
});
```

## When to Adapter vs. Cast

On Cloudflare Workers, native types satisfy the `Like` interfaces structurally — no cast needed:

```typescript
// ✅ Cloudflare: assign directly
const request: RequestLike = cfRequest;
const ctx: ContextLike = executionContext;
const env: EnvLike = cfEnv;
```

On other runtimes, use the adapter functions when conversion logic is required, or a direct cast when the source already satisfies the interface:

```typescript
// ✅ Bun/Deno: Request satisfies RequestLike, cast is safe
const req = request as RequestLike;

// Cloudflare: identity cast (explicit but zero-cost)
const req = fromCloudflareRequest(cfRequest);

// Only Node's IncomingMessage needs real conversion
const req = fromNodeIncomingMessage(nodeReq, body);
```
