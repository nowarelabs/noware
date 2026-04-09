# nomo/router

A robust, type-safe, and class-based routing DSL for Cloudflare Workers. It provides a clean, declarative way to define routes with built-in Zod validation, OpenAPI generation, and resourceful routing.

## Installation

```bash
pnpm add nomo/router
```

---

## 1. Core DSL: `RouteDrawer`

The `RouteDrawer` is the primary interface for defining routes. It supports a variety of methods for structuring your application's URL space.

### 1.1. Basic HTTP Methods

```typescript
import { RouteDrawer } from "nomo/router";

export const routes = new RouteDrawer((r) => {
  r.get("/", "Home#index");
  r.post("/items", "Items#create");
});
```

### 1.2. Resourceful Routing

The `resources` method automatically generates standard RESTful routes for a given resource.

```typescript
r.resources("accounts");
// Generates:
// GET    /accounts          => Accounts#index
// POST   /accounts          => Accounts#create
// GET    /accounts/:id      => Accounts#show
// PATCH  /accounts/:id      => Accounts#update
// DELETE /accounts/:id      => Accounts#destroy
```

### 1.3. Scoping and Namespacing

Organize routes using `scope` or `namespace` (which automatically prefixes paths).

```typescript
r.namespace("admin", () => {
  r.resources("users"); // GET /admin/users
});

r.scope("/api/v1", () => {
  r.get("/health", "System#health");
});
```

---

## 2. Advanced Features

### 2.1. Zod Validation

Integration with Zod allows for automatic request validation.

```typescript
import { z } from "zod";

r.get(
  "/search",
  {
    validate: {
      query: z.object({ q: z.string() }),
    },
  },
  "Search#index",
);
```

Validated data is automatically passed to the controller and accessible via `ctx.validQuery`, `ctx.validJson`, etc.

### 2.2. OpenAPI Documentation

Define your routes with metadata to automatically generate an OpenAPI 3.0 document.

```typescript
r.openapi(
  {
    method: "get",
    path: "/users/{id}",
    responses: {
      "200": { description: "Success" },
    },
  },
  "Users#show",
);
```

Retrieve the document via `router.getOpenApiDocument(...)`.

### 2.3. Middleware

Apply middleware globally or at a route level.

```typescript
const router = new Router();
router.use(async (req, env, ctx, next) => {
  // Logic
  return await next();
});
```

### 2.4. HTMLRewriter Integration

The router provides a native `rewrite` method on the context to perform zero-latency HTML transformations.

```typescript
router.get("/page", async (req, env, ctx) => {
  const response = await ctx.html("...");
  return ctx.rewrite(response, [
    {
      selector: "head",
      handler: new AssetInjector(...)
    }
  ]);
});
```

### 2.5. Cap'n Web (RPC) Support

Register and dispatch arbitrary method calls using Cloudflare's Cap'n Web system.

```typescript
// Registration
router.registerRpc("sendEmail", async (to, body, { env, executionCtx }) => {
  // Logic
});

// Dispatch (usually via Entrypoint)
await router.rpc("sendEmail", ["vance@example.com", "Hello!"], env, ctx);
```

### 2.6. Distributed Trace Propagation

Use `ctx.fetch` instead of the global `fetch` to automatically propagate the current trace ID to downstream services.

```typescript
const res = await ctx.fetch("https://api.internal/data");
```

---

## 3. The `Router` Runner

The `Router` class is the engine that handles incoming requests.

```typescript
const router = new Router();
router.draw(routes); // Load routes from RouteDrawer

export default {
  async fetch(req, env, ctx) {
    return await router.handle(req, env, ctx);
  },
};
```

### Context (`RouterContext`)

Every handler receives a `ctx` object providing:

- **`params`**: Decoded path parameters.
- **`query`**: URL search parameters.
- **`json()`/`text()`/`html()`**: Convenience response helpers.
- **`parseJson()`**: Safe body parsing.

---

## License

MIT
