# Getting Started

Build a full-stack blog application with Nomo on Cloudflare Workers.

## Prerequisites

- Node.js 18+ 
- A Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

## Installation

::: code-group

```bash [npm]
npm create nomo@latest my-blog
cd my-blog
npm install
```

```bash [pnpm]
pnpm create nomo@latest my-blog
cd my-blog
pnpm install
```

```bash [yarn]
yarn create nomo@latest my-blog
cd my-blog
yarn install
```

```bash [bun]
bun create nomo@latest my-blog
cd my-blog
bun install
```

:::

## Step 1: Set Up Database (D1)

Create a D1 database for your blog:

```bash
wrangler d1 create blog-db
```

Add the binding to `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "blog-db",
    "database_id": "your-database-id"
  }]
}
```

## Step 2: Define Database Schema

Create `src/db/schema/schema.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  published: integer('published', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const authors = sqliteTable('authors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull()
});
```

## Step 3: Create Models

Create `src/models/post.ts`:

```typescript
import { BaseModel, type DatabaseInstance } from 'nomo/models';
import { posts } from '../db/schema/schema';
import type { Post, NewPost } from './types';

export class PostModel extends BaseModel<typeof posts, Post, NewPost> {
  constructor(db: DatabaseInstance, req: Request, env: Env, ctx: any) {
    super(db, posts, req, env, ctx);
  }

  async findBySlug(slug: string) {
    return this.query().where({ slug }).first();
  }

  async findPublished(limit = 10, offset = 0) {
    return this.query()
      .where({ published: true })
      .orderBy('createdAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .all();
  }
}
```

Create `src/models/types.ts`:

```typescript
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import * as schema from '../db/schema/schema';

export const postsSelectSchema = createSelectSchema(schema.posts);
export const postsInsertSchema = createInsertSchema(schema.posts);

export type Post = typeof schema.posts.$inferSelect;
export type NewPost = typeof schema.posts.$inferInsert;
```

## Step 4: Create Services

Create `src/services/blog.ts`:

```typescript
import { BaseService } from 'nomo/services';
import { PostModel } from '../models/post';
import type { Post, NewPost } from '../models/types';

export class BlogService extends BaseService {
  public posts: PostModel;

  constructor(req: Request, env: Env, ctx: any) {
    super(req, env, ctx);
    this.posts = new PostModel(this.db, req, env, ctx);
  }

  async getAllPosts(limit = 10, offset = 0): Promise<Post[]> {
    return this.posts.findPublished(limit, offset);
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    return this.posts.findBySlug(slug);
  }

  async createPost(data: NewPost): Promise<Post> {
    return this.posts.create({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async updatePost(id: string, data: Partial<NewPost>): Promise<Post> {
    return this.posts.update(id, { ...data, updatedAt: new Date() });
  }

  async deletePost(id: string): Promise<void> {
    return this.posts.delete(id);
  }
}
```

## Step 5: Create Controllers

Create `src/controllers/posts_controller.ts`:

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

  // Custom action - Get published posts only
  async published() {
    const posts = await this.service.getAllPosts();
    return this.json(posts);
  }

  // Custom action - Get single post by slug
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

## Step 6: Set Up Router

Create `src/routes.ts`:

```typescript
import { RouteDrawer } from 'nomo/router';
import type { AppExecutionContext } from 'nomo/router';
import { PostsController } from './controllers/posts_controller';

export class AppRoutes extends RouteDrawer<Env, AppExecutionContext> {
  draw() {
    // Public routes
    this.get('/health', (req, env, ctx) => {
      return ctx.json({ status: 'ok' });
    });

    this.get('/posts', PostsController.action('published'));
    this.get('/posts/:slug', PostsController.action('showBySlug'));

    // Admin routes
    this.namespace('admin', (admin) => {
      admin.resources('posts', PostsController);
    });
  }
}
```

## Step 7: Create Entry Point

Update `src/index.ts`:

```typescript
import { Router } from 'nomo/router';
import { BaseWorker } from 'nomo/entrypoints';
import { AppRoutes } from './routes';

const router = new Router<Env, ExecutionContext>({
  drawer: AppRoutes
});

export default class BlogWorker extends BaseWorker<Env> {
  router = router;
}
```

## Step 8: Configure wrangler.jsonc

```jsonc
{
  "name": "my-blog",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "d1_databases": [{
    "binding": "DB",
    "database_name": "blog-db",
    "database_id": "your-database-id"
  }]
}
```

## Step 9: Run Locally

```bash
pnpm dev
```

Visit `http://localhost:8787` to see your blog.

## Step 10: Deploy

```bash
wrangler deploy
```

## Project Structure

```
my-blog/
├── src/
│   ├── controllers/
│   │   └── posts_controller.ts
│   ├── services/
│   │   └── blog.ts
│   ├── models/
│   │   ├── post.ts
│   │   └── types.ts
│   ├── db/
│   │   └── schema/
│   │       └── schema.ts
│   ├── routes.ts
│   └── index.ts
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

## Next Steps

- [Architecture](/packages/architecture) - Learn how Nomo works
- [Controllers](/packages/controllers) - Deep dive into controllers
- [Examples](/packages/examples) - More practical code examples