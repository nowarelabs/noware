# Services

Services contain business logic and orchestrate data access. They are the layer between controllers and models.

## BaseService

The foundation for all services.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `req` | `Request` | The incoming request |
| `env` | `Env` | Environment variables |
| `ctx` | `RouterContext` | Router context |
| `logger` | `Logger` | Logger instance |
| `db` | `D1Database` | D1 database instance |

### Methods

```typescript
protected async fetch(input: string | Request | URL, init?: RequestInit): Promise<Response> {
  return this.ctx.fetch(input, init);
}

protected createServiceContext(serviceName: string, metadata?: Record<string, any>): RouterContext<Env, Ctx> {
  // Create a child service context
}
```

### Logger

Services have built-in logging with service name context:

```typescript
this.logger.info('Fetching posts', { limit: 10 });
this.logger.error('Failed to fetch', { error: error.message });
```

## Real-World Example

### Blog Service

```typescript
import { BaseService } from 'nomo/services';
import { PostModel } from '../models/post';
import { AuthorModel } from '../models/author';
import type { Post, NewPost } from '../models/types';

export class BlogService extends BaseService<Env, ExecutionContext> {
  public posts: PostModel;
  public authors: AuthorModel;

  constructor(req: Request, env: Env, ctx: any) {
    super(req, env, ctx);
    this.posts = new PostModel(this.db, req, env, ctx);
    this.authors = new AuthorModel(this.db, req, env, ctx);
  }

  async getPublishedPosts(limit = 10, offset = 0): Promise<Post[]> {
    this.logger.info('Fetching published posts', { limit, offset });
    
    return this.posts.query()
      .where({ published: true })
      .orderBy('createdAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .all();
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    this.logger.debug('Fetching post by slug', { slug });
    return this.posts.query().where({ slug }).first();
  }

  async createPost(data: NewPost): Promise<Post> {
    this.logger.info('Creating post', { title: data.title });
    
    return this.posts.create({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async updatePost(id: string, data: Partial<NewPost>): Promise<Post> {
    this.logger.info('Updating post', { id });
    return this.posts.update(id, { ...data, updatedAt: new Date() });
  }

  async deletePost(id: string): Promise<void> {
    this.logger.info('Deleting post', { id });
    return this.posts.delete(id);
  }

  async getPostWithAuthor(postId: string) {
    const post = await this.posts.findById(postId);
    if (!post) return null;
    
    const author = await this.authors.findById(post.authorId);
    return { ...post, author };
  }
}
```

### Service with External API Calls

```typescript
export class EmailService extends BaseService<Env, ExecutionContext> {
  async sendWelcomeEmail(email: string, name: string) {
    this.logger.info('Sending welcome email', { email });
    
    const response = await this.fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email, name }]
        }],
        from: { email: 'noreply@example.com', name: 'My Blog' },
        subject: 'Welcome to My Blog!',
        content: [{ type: 'text/plain', value: `Hi ${name}, welcome!` }]
      })
    });

    if (!response.ok) {
      this.logger.error('Failed to send email', { status: response.status });
      throw new Error('Failed to send email');
    }

    this.logger.info('Welcome email sent', { email });
    return true;
  }
}
```

### Service with Caching

```typescript
export class CacheService extends BaseService<Env, ExecutionContext> {
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttl = 3600): Promise<T> {
    // Try to get from KV
    const cached = await this.env.KV.get(key, 'json') as T | null;
    
    if (cached) {
      this.logger.debug('Cache hit', { key });
      return cached;
    }

    this.logger.debug('Cache miss', { key });
    const value = await fn();
    
    // Store in KV
    await this.env.KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
    
    return value;
  }
}

// Usage in BlogService
async getPopularPosts() {
  return this.getOrSet('popular_posts', async () => {
    return this.posts.query()
      .where({ published: true })
      .orderBy('views', 'DESC')
      .limit(10)
      .all();
  }, 1800); // 30 min cache
}
```

## Service Context

Create child service contexts for nested operations:

```typescript
// In service method
const postCtx = this.createServiceContext('posts', { operation: 'create' });
const postService = new PostService(this.req, this.env, postCtx);
```

## Combining with Other Packages

### With Drizzle ORM

```typescript
import { eq } from 'drizzle-orm';

async function getAuthorPosts(authorId: string) {
  return this.posts.query()
    .where({ authorId })
    .orderBy('createdAt', 'DESC')
    .all();
}
```

### With Durable Objects

```typescript
async getCounter(name: string) {
  const id = this.env.COUNTERS.idFromName(name);
  const stub = this.env.COUNTERS.get(id);
  const response = await stub.fetch('https://internal/counter');
  return response.json();
}
```

### With Background Jobs

```typescript
import { JobRunner } from 'nomo/jobs';

async function schedulePostNotification(postId: string) {
  const runner = new JobRunner({ env: this.env, ctx: this.ctx });
  await runner.enqueue('PostNotificationJob', { postId });
}
```