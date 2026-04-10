# Nomo Framework - AI Agent Guide

This document provides AI agents with the knowledge needed to create, navigate, and work with projects built using the Nomo framework on Cloudflare Workers.

## Project Structure

A typical Nomo project follows this structure:

```
my-project/
├── src/
│   ├── controllers/       # HTTP request handlers (BaseController, BaseResourceController)
│   ├── services/           # Business logic layer (BaseService)
│   ├── models/            # Database models with Drizzle ORM
│   ├── db/
│   │   └── schema/        # Database schema definitions
│   │   └── migrations/    # Database migrations
│   ├── views/             # JSX view components (BaseView, BaseLayout)
│   ├── rpc/                # RPC handlers for inter-service calls
│   ├── jobs/              # Background job definitions
│   ├── durable_objects/   # Durable Object classes
│   ├── workflows/        # Cloudflare Workflows
│   ├── middlewares/      # Custom middleware
│   ├── routes.ts          # Route definitions using RouteDrawer
│   └── index.ts           # Worker entry point
├── wrangler.jsonc         # Cloudflare configuration
├── package.json
└── tsconfig.json
```

## Architecture Flow

```
Request → BaseWorker (src/index.ts)
           ↓
         Router (src/routes.ts)
           ↓
    RouteDrawer.draw()
           ↓
     Controller (src/controllers/*)
      (BaseController / BaseResourceController)
           ↓
        Service (src/services/*)
          (BaseService)
           ↓
         Model (src/models/*)
          (BaseModel + Drizzle)
           ↓
         Database (D1 / Durable Object Storage)
```

## Key Packages

### @nomo/controllers
- **BaseController**: HTTP request handling, response methods, validation/normalization hooks
- **BaseResourceController**: RESTful CRUD automatically (index, show, create, update, destroy, trash, restore, etc.)
- Response methods: `json()`, `text()`, `html()`, `xml()`, `csv()`, `xlsx()`, `redirect_to()`, `render()`
- Error methods: `notFound()`, `unauthorized()`, `forbidden()`, `badRequest()`, `internalServerError()`

### @nomo/router
- **Router**: Main router class
- **RouteDrawer**: Fluent API for defining routes
- Methods: `get()`, `post()`, `put()`, `patch()`, `delete()`, `all()`
- Features: `resources()`, `resourceActions()`, `namespace()`, `version()`, `scope()`, `use()`

### @nomo/services
- **BaseService**: Business logic layer
- Provides: `db`, `logger`, `fetch()`, `createServiceContext()`

### @nomo/models
- **BaseModel**: Database operations with Drizzle ORM
- **FluentQuery**: Chainable query builder with operators (eq, neq, gt, gte, lt, lte, like, in, nin)

### @nomo/entrypoints
- **BaseWorker**: Worker entry point
- **BaseDurableObject**: DO entry point
- **BaseWorkflow**: Workflow entry point

### @nomo/views
- **BaseView**: JSX view component
- **BaseLayout**: HTML layout wrapper
- **BaseDtoView**: JSON/XML serialization

## Common Patterns

### Creating a New Resource (CRUD)

1. **Define Schema** (`src/db/schema/schema.ts`):
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: integer('published', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

2. **Define Types** (`src/models/types.ts`):
```typescript
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import * as schema from '../db/schema/schema';

export type Post = typeof schema.posts.$inferSelect;
export type NewPost = typeof schema.posts.$inferInsert;
```

3. **Create Model** (`src/models/post.ts`):
```typescript
import { BaseModel } from 'nomo/models';
import { posts } from '../db/schema/schema';

export class PostModel extends BaseModel<typeof posts, Post, NewPost> {
  constructor(db, req, env, ctx) {
    super(db, posts, req, env, ctx);
  }

  async findBySlug(slug: string) {
    return this.query().where({ slug }).first();
  }
}
```

4. **Create Service** (`src/services/blog.ts`):
```typescript
import { BaseService } from 'nomo/services';
import { PostModel } from '../models/post';

export class BlogService extends BaseService {
  public posts: PostModel;

  constructor(req, env, ctx) {
    super(req, env, ctx);
    this.posts = new PostModel(this.db, req, env, ctx);
  }

  async getPublishedPosts() {
    return this.posts.query().where({ published: true }).all();
  }
}
```

5. **Create Controller** (`src/controllers/posts_controller.ts`):
```typescript
import { BaseResourceController } from 'nomo/controllers';
import { BlogService } from '../services/blog';
import { PostModel } from '../models/post';

export class PostsController extends BaseResourceController<
  Env, ExecutionContext, BlogService, PostModel, Post, NewPost
> {
  protected service: BlogService;

  constructor(req, env, ctx) {
    super(req, env, ctx);
    this.service = new BlogService(req, env, ctx);
  }

  protected getModel() {
    return this.service.posts;
  }
}
```

6. **Define Routes** (`src/routes.ts`):
```typescript
import { RouteDrawer } from 'nomo/router';

export class AppRoutes extends RouteDrawer<Env, ExecutionContext> {
  draw() {
    this.resources('posts', PostsController);
  }
}
```

7. **Set Up Worker** (`src/index.ts`):
```typescript
import { Router } from 'nomo/router';
import { BaseWorker } from 'nomo/entrypoints';
import { AppRoutes } from './routes';

const router = new Router({ drawer: AppRoutes });

export default class AppWorker extends BaseWorker<Env> {
  router = router;
}
```

### Adding Validation

```typescript
import { BaseValidator } from 'nomo/validators';
import { z } from 'zod';

export class PostsValidator extends BaseValidator {
  protected schema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1)
  });
}

// In controller
export class PostsController extends BaseResourceController {
  static beforeActions = [
    { validate: PostsValidator, only: ['create', 'update'] }
  ];
}
```

### Adding Normalization

```typescript
import { BaseNormalizer } from 'nomo/normalizers';

export class PostsNormalizer extends BaseNormalizer {
  normalize() {
    return {
      ...this.data,
      title: this.data.title?.trim(),
      slug: this.data.title?.toLowerCase().replace(/\s+/g, '-')
    };
  }
}

// In controller
export class PostsController extends BaseResourceController {
  static beforeActions = [
    { normalize: PostsNormalizer, only: ['create', 'update'] }
  ];
}
```

### Adding a Custom Action

```typescript
export class PostsController extends BaseResourceController {
  async published() {
    const posts = await this.service.getPublishedPosts();
    return this.json(posts);
  }
}

// In routes.ts
this.get('/posts/published', PostsController.action('published'));
```

### Accessing Database

```typescript
// Via service (recommended)
this.service.posts.query().where({ id: '123' }).first();

// Via controller (direct)
const results = await this.db.prepare('SELECT * FROM posts').all();
```

### Accessing Durable Objects

```typescript
async getOrCreateSession(userId: string) {
  const id = this.env.SESSIONS.idFromName(userId);
  const stub = this.env.SESSIONS.get(id);
  const response = await stub.fetch('https://internal/session');
  return response.json();
}
```

### Triggering Background Jobs

```typescript
async triggerJob() {
  const runner = new JobRunner({ env: this.env, ctx: this.ctx });
  await runner.enqueue('SendEmailJob', { to: 'user@example.com' });
}
```

### Rendering Views

```typescript
async show() {
  const post = await this.service.getPost(this.params.id);
  
  return this.render({
    view: PostView,
    layout: ApplicationLayout,
    data: { post }
  });
}
```

## Environment Types

Always define proper TypeScript types for environment:

```typescript
// src/env.ts
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  SESSIONS: DurableObjectNamespace;
  MY_WORKFLOW: Workflow;
  EMAIL_QUEUE: Queue;
  SOME_API_KEY: string;
}
```

## Cloudflare Configuration (wrangler.jsonc)

```jsonc
{
  "name": "my-app",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "d1_databases": [{ "binding": "DB", "database_name": "my-app" }],
  "durable_objects": { "bindings": [{ "class_name": "MyDO", "name": "MY_DO" }] },
  "kv_namespaces": [{ "binding": "KV", "id": "..." }],
  "workflows": [{ "name": "MY_WORKFLOW", "binding": "MY_WORKFLOW" }],
  "queues": { "producers": [{ "queue": "my-queue", "binding": "MY_QUEUE" }] }
}
```

## Commands

```bash
# Development
pnpm dev

# Build
pnpm build

# Deploy
wrangler deploy

# Local DB
wrangler d1 create my-db
wrangler d1 migrations apply my-db
```

## Navigation Tips

- **Controllers** handle HTTP and delegate to services
- **Services** contain business logic and use models
- **Models** interact with the database
- **Views** render HTML/JSON/XML responses
- **Routes** connect URLs to controller actions
- **Middleware** runs before/after routes
- Use `BaseResourceController` for automatic REST CRUD
- Use `BaseController` for custom endpoints