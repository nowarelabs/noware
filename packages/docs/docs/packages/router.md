# Router

The router provides HTTP routing with trie-based matching, middleware support, and a fluent API for defining routes.

## Basic Usage

```typescript
import { Router, RouteDrawer } from 'nomo/router';

// Simple route
const router = new Router();
router.get('/', (req, env, ctx) => new Response('Hello World'));

// Route with parameters
router.get('/users/:id', (req, env, ctx) => {
  return ctx.json({ userId: ctx.params.id });
});
```

## RouteDrawer (Fluent API)

The `RouteDrawer` provides a fluent interface for defining routes.

```typescript
import { RouteDrawer } from 'nomo/router';
import type { AppExecutionContext } from 'nomo/router';
import { PostsController } from './controllers/posts_controller';

export class AppRoutes extends RouteDrawer<Env, AppExecutionContext> {
  draw() {
    // Define routes here
  }
}
```

### HTTP Methods

```typescript
draw() {
  this.get('/path', handler);
  this.post('/path', handler);
  this.put('/path', handler);
  this.patch('/path', handler);
  this.delete('/path', handler);
  this.all('/path', handler); // any method
}
```

### Route Parameters

```typescript
// URL parameters
this.get('/users/:id', (req, env, ctx) => {
  const { id } = ctx.params;
  return ctx.json({ userId: id });
});

// Multiple params
this.get('/posts/:postId/comments/:commentId', (req, env, ctx) => {
  const { postId, commentId } = ctx.params;
});
```

### Query Parameters

```typescript
this.get('/search', (req, env, ctx) => {
  const { q, page } = ctx.query;
  return ctx.json({ query: q, page: page || '1' });
});
```

### Nested Parameters

```typescript
// Request body: { user: { name: 'John', email: 'john@example.com' } }
this.post('/users', (req, env, ctx) => {
  const { user } = ctx.params; // { name: 'John', email: 'john@example.com' }
});
```

## Resources (CRUD)

Automatically generate RESTful CRUD routes:

```typescript
draw() {
  // Generates: GET /posts, POST /posts, GET /posts/:id, PATCH /posts/:id, DELETE /posts/:id
  this.resources('posts', PostsController);
}
```

Generated routes:
| Method | Path | Action |
|--------|------|--------|
| GET | `/posts` | index |
| POST | `/posts` | create |
| GET | `/posts/:id` | show |
| PATCH | `/posts/:id` | update |
| DELETE | `/posts/:id` | destroy |

### Resource Actions (Full)

Includes all lifecycle actions:

```typescript
draw() {
  // Full CRUD + lifecycle
  this.resourceActions('posts', PostsController);
}
```

Generated routes include: index, create, show, update, destroy, trash, restore, hide, unhide, flag, unflag, purge, retire, unretire, queue, cron, add, remove, assign, unassign, and relationship traversal endpoints.

## Namespaces

Group routes under a prefix:

```typescript
draw() {
  this.namespace('api', (api) => {
    api.get('/health', handler);
    api.resources('posts', PostsController);
  });
}
```

Results in: `/api/health`, `/api/posts`, etc.

## Versioning

API versioning:

```typescript
draw() {
  this.version('1', (v1) => {
    v1.get('/posts', handler);
  });
  
  this.version('2', (v2) => {
    v2.get('/posts', handler);
  });
}
```

Results in: `/v1/posts`, `/v2/posts`

## Middleware

Add middleware to routes:

```typescript
// Global middleware
this.use(authMiddleware);

// Route-specific
this.get('/admin', authMiddleware, adminHandler);
```

### Middleware Pattern

```typescript
import { Middleware } from 'nomo/router';

export const loggerMiddleware: Middleware<Env, Ctx> = async (req, env, ctx, next) => {
  const start = Date.now();
  const response = await next();
  console.log(`${req.method} ${ctx.path} - ${Date.now() - start}ms`);
  return response;
};

export const authMiddleware: Middleware<Env, Ctx> = async (req, env, ctx, next) => {
  const token = req.headers.get('authorization');
  
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  return next();
};
```

## Scopes

Scope routes under a path:

```typescript
draw() {
  this.scope('admin', (admin) => {
    admin.get('/dashboard', handler);
    admin.resources('posts', PostsController);
  });
}
```

## Real-World Example

```typescript
import { RouteDrawer } from 'nomo/router';
import type { AppExecutionContext } from 'nomo/router';

import { PostsController } from './controllers/posts_controller';
import { AuthorsController } from './controllers/authors_controller';
import { healthCheckMiddleware } from './middlewares';

export class AppRoutes extends RouteDrawer<Env, AppExecutionContext> {
  draw() {
    // Global middleware
    this.use(healthCheckMiddleware);
    
    // Public routes
    this.get('/', (req, env, ctx) => ctx.html('<h1>Welcome to My Blog</h1>'));
    this.get('/health', (req, env, ctx) => ctx.json({ status: 'ok' }));
    
    // Blog posts
    this.get('/posts', PostsController.action('index'));
    this.get('/posts/:slug', PostsController.action('showBySlug'));
    
    // API v1
    this.version('1', (v1) => {
      v1.namespace('blog', (blog) => {
        // RESTful CRUD
        blog.resources('posts', PostsController);
        blog.resources('authors', AuthorsController);
      });
      
      // RPC
      v1.namespace('rpc', (rpc) => {
        rpc.post('/posts', PostsController.action('rpc'));
      });
    });
    
    // Admin (scoped)
    this.scope('admin', (admin) => {
      admin.get('/dashboard', (req, env, ctx) => ctx.json({ admin: true }));
      admin.resources('posts', PostsController);
    });
  }
}
```

### Router Setup in Worker

```typescript
// src/index.ts
import { Router } from 'nomo/router';
import { BaseWorker } from 'nomo/entrypoints';
import { AppRoutes } from './routes';

const router = new Router<Env, ExecutionContext>({
  drawer: AppRoutes,
  onNotFound: (req, env, ctx) => {
    return new Response('Not Found', { status: 404 });
  }
});

export default class AppWorker extends BaseWorker<Env> {
  router = router;
}
```

## Context Methods

| Method | Description |
|--------|-------------|
| `ctx.parseJson()` | Parse request body as JSON |
| `ctx.json(data, init)` | Send JSON response |
| `ctx.text(data, init)` | Send text response |
| `ctx.html(data, init)` | Send HTML response |
| `ctx.redirect(url, status)` | Redirect to URL |
| `ctx.params` | Route parameters |
| `ctx.query` | Query string parameters |
| `ctx.headers` | Request headers |

## Router Options

```typescript
const router = new Router<Env, ExecutionContext>({
  drawer: AppRoutes,           // RouteDrawer class
  basePath: '/api',            // Base path for all routes
  prefix: 'v1',                // URL prefix
  strict: true,                // Strict path matching
  onNotFound: handler,         // 404 handler
  onError: handler             // Error handler
});
```

## Combining with Other Packages

### With OpenAPI

```typescript
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

const registry = new OpenAPIRegistry();
registry.registerPath({
  method: 'get',
  path: '/posts/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { 
      description: 'Post found',
      content: { 'application/json': { schema: z.object({ id: z.string(), title: z.string() }) } }
    },
    404: { description: 'Post not found' }
  }
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const openApiDoc = generator.generateDocument({
  openapi: '3.0.0',
  info: { title: 'My API', version: '1.0.0' }
});
```

### With Tracing

The router includes OpenTelemetry support for distributed tracing:

```typescript
// Automatic tracing enabled
this.get('/users', handler); // Traced automatically
```