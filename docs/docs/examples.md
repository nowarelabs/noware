# Examples

Practical examples demonstrating Nomo features.

## Basic Examples

### Hello World

The simplest Nomo application:

```typescript
// src/router.ts
import { Router } from "nomo/router";

const router = new Router();

router.get("/", (req, env, ctx) => {
  return ctx.html("<h1>Hello World!</h1>");
});

router.get("/json", (req, env, ctx) => {
  return ctx.json({ message: "Hello World" });
});

export default { fetch: router.handle.bind(router) };
```

### REST API

A complete REST API with CRUD operations:

```typescript
// src/router.ts
import { Router, RouteDrawer } from "nomo/router";
import { PostsController } from "./controllers/posts";

class ApiRouter extends RouteDrawer {
  draw() {
    // Posts resource
    this.resources("posts", PostsController);

    // Comments nested under posts
    this.scope("posts/:postId", (drawer) => {
      drawer.resources("comments", CommentsController);
    });
  }
}

export const router = new Router({ drawer: ApiRouter });
```

```typescript
// src/controllers/posts.ts
import { Controller } from "nomo/controllers";

export class PostsController extends Controller {
  static async index(_req, _env, ctx) {
    const posts = await getAllPosts();
    return ctx.json({ posts });
  }

  static async show(req, _env, ctx) {
    const { id } = ctx.params;
    const post = await getPostById(id);
    if (!post) {
      throw new NotFoundError("Post not found");
    }
    return ctx.json({ post });
  }

  static async create(req, _env, ctx) {
    const data = await ctx.parseJson();
    const post = await createPost(data);
    return ctx.json({ post }, { status: 201 });
  }

  static async update(req, _env, ctx) {
    const { id } = ctx.params;
    const data = await ctx.parseJson();
    const post = await updatePost(id, data);
    return ctx.json({ post });
  }

  static async destroy(req, _env, ctx) {
    const { id } = ctx.params;
    await deletePost(id);
    return ctx.json({ deleted: true });
  }
}
```

### Route Parameters

Using dynamic path parameters:

```typescript
router.get("/users/:id", (req, env, ctx) => {
  const { id } = ctx.params;
  return ctx.json({ userId: id });
});

// Nested parameters
router.get("/users/:userId/posts/:postId", (req, env, ctx) => {
  const { userId, postId } = ctx.params;
  return ctx.json({ userId, postId });
});
```

### Query String

Accessing query parameters:

```typescript
router.get("/search", (req, env, ctx) => {
  const { q, page = "1", limit = "10" } = ctx.query;
  const results = await search(q, { page: parseInt(page), limit: parseInt(limit) });
  return ctx.json({ results });
});
```

### Middleware

Adding middleware for authentication, logging, etc.:

```typescript
// Authentication middleware
const authMiddleware = async (req, env, ctx, next) => {
  const token = req.headers.get("Authorization");
  if (!token) {
    return ctx.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return ctx.json({ error: "Invalid token" }, { status: 401 });
  }

  ctx.user = user;
  return next();
};

// Apply to specific routes
router.get("/profile", authMiddleware, ProfileController.action("show"));
router.patch("/profile", authMiddleware, ProfileController.action("update"));

// Apply globally
router.use(authMiddleware);
```

### Validation

Request validation using Zod:

```typescript
import { z } from "zod";
import { Router } from "nomo/router";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(0).optional(),
});

const updateUserSchema = createUserSchema.partial();

router.post("/users", Router.zValidator("json", createUserSchema), async (req, env, ctx) => {
  const user = await createUser(ctx.validJson);
  return ctx.json({ user }, { status: 201 });
});

router.patch("/users/:id", Router.zValidator("json", updateUserSchema), async (req, env, ctx) => {
  const { id } = ctx.params;
  const user = await updateUser(id, ctx.validJson);
  return ctx.json({ user });
});
```

## Database Examples

### Drizzle Models

Defining database models:

```typescript
// src/models/user.ts
import { Model } from "nomo/models";
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export class User extends Model {
  static table = "users";

  static schema = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    age: integer("age"),
    createdAt: timestamp("created_at").defaultNow(),
  });

  static async findByEmail(email: string) {
    return this.query.where(this.schema.email.eq(email)).first();
  }

  static async findById(id: number) {
    return this.query.where(this.schema.id.eq(id)).first();
  }

  static async create(data: { name: string; email: string; age?: number }) {
    return this.insert(data);
  }
}
```

### Query Building

Complex queries with Drizzle:

```typescript
// Where conditions
const users = await User.query
  .where(User.schema.age.gt(18))
  .orderBy(User.schema.name)
  .limit(10)
  .all();

// Joins
const postsWithAuthor = await Post.query
  .innerJoin(User.schema, Post.schema.authorId.eq(User.schema.id))
  .where(User.schema.active.eq(true))
  .all();

// Aggregation
const count = await User.query.where(User.schema.age.gt(18)).count();
```

## Service Examples

### Dependency Injection

Using services in controllers:

```typescript
// src/services/email.ts
export class EmailService {
  async send(to: string, subject: string, body: string) {
    // Integration with email provider
    return { success: true, messageId: "msg-123" };
  }
}

// src/router.ts
class AppRouter extends RouteDrawer {
  draw() {
    this.provide("emailService", new EmailService());
    this.resources("users", UsersController);
  }
}

// src/controllers/users.ts
export class UsersController extends Controller {
  static async create(req, env, ctx) {
    const data = await ctx.parseJson();
    const user = await User.create(data);

    const emailService = ctx.router.inject("emailService") as EmailService;
    await emailService.send(user.email, "Welcome!", "Welcome to our app");

    return ctx.json({ user }, { status: 201 });
  }
}
```

## Error Handling Examples

### Custom Error Types

```typescript
import { NotFoundError, BadRequestError, HttpError } from "nomo/router";

router.get("/users/:id", async (req, env, ctx) => {
  const user = await User.findById(ctx.params.id);
  if (!user) {
    throw new NotFoundError(`User ${ctx.params.id} not found`);
  }
  return ctx.json({ user });
});

router.post("/users", async (req, env, ctx) => {
  const data = await ctx.parseJson();
  if (!data.email) {
    throw new BadRequestError("Email is required");
  }
  // ...
});
```

### Global Error Handler

```typescript
router.onError((err, req, env, ctx) => {
  ctx.logger.error("Request failed", {
    error: err.message,
    path: req.url,
    stack: err.stack,
  });

  if (err instanceof HttpError) {
    return ctx.json({ error: err.message }, { status: err.status });
  }

  return ctx.json({ error: "Internal Server Error" }, { status: 500 });
});
```

## OpenAPI Examples

### Generating API Spec

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const CreateUserSchema = UserSchema.omit({ id: true });

router.openapi(
  {
    method: "get",
    path: "/users",
    responses: {
      "200": {
        description: "List of users",
        content: { "application/json": { schema: z.array(UserSchema) } },
      },
    },
  },
  UsersController.action("index"),
);

router.openapi(
  {
    method: "post",
    path: "/users",
    request: {
      body: {
        content: { "application/json": { schema: CreateUserSchema } },
      },
    },
    responses: {
      "201": {
        description: "Created user",
        content: { "application/json": { schema: UserSchema } },
      },
      "400": { description: "Validation error" },
    },
  },
  UsersController.action("create"),
);

// Generate spec
const spec = router.getOpenApiDocument({
  title: "My API",
  version: "1.0.0",
  description: "API documentation",
});
```

## Durable Object Examples

### Counter Object

```typescript
// src/durable_objects/counter.ts
import { DurableObject } from "nomo/durable_objects";

export class CounterObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname;

    if (action === "/increment") {
      const count = ((await this.storage.get("count")) || 0) as number;
      await this.storage.put("count", count + 1);
      return new Response(JSON.stringify({ count: count + 1 }));
    }

    if (action === "/decrement") {
      const count = ((await this.storage.get("count")) || 0) as number;
      await this.storage.put("count", count - 1);
      return new Response(JSON.stringify({ count: count - 1 }));
    }

    const count = (await this.storage.get("count")) || 0;
    return new Response(JSON.stringify({ count }));
  }
}
```

## Configuration Examples

### Environment Variables

```typescript
// wrangler.toml
[vars]
ENVIRONMENT = "development"
API_VERSION = "v1"

# Secure secrets
# Use wrangler secret put for production
```

```typescript
// Access in handlers
router.get("/config", (req, env, ctx) => {
  return ctx.json({
    env: env.ENVIRONMENT,
    apiVersion: env.API_VERSION,
  });
});
```

### Conditional Middleware

```typescript
router.use(async (req, env, ctx, next) => {
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;

  ctx.logger.info("Request completed", { duration, status: response.status });
  return response;
});
```
