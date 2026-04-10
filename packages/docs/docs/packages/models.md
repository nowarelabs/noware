# Models

Models handle database operations using Drizzle ORM with D1 (SQLite) or Durable Object storage.

## BaseModel

The foundation for all database models.

### Constructor

```typescript
constructor(
  private db: DatabaseInstance,  // D1 database or DO storage
  private table: TTable,          // Drizzle table definition
  private req?: Request,
  private env?: Env,
  private ctx?: any
)
```

### Fluent Query API

```typescript
// Create query
const query = this.query()

// Select columns
query.select('id', 'title', 'createdAt')

// Where conditions
query.where({ published: true })
query.where({ id: { eq: '123' } })
query.where({ age: { gt: 18 } })
query.where({ status: { in: ['active', 'pending'] } })

// Order by
query.orderBy('createdAt', 'DESC')

// Pagination
query.limit(10).offset(0)

// Execute
const results = await query.all()
const single = await query.first()
```

### Operators

| Operator | Usage | Description |
|----------|-------|-------------|
| `eq` | `{ id: { eq: '123' } }` | Equal |
| `neq` | `{ status: { neq: 'deleted' } }` | Not equal |
| `gt` | `{ age: { gt: 18 } }` | Greater than |
| `gte` | `{ score: { gte: 60 } }` | Greater or equal |
| `lt` | `{ price: { lt: 100 } }` | Less than |
| `lte` | `{ qty: { lte: 0 } }` | Less or equal |
| `like` | `{ title: { like: '%intro%' } }` | LIKE pattern |
| `in` | `{ id: { in: ['1', '2', '3'] } }` | IN list |
| `nin` | `{ status: { nin: ['archived'] } }` | NOT IN list |
| `null` | `{ deletedAt: null }` | IS NULL |

## Real-World Examples

### Basic Model

```typescript
import { BaseModel, type DatabaseInstance } from 'nomo/models';
import { posts } from '../db/schema/schema';
import type { Post, NewPost } from './types';

export class PostModel extends BaseModel<typeof posts, Post, NewPost> {
  constructor(db: DatabaseInstance, req: Request, env: Env, ctx: any) {
    super(db, posts, req!, env!, ctx!);
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

  async findByAuthor(authorId: string) {
    return this.query()
      .where({ authorId })
      .orderBy('createdAt', 'DESC')
      .all();
  }
}
```

### With Relationships

```typescript
export class PostModel extends BaseModel<typeof posts, Post, NewPost> {
  constructor(db: DatabaseInstance, req: Request, env: Env, ctx: any) {
    super(db, posts, req!, env!, ctx!);
    
    // Define relationships
    this.hasMany('comments', { model: 'CommentModel', foreignKey: 'postId' });
    this.belongsTo('author', { model: 'AuthorModel', foreignKey: 'authorId' });
  }
}

// Usage with eager loading
const postsWithComments = await postModel.query()
  .where({ published: true })
  .with('comments')
  .all();
```

### CRUD Operations

```typescript
// Create
const newPost = await postModel.create({
  title: 'My First Post',
  slug: 'my-first-post',
  content: 'Hello World',
  published: false,
  authorId: 'author-123'
});

// Read
const post = await postModel.findById('post-123');
const allPosts = await postModel.all();

// Update
const updated = await postModel.update('post-123', {
  title: 'Updated Title',
  published: true
});

// Delete
await postModel.delete('post-123');
```

## Database Schema

### Schema Definition (Drizzle)

```typescript
// src/db/schema/schema.ts
import { sqliteTable, text, integer, real, foreignKey } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  featuredImage: text('featured_image'),
  published: integer('published', { mode: 'boolean' }).default(false),
  authorId: text('author_id').references(() => authors.id),
  views: integer('views').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const authors = sqliteTable('authors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  bio: text('bio'),
  avatar: text('avatar'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').references(() => posts.id).notNull(),
  authorName: text('author_name').notNull(),
  content: text('content').notNull(),
  approved: integer('approved', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### TypeScript Types

```typescript
// src/models/types.ts
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import * as schema from '../db/schema/schema';

// Schemas for validation
export const postsSelectSchema = createSelectSchema(schema.posts);
export const postsInsertSchema = createInsertSchema(schema.posts);

// Types
export type Post = typeof schema.posts.$inferSelect;
export type NewPost = typeof schema.posts.$inferInsert;
export type Author = typeof schema.authors.$inferSelect;
export type NewAuthor = typeof schema.authors.$inferInsert;
export type Comment = typeof schema.comments.$inferSelect;
export type NewComment = typeof schema.comments.$inferInsert;
```

## Soft Deletes & Lifecycle

```typescript
// Using BaseResourceController lifecycle methods
// These are handled automatically in the controller

// Soft delete (trash)
await postModel.trash('post-123');

// Restore
await postModel.restore('post-123');

// Hard delete (purge)
await postModel.purge('post-123');
```

## Advanced Queries

### Joins

```typescript
const postsWithAuthor = await postModel.query()
  .join(authors, 'posts.author_id = authors.id')
  .select('posts.*', 'authors.name as authorName')
  .where({ 'posts.published': true })
  .all();
```

### Aggregation

```typescript
// Count
const count = await postModel.query().where({ published: true }).count();

// Pluck single column
const titles = await postModel.query().pluck('title');

// Exists
const exists = await postModel.query().where({ slug: 'my-post' }).exists();
```

### Transactions

```typescript
async function createPostWithComments(postData, commentsData) {
  const post = await postModel.create(postData);
  
  for (const comment of commentsData) {
    await commentModel.create({
      ...comment,
      postId: post.id
    });
  }
  
  return post;
}
```

## Combining with Other Packages

### With Controllers

```typescript
// In controller
export class PostsController extends BaseResourceController<...> {
  protected service: BlogService;

  protected getModel() {
    return this.service.posts;
  }

  async published() {
    const posts = await this.service.getPublishedPosts();
    return this.json(posts);
  }
}
```

### With Durable Objects

```typescript
// DO uses different database instance
export class BlogDO extends DurableObject {
  async onMessage(message: any) {
    const postModel = new PostModel(this.storage, req, env, ctx);
    await postModel.create(message.data);
  }
}
```

### With Migrations

```typescript
// Run migrations
import { migrate } from 'drizzle-orm/d1/migrator';
await migrate(db, { migrationsFolder: './drizzle' });
```