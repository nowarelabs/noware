# Controllers

Controllers handle HTTP requests and delegate to services. They are the entry point for request handling in Nomo.

## BaseController

The foundation for all controllers. Provides request/response handling, validation, and rendering.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `request` | `Request` | The incoming HTTP request |
| `env` | `Env` | Environment variables (includes D1, KV, DO bindings) |
| `ctx` | `RouterContext` | Router context with params, query, etc. |
| `service` | `Service` | Injected service for business logic |

### Accessors

```typescript
// All params (path + query + body)
this.params

// URL path parameters only
this.pathParams

// Query string parameters only  
this.queryParams

// Request headers
this.headers

// Cookies (parsed)
this.cookies

// Client IP address
this.ip

// HTTP method
this.method

// Request path
this.path

// Full URL
this.url

// Logger with controller context
this.logger

// Database (D1)
this.db
```

### Response Methods

```typescript
// JSON response
this.json({ data: 'value' })
this.json({ data: 'value' }, { status: 201 })

// Text response
this.text('Hello World')

// HTML response
this.html('<h1>Hello</h1>')

// XML response
this.xml('<root><item>value</item></root>')

// CSV response
this.csv('col1,col2\nval1,val2')

// Excel (xlsx)
this.xlsx(uint8ArrayData)

// Redirect
this.redirect_to('/new-path')

// Render view (JSX)
this.render({
  view: UserView,
  layout: MainLayout,
  data: { user }
})
```

### Error Responses

```typescript
// 404 Not Found
return this.notFound('User not found')

// 401 Unauthorized
return this.unauthorized('Please login')

// 403 Forbidden
return this.forbidden('Access denied')

// 400 Bad Request
return this.badRequest('Invalid input')

// 500 Internal Server Error
return this.internalServerError('Something went wrong')
```

### Cookies

```typescript
// Set cookie
this.setCookie('session', 'abc123', {
  expires: new Date(Date.now() + 86400000),
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict'
});

// Delete cookie
this.deleteCookie('session');
```

## BaseResourceController

Extends `BaseController` for RESTful CRUD operations with automatic endpoints.

### Automatic REST Actions

| Action | Method | Description |
|--------|--------|-------------|
| `index` | GET | List all resources |
| `show` | GET | Get single resource |
| `new` | GET | Form for new resource |
| `create` | POST | Create resource |
| `edit` | GET | Form for editing |
| `update` | PUT/PATCH | Update resource |
| `destroy` | DELETE | Delete resource |

### Lifecycle Actions

```typescript
async trash(id)      // Soft delete (sets deleted_at)
async restore(id)   // Restore from soft delete
async hide(id)      // Hide resource
async unhide(id)    // Unhide resource
async flag(id)      // Flag resource
async unflag(id)   // Unflag resource
async purge(id)     // Hard delete
async retire(id)    // Mark as retired
async unretire(id)  // Unretire
```

### Relationship Actions

```typescript
async listChildIds()      // Get child IDs
async listParentIds()     // Get parent IDs
async listSiblingIds()   // Get sibling IDs
async listAncestorIds()  // Get ancestor IDs
async listDescendantIds() // Get descendant IDs
```

### Eager Loading

```typescript
async findAllWith()  // Find with includes
async findWith()    // Find single with includes
```

## Real-World Example

### Blog Posts Controller

```typescript
import { RouterContext } from 'nomo/router';
import { BaseResourceController } from 'nomo/controllers';
import { BlogService } from '../services/blog';
import { PostModel } from '../models/post';
import type { Post, NewPost } from '../models/types';

export class PostsController extends BaseResourceController<
  Env,
  ExecutionContext,
  BlogService,
  PostModel,
  Post,
  NewPost
> {
  protected service: BlogService;

  constructor(req: Request, env: Env, ctx: RouterContext<Env, ExecutionContext>) {
    super(req, env, ctx);
    this.service = new BlogService(req, env, ctx);
  }

  protected getModel() {
    return this.service.posts;
  }

  // Custom: Get only published posts
  async published() {
    const posts = await this.service.getPublishedPosts();
    return this.json(posts);
  }

  // Custom: Get by slug instead of ID
  async showBySlug() {
    const { slug } = this.pathParams;
    const post = await this.service.getPostBySlug(slug);
    
    if (!post) {
      return this.notFound('Post not found');
    }
    
    return this.json(post);
  }
}
```

### With Validation & Normalization

```typescript
import { BaseResourceController } from 'nomo/controllers';
import { PostsValidator } from '../validators/posts';
import { PostsNormalizer } from '../normalizers/posts';

export class PostsController extends BaseResourceController<...> {
  // Hooks for validation/normalization
  static beforeActions = [
    { 
      normalize: PostsNormalizer, 
      only: ['create', 'update'] 
    },
    { 
      validate: PostsValidator, 
      only: ['create'] 
    }
  ];

  // ... rest of controller
}
```

### Service Layer

```typescript
import { BaseService } from 'nomo/services';
import { PostModel } from '../models/post';

export class BlogService extends BaseService {
  public posts: PostModel;

  constructor(req: Request, env: Env, ctx: any) {
    super(req, env, ctx);
    this.posts = new PostModel(this.db, req, env, ctx);
  }

  async getPublishedPosts(limit = 10, offset = 0) {
    return this.posts.query()
      .where({ published: true })
      .orderBy('createdAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .all();
  }

  async getPostBySlug(slug: string) {
    return this.posts.query().where({ slug }).first();
  }
}
```

### Model

```typescript
import { BaseModel } from 'nomo/models';
import { posts } from '../db/schema';

export class PostModel extends BaseModel<typeof posts, Post, NewPost> {
  constructor(db, req, env, ctx) {
    super(db, posts, req, env, ctx);
    this.hasMany('comments', { model: 'CommentModel', foreignKey: 'postId' });
  }
}
```

### Router Setup

```typescript
import { RouteDrawer } from 'nomo/router';

export class AppRoutes extends RouteDrawer<Env, ExecutionContext> {
  draw() {
    // Public routes
    this.get('/posts', PostsController.action('published'));
    this.get('/posts/:slug', PostsController.action('showBySlug'));
    
    // Admin CRUD routes
    this.namespace('admin', (admin) => {
      admin.resources('posts', PostsController);
    });
  }
}
```

## Validation & Normalization

### Validator

```typescript
import { BaseValidator } from 'nomo/validators';
import { z } from 'zod';

export class PostsValidator extends BaseValidator {
  protected schema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    published: z.boolean().optional()
  });
}
```

### Normalizer

```typescript
import { BaseNormalizer } from 'nomo/normalizers';

export class PostsNormalizer extends BaseNormalizer {
  normalize() {
    return {
      ...this.data,
      title: this.data.title?.trim(),
      slug: this.data.slug?.toLowerCase().replace(/\s+/g, '-')
    };
  }
}
```

## Combining with Other Packages

### With Drizzle ORM

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: text('published').default('false')
});

// In model
this.query().where({ published: 'true' }).all();
```

### With Durable Objects

```typescript
// Access DO from controller
async accessDO() {
  const id = this.env.COUNTERS.idFromName('my-counter');
  const stub = this.env.COUNTERS.get(id);
  const response = await stub.fetch('https://internal/count');
  return this.json(await response.json());
}
```

### With Background Jobs

```typescript
import { JobRunner } from 'nomo/jobs';

async triggerJob() {
  const runner = new JobRunner({ env: this.env, ctx: this.ctx });
  await runner.enqueue('SendEmailJob', { to: this.body.email });
  return this.json({ queued: true });
}
```