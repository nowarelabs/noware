# Package Reference

Documentation for each Nomo package.

## Available Packages

- [nomo/router](#nomorouter)
- [nomo/controllers](#nomocontrollers)
- [nomo/models](#nomomodels)
- [nomo/services](#nomoservices)
- [nomo/views](#nomoviews)
- [nomo/jobs](#nomojobs)
- [nomo/rpc](#nomorpc)
- [nomo/durable_objects](#nomodurable_objects)
- [nomo/entrypoints](#nomoentrypoints)

---

## nomo/router

**Description:** Trie-based HTTP router with Rails-like patterns

**Installation:**

```bash
pnpm add nomo/router
```

**Features:**

- O(k) path matching via trie data structure
- Path parameters (`:id`, `:slug`)
- Wildcards (`*`)
- RESTful resources
- Middleware chain
- OpenAPI 3.0 integration
- OpenTelemetry tracing
- Query string parsing

**Usage:**

```typescript
import { Router, RouteDrawer } from "nomo/router";

class AppRouter extends RouteDrawer {
  draw() {
    this.get("/", (req, env, ctx) => ctx.json({ ok: true }));
    this.resources("posts", PostsController);
  }
}

const router = new Router({ drawer: AppRouter });
export default { fetch: router.handle.bind(router) };
```

---

## nomo/controllers

**Description:** Rails-like controller abstractions for HTTP request handling

**Installation:**

```bash
pnpm add nomo/controllers
```

**Features:**

- RESTful action methods
- Action result handling
- Parameter filtering
- Before/after filters
- Custom actions

**Usage:**

```typescript
import { Controller, action } from "nomo/controllers";

export class PostsController extends Controller {
  static async index(req, env, ctx) {
    return ctx.json({ posts: [] });
  }

  static async show(req, env, ctx) {
    const { id } = ctx.params;
    return ctx.json({ post: { id } });
  }
}

// In router
this.get("/posts", PostsController.action("index"));
```

---

## nomo/models

**Description:** Type-safe database models using Drizzle ORM

**Installation:**

```bash
pnpm add nomo/models
```

**Features:**

- Drizzle ORM integration
- Type-safe queries
- Schema definitions
- CRUD operations
- Relationships
- Transactions
- OpenAPI schema generation

**Usage:**

```typescript
import { Model } from "nomo/models";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export class User extends Model {
  static table = "users";
  static schema = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
  });

  static async findById(id: number) {
    return this.query.where(this.schema.id.eq(id)).first();
  }
}
```

---

## nomo/services

**Description:** Service layer for business logic with dependency injection

**Installation:**

```bash
pnpm add nomo/services
```

**Features:**

- Service providers
- Dependency injection
- Scoped services
- Factory pattern

**Usage:**

```typescript
class AppRouter extends RouteDrawer {
  draw() {
    this.provide("emailService", new EmailService());
  }
}

// In controller
const emailService = ctx.router.inject("emailService");
```

---

## nomo/views

**Description:** JSX support and view components for Cloudflare Workers

**Installation:**

```bash
pnpm add nomo/views
```

**Features:**

- JSX/TSX support
- Server-side rendering
- Template literals
- Component rendering

**Usage:**

```typescript
import { html, render } from 'nomo/views';

// Template literal
const page = html`<h1>Hello ${name}</h1>`;

// JSX
const element = <div>Content</div>;
const content = render(element);

return ctx.html(content);
```

---

## nomo/jobs

**Description:** Background job processing with queues and scheduling

**Installation:**

```bash
pnpm add nomo/jobs
```

**Features:**

- Queue-based processing
- Cron scheduling
- Retry strategies
- Job priorities

**Usage:**

```typescript
import { Job, JobDispatcher } from "nomo/jobs";

class SendEmailJob extends Job {
  static async handle(data: { to: string; subject: string }) {
    // Send email...
  }
}

class AppDispatcher extends JobDispatcher {
  register() {
    this.registerJob("send_email", SendEmailJob);
  }
}

// Dispatch
await dispatcher.dispatch("send_email", { to: "user@example.com" });
```

---

## nomo/rpc

**Description:** Type-safe RPC for inter-worker communication

**Installation:**

```bash
pnpm add nomo/rpc
```

**Features:**

- Type-safe method calls
- Service bindings
- Request/response typing

**Usage:**

```typescript
import { RpcServer, RpcClient } from "nomo/rpc";

// Server
class UserRpcServer extends RpcServer {
  async getUser(id: number) {
    return { id, name: "John" };
  }
}
router.registerRpc("users", UserRpcServer);

// Client
const client = new RpcClient<UserRpc>("users");
const user = await client.getUser(1);
```

---

## nomo/durable_objects

**Description:** Abstractions for Cloudflare Durable Objects

**Installation:**

```bash
pnpm add nomo/durable_objects
```

**Features:**

- Class-based definitions
- Storage abstractions
- Alarm support
- WebSocket handling

**Usage:**

```typescript
import { DurableObject } from "nomo/durable_objects";

export class CounterObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const count = (await this.storage.get("count")) || 0;
    await this.storage.put("count", count + 1);
    return new Response(JSON.stringify({ count }));
  }
}
```

---

## nomo/entrypoints

**Description:** Base classes for Workers, Durable Objects, and Workflows

**Installation:**

```bash
pnpm add nomo/entrypoints
```

**Features:**

- BaseWorker for HTTP handlers
- BaseDurableObject for DO classes
- BaseWorkflow for Workflow classes

**Usage:**

```typescript
import { BaseWorker } from "nomo/entrypoints";
import { router } from "./router";

export default class Worker extends BaseWorker {
  router = router;
}
```
