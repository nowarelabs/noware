# Architecture Overview

This document describes the architectural patterns and design decisions in the Nomo framework.

## Design Philosophy

Nomo is built around several core principles:

1. **Convention over Configuration** - Sensible defaults with override capabilities
2. **Type Safety** - Full TypeScript support with compile-time checks
3. **Serverless-First** - Optimized for Cloudflare Workers environment
4. **Rails-like Patterns** - Familiar patterns for developers coming from Rails

## Core Components

### Router

The router is the entry point for all HTTP requests. It uses a trie-based data structure for efficient path matching.

```
Request → Router → Route Match → Middleware → Controller → Response
```

Key features:

- O(k) path matching where k is path depth
- Path parameters (`:id`, `:slug`)
- Wildcards (`*`)
- Middleware chain
- OpenAPI integration

### Controllers

Controllers are request handlers that follow Rails conventions:

```typescript
class UsersController extends Controller {
  static async index(req, env, ctx) {
    /* ... */
  }
  static async show(req, env, ctx) {
    /* ... */
  }
  static async create(req, env, ctx) {
    /* ... */
  }
  static async update(req, env, ctx) {
    /* ... */
  }
  static async destroy(req, env, ctx) {
    /* ... */
  }
}
```

### Models

Models provide data access through Drizzle ORM:

```typescript
class User extends Model {
  static schema = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
  });

  static async findByEmail(email: string) {
    return this.query.where(this.schema.email.eq(email)).first();
  }
}
```

### Services

Services contain business logic and use dependency injection:

```typescript
class AppRouter extends RouteDrawer {
  draw() {
    this.provide("emailService", new EmailService());
  }
}

// In controller
const emailService = ctx.router.inject("emailService");
```

## Request Flow

```
1. Request arrives at Worker.fetch()
2. Router.handle() is called
3. Path matching via trie
4. Middleware chain executes
5. Controller action invoked
6. Response returned
```

## Middleware

Middleware functions execute before controllers:

```typescript
const authMiddleware = async (req, env, ctx, next) => {
  const token = req.headers.get("Authorization");
  if (!token) return ctx.json({ error: "Unauthorized" }, { status: 401 });
  return next();
};

router.use(authMiddleware);
```

## Dependency Injection

Nomo uses a provider-based DI system:

```typescript
class AppRouter extends RouteDrawer {
  draw() {
    // Register services
    this.provide("cache", new CacheService());
    this.provide("db", new DatabaseService());
  }
}

// Access in controllers
ctx.router.inject("cache");
```

## Context

The router context provides utilities:

```typescript
ctx.json(data, init?)    // JSON response
ctx.text(data, init?)    // Text response
ctx.html(data, init?)    // HTML response
ctx.redirect(url, status) // Redirect
ctx.parseJson()          // Parse body
ctx.params               // Route parameters
ctx.query                // Query string
ctx.headers              // Request headers
```

## Error Handling

Errors can be caught at multiple levels:

```typescript
// Throwing HTTP errors
throw new NotFoundError("User not found");
throw new BadRequestError("Invalid input");

// Global error handler
router.onError((err, req, env, ctx) => {
  ctx.logger.error("Request failed", { error: err.message });
  return ctx.json({ error: err.message }, { status: err.status || 500 });
});
```

## OpenAPI Integration

Generate API documentation automatically:

```typescript
router.openapi(
  {
    method: "get",
    path: "/users/{id}",
    request: { params: UserIdSchema },
    responses: {
      "200": { description: "User", content: { "application/json": { schema: UserSchema } } },
      "404": { description: "Not found" },
    },
  },
  handler,
);

const spec = router.getOpenApiDocument({ title: "API", version: "1.0.0" });
```

## Tracing

OpenTelemetry tracing is built-in:

```typescript
// Automatic spans for each request
// Custom spans in services
const tracer = trace.getTracer("my-service");
await tracer.startActiveSpan("operation", async (span) => {
  // ...
  span.end();
});
```

## Durable Objects

Stateful workloads use Durable Objects:

```typescript
export class CounterObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const count = (await this.storage.get("count")) || 0;
    return new Response(JSON.stringify({ count }));
  }
}
```

## Workflows

Long-running operations use Workflows:

```typescript
export class MyWorkflow extends WorkflowEntrypoint<Env, Input> {
  async run(event: WorkflowEvent<Input>, step: WorkflowStep) {
    const result = await step.do("task", async () => {
      return await processData(event.payload);
    });
  }
}
```
