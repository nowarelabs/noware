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

The portable root — available on Cloudflare, Node.js, Bun, and Deno.

```typescript
import type { ContextLike } from "@nowarelabs/shared";

interface ContextLike {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
```

### Layer-Specific Contexts

Each Standard Gauge layer has a dedicated context interface that extends `ContextLike` with layer-relevant properties. The base classes (`BaseController`, `BaseService`, `BaseModel`, `BaseView`) already constrain their generic `Ctx` to the correct type, so types are inferred automatically.

#### RouterContext

```typescript
import type { RouterContext } from "@nowarelabs/shared";

interface RouterContext extends ContextLike {
  readonly params: Record<string, string>;
}
```

#### ControllerContext

```typescript
import type { ControllerContext } from "@nowarelabs/shared";

interface ControllerContext extends ContextLike {
  readonly currentUser?: unknown;
  readonly session?: Record<string, unknown>;
}
```

#### ServiceContext

```typescript
import type { ServiceContext } from "@nowarelabs/shared";

interface ServiceContext extends ContextLike {
  readonly transactionId: string;
  readonly logger?: unknown;
}
```

#### ModelContext

```typescript
import type { ModelContext } from "@nowarelabs/shared";

interface ModelContext extends ContextLike {
  readonly logger?: unknown;
  readonly transaction?: unknown;
}
```

#### ViewContext

```typescript
import type { ViewContext } from "@nowarelabs/shared";

interface ViewContext extends ContextLike {
  readonly currentUser?: unknown;
  readonly flash?: Record<string, unknown>;
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
  createControllerContext,
  createServiceContext,
  createModelContext,
  createViewContext,
  createRouterContext,
  fromCloudflareRequest,
  fromCloudflareContext,
  fromCloudflareEnv,
  fromWebRequest,
  fromWebContext,
  fromWebEnv,
  fromNodeIncomingMessage,
} from "@nowarelabs/shared";
```

### Layer Context Factories

Each factory creates a context matching the layer's interface with sensible defaults. These are the primary way to create contexts outside Cloudflare.

| Factory | Returns | Defaults |
|---|---|---|
| `createContext()` | `ContextLike` | noop `waitUntil` / `passThroughOnException` |
| `createControllerContext()` | `ControllerContext` | `currentUser: undefined`, `session: {}` |
| `createServiceContext()` | `ServiceContext` | `transactionId: crypto.randomUUID()`, `logger: undefined` |
| `createModelContext()` | `ModelContext` | `logger: undefined`, `transaction: undefined` |
| `createViewContext()` | `ViewContext` | `currentUser: undefined`, `flash: {}` |
| `createRouterContext()` | `RouterContext` | `params: {}` |

Each factory also has an `enhance*` variant that takes an existing `ContextLike` and overlays additional properties:

```typescript
import { createContext, enhanceControllerContext } from "@nowarelabs/shared";

const base = createContext();
const ctx = enhanceControllerContext(base, { currentUser: { id: "123" } });
// ctx satisfies ControllerContext — currentUser is set, others use defaults
```

```typescript
import { createServiceContext } from "@nowarelabs/shared";

// In a Bun or Deno HTTP handler
const ctx = createServiceContext();
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

On other runtimes, use the layer context factories instead of `createContext()`:

```typescript
// ✅ Bun/Deno: use layer-specific factory
const ctx = createControllerContext();  // has currentUser, session, waitUntil
const env = fromWebEnv({ DB: "..." });
const req = fromWebRequest(request);
```

```typescript
// ✅ Node.js: convert request, use service context
const req = fromNodeIncomingMessage(nodeReq, body);
const ctx = createServiceContext();  // has transactionId, logger
```

```typescript
// ✅ Custom: start from base and enhance
const base = createContext();
const ctx = enhanceControllerContext(base, {
  currentUser: { id: "456", role: "admin" },
});
```

## Generic Type Flow

Each Standard Gauge base class constrains `Ctx` to its layer context. Because every layer context extends `ContextLike`, the Cloudflare native `ExecutionContext` satisfies any constraint structurally:

```
Cloudflare `ExecutionContext`
  → satisfies: ContextLike ✓
  → satisfies: ControllerContext ✓  (no currentUser/session — optional)
  → satisfies: ServiceContext   ✓  (no transactionId — required!)

// Note: ServiceContext requires `transactionId: string`.
// On Cloudflare, use `enhanceServiceContext(executionContext, { transactionId: "..." })`
// or set it via middleware. Off Cloudflare, `createServiceContext()` handles it.
```

Off-Cloudflare, use the factory matching the layer you're in. The context flows through all layers — each layer sees the same object but only accesses the properties relevant to it:
