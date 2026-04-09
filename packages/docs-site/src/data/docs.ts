import type { DocsPage } from "../types";

export const DOCS_PAGES: DocsPage[] = [
  {
    slug: "index",
    title: "Documentation",
    content: "",
    category: "guide",
    order: 0,
  },
  {
    slug: "getting-started",
    title: "Getting Started",
    content: "",
    category: "guide",
    order: 1,
  },
  {
    slug: "architecture",
    title: "Architecture",
    content: "",
    category: "guide",
    order: 2,
  },
  {
    slug: "api",
    title: "API Reference",
    content: "",
    category: "api",
    order: 3,
  },
  {
    slug: "examples",
    title: "Examples",
    content: "",
    category: "example",
    order: 4,
  },
];

export const PACKAGE_DOCS: Record<string, DocsPage> = {
  router: {
    slug: "router",
    title: "nomo/router",
    content: `<h2>nomo/router</h2>
<p>A powerful trie-based router for Cloudflare Workers with Rails-like routing patterns.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/router</code></pre>

<h3>Features</h3>
<ul>
  <li>Trie-based routing for O(k) path matching</li>
  <li>RESTful resources and nested routes</li>
  <li>Path parameters and wildcards</li>
  <li>Middleware support</li>
  <li>OpenAPI 3.0 integration</li>
  <li>OpenTelemetry tracing</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { Router, RouteDrawer } from 'nomo/router';

class AppRouter extends RouteDrawer {
  draw() {
    this.get('/', (req, env, ctx) => ctx.html('Hello World'));
    this.get('/users', UsersController.action('index'));
    this.get('/users/:id', UsersController.action('show'));
  }
}

const router = new Router({ drawer: AppRouter });
export default { fetch: router.handle.bind(router) };</code></pre>

<h3>Route Parameters</h3>
<p>Define dynamic route parameters with the :prefix:</p>
<pre><code class="language-typescript">this.get('/users/:id/posts/:postId', (req, env, ctx) => {
  const { id, postId } = ctx.params;
  return ctx.json({ userId: id, postId });
});</code></pre>

<h3>Resources</h3>
<p>Create RESTful resource routes automatically:</p>
<pre><code class="language-typescript">class AppRouter extends RouteDrawer {
  draw() {
    this.resources('users', UsersController);
  }
}</code></pre>

<p>This creates: GET /users, POST /users, GET /users/:id, PATCH /users/:id, DELETE /users/:id</p>

<h3>Middleware</h3>
<p>Add global middleware:</p>
<pre><code class="language-typescript">const authMiddleware = async (req, env, ctx, next) => {
  const token = req.headers.get('Authorization');
  if (!token) return ctx.json({ error: 'Unauthorized' }, { status: 401 });
  return next();
};

router.use(authMiddleware);</code></pre>

<h3>Query Parameters</h3>
<p>Access parsed query parameters:</p>
<pre><code class="language-typescript">this.get('/search', (req, env, ctx) => {
  const { q, page, limit } = ctx.query;
  // ctx.query contains parsed query string
});</code></pre>

<h3>Validation</h3>
<p>Use Zod schemas for request validation:</p>
<pre><code class="language-typescript">import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

this.post('/users', Router.zValidator('json', createUserSchema), UsersController.action('create'));</code></pre>

<h3>OpenAPI Integration</h3>
<p>Generate OpenAPI specs automatically:</p>
<pre><code class="language-typescript">router.openapi({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    '200': { description: 'User found', content: { 'application/json': { schema: UserSchema } } },
    '404': { description: 'User not found' },
  },
}, UsersController.action('show'));

const openapiDoc = router.getOpenApiDocument({ title: 'My API', version: '1.0.0' });</code></pre>

<h3>Context Methods</h3>
<p>The router context provides convenient methods:</p>
<ul>
  <li><code>ctx.json(data, init?)</code> - Return JSON response</li>
  <li><code>ctx.text(data, init?)</code> - Return text response</li>
  <li><code>ctx.html(data, init?)</code> - Return HTML response</li>
  <li><code>ctx.redirect(url, status?)</code> - Redirect to URL</li>
  <li><code>ctx.cache(seconds)</code> - Set cache headers</li>
  <li><code>ctx.parseJson()</code> - Parse request body as JSON</li>
</ul>`,
    category: "package",
    order: 1,
  },
  controllers: {
    slug: "controllers",
    title: "nomo/controllers",
    content: `<h2>nomo/controllers</h2>
<p>Rails-like controller abstractions for handling HTTP requests.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/controllers</code></pre>

<h3>Features</h3>
<ul>
  <li>RESTful action methods</li>
  <li>Automatic JSON serialization</li>
  <li>Filter support (before/after actions)</li>
  <li>Resource actions</li>
  <li>Action result wrapping</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { Controller, action } from 'nomo/controllers';

export class UsersController extends Controller {
  static async index(_req, _env, ctx) {
    return ctx.json({ users: [] });
  }
  
  static async show(req, env, ctx) {
    const userId = ctx.params.id;
    return ctx.json({ id: userId });
  }
  
  static async create(req, env, ctx) {
    const body = await ctx.parseJson();
    return ctx.json({ user: body }, { status: 201 });
  }
}</code></pre>

<h3>Resource Actions</h3>
<p>Controllers support standard REST actions:</p>
<pre><code class="language-typescript">class UsersController extends Controller {
  static async index(req, env, ctx) {}    // GET    /users
  static async create(req, env, ctx) {}    // POST   /users
  static async show(req, env, ctx) {}      // GET    /users/:id
  static async update(req, env, ctx) {}    // PATCH  /users/:id
  static async destroy(req, env, ctx) {}   // DELETE /users/:id
}</code></pre>

<h3>Custom Actions</h3>
<p>Define custom actions:</p>
<pre><code class="language-typescript">class UsersController extends Controller {
  static async activate(req, env, ctx) {
    const userId = ctx.params.id;
    // Activation logic
    return ctx.json({ success: true });
  }
  
  static async deactivate(req, env, ctx) {
    const userId = ctx.params.id;
    // Deactivation logic
    return ctx.json({ success: true });
  }
}

// In router
this.post('/users/:id/activate', UsersController.action('activate'));
this.post('/users/:id/deactivate', UsersController.action('deactivate'));</code></pre>

<h3>Action Helper</h3>
<p>Use the action helper to bind methods:</p>
<pre><code class="language-typescript">import { Controller, action } from 'nomo/controllers';

this.get('/users', UsersController.action('index'));
this.post('/users', UsersController.action('create'));</code></pre>

<h3>Filters</h3>
<p>Add before/after filters:</p>
<pre><code class="language-typescript">class ApplicationController extends Controller {
  static beforeAction = ['authenticate'];
  
  static async authenticate(req, env, ctx) {
    const token = req.headers.get('Authorization');
    if (!token) {
      return ctx.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
}</code></pre>

<h3>Strong Parameters</h3>
<p>Use permitted params helper:</p>
<pre><code class="language-typescript">class UsersController extends Controller {
  static async create(req, env, ctx) {
    const body = await ctx.parseJson();
    const permitted = this.permit(body, ['name', 'email']);
    // Use permitted params
  }
  
  static permit(params: any, keys: string[]) {
    return keys.reduce((acc, key) => {
      if (params[key] !== undefined) acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);
  }
}</code></pre>`,
    category: "package",
    order: 2,
  },
  models: {
    slug: "models",
    title: "nomo/models",
    content: `<h2>nomo/models</h2>
<p>Type-safe database models using Drizzle ORM.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/models</code></pre>

<h3>Features</h3>
<ul>
  <li>Drizzle ORM integration</li>
  <li>Type-safe queries</li>
  <li>Automatic migrations</li>
  <li>Schema definitions</li>
  <li>OpenAPI schema generation</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { Model, Column } from 'nomo/models';
import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export class User extends Model {
  static table = 'users';
  static schema = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    age: integer('age'),
  });
  
  static async findById(id: number) {
    return this.query.where(this.schema.id.eq(id)).first();
  }
  
  static async findByEmail(email: string) {
    return this.query.where(this.schema.email.eq(email)).first();
  }
  
  static async create(data: { name: string; email: string }) {
    return this.insert(data);
  }
}</code></pre>

<h3>Query Methods</h3>
<pre><code class="language-typescript">// Find single record
const user = await User.findById(1);

// Find all
const users = await User.all();

// Where clause
const users = await User.query.where(User.schema.age.gt(18)).all();

// Pagination
const paginated = await User.query.limit(10).offset(0).all();

// Order by
const sorted = await User.query.orderBy(User.schema.name).all();</code></pre>

<h3>CRUD Operations</h3>
<pre><code class="language-typescript">// Create
const newUser = await User.create({ name: 'John', email: 'john@example.com' });

// Update
const updated = await User.whereId(1).update({ name: 'Jane' });

// Delete
await User.whereId(1).delete();

// Upsert
const user = await User.upsert({ email: 'john@example.com' }, { name: 'John' });</code></pre>

<h3>Relationships</h3>
<pre><code class="language-typescript">// Has many
class Post extends Model {
  static schema = pgTable('posts', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => User.schema.id),
    title: text('title').notNull(),
  });
  
  static user() {
    return this.hasOne(User, 'userId');
  }
}

// Belongs to
class User extends Model {
  static posts() {
    return this.hasMany(Post);
  }
}</code></pre>

<h3>Transactions</h3>
<pre><code class="language-typescript">import { Transaction } from 'nomo/models';

await Transaction.execute(async (tx) => {
  await User.create({ name: 'John', email: 'john@example.com' }, { tx });
  await Post.create({ userId: 1, title: 'Hello' }, { tx });
});</code></pre>`,
    category: "package",
    order: 3,
  },
  services: {
    slug: "services",
    title: "nomo/services",
    content: `<h2>nomo/services</h2>
<p>Service layer for business logic with dependency injection.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/services</code></pre>

<h3>Features</h3>
<ul>
  <li>Service providers</li>
  <li>Dependency injection</li>
  <li>Scoped services</li>
  <li>Factory pattern support</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { Service, ServiceProvider } from 'nomo/services';

class EmailService extends Service {
  async send(to: string, subject: string, body: string) {
    // Send email logic
    return { success: true, messageId: 'msg-123' };
  }
}

class AppProvider extends ServiceProvider {
  register() {
    this.provide('emailService', EmailService);
  }
}</code></pre>

<h3>Using Services</h3>
<p>Inject services in controllers:</p>
<pre><code class="language-typescript">class UsersController extends Controller {
  static async create(req, env, ctx) {
    const emailService = ctx.router.inject('emailService') as EmailService;
    await emailService.send(user.email, 'Welcome!', 'Welcome to our app');
    return ctx.json({ success: true });
  }
}</code></pre>

<h3>Provider Registration</h3>
<pre><code class="language-typescript">class AppRouter extends RouteDrawer {
  draw() {
    this.provide('emailService', new EmailService());
    this.provide('cacheService', new CacheService());
    this.provide('logger', new LoggerService());
  }
}</code></pre>

<h3>Scoped Services</h3>
<p>Create request-scoped services:</p>
<pre><code class="language-typescript">class RequestContext extends Service {
  requestId: string;
  userId?: number;
  
  constructor(requestId: string) {
    super();
    this.requestId = requestId;
  }
}

router.use(async (req, env, ctx, next) => {
  const requestId = crypto.randomUUID();
  ctx.router.provide('requestContext', new RequestContext(requestId));
  return next();
});</code></pre>`,
    category: "package",
    order: 4,
  },
  views: {
    slug: "views",
    title: "nomo/views",
    content: `<h2>nomo/views</h2>
<p>View components and JSX runtime for building UIs.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/views</code></pre>

<h3>Features</h3>
<ul>
  <li>JSX support for Cloudflare Workers</li>
  <li>Server-side rendering</li>
  <li>Component library</li>
  <li>Template helpers</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { html } from 'nomo/views';

export function HomePage({ title }: { title: string }) {
  return html\`
    <!DOCTYPE html>
    <html>
      <head><title>\${title}</title></head>
      <body>
        <h1>Welcome to Nomo</h1>
      </body>
    </html>
  \`;
}</code></pre>

<h3>JSX Components</h3>
<pre><code class="language-typescript">import { render } from 'nomo/views';

interface Props {
  name: string;
}

function Greeting({ name }: Props) {
  return <div class="greeting">Hello, {name}!</div>;
}

// In controller
const html = render(<Greeting name="World" />);
return ctx.html(html);</code></pre>

<h3>Component Patterns</h3>
<pre><code class="language-typescript">function Layout({ children, title }: { children: any; title: string }) {
  return (
    <html>
      <head>
        <title>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}</code></pre>

<h3>State Management</h3>
<pre><code class="language-typescript">import { useState } from 'nomo/views';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}</code></pre>`,
    category: "package",
    order: 5,
  },
  jobs: {
    slug: "jobs",
    title: "nomo/jobs",
    content: `<h2>nomo/jobs</h2>
<p>Background job processing with queues and scheduling.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/jobs</code></pre>

<h3>Features</h3>
<ul>
  <li>Queue-based job processing</li>
  <li>Cron scheduling</li>
  <li>Retry strategies</li>
  <li>Job priorities</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { Job, JobDispatcher } from 'nomo/jobs';

class SendEmailJob extends Job {
  static async handle(data: { to: string; subject: string }) {
    // Send email
    return { success: true };
  }
}

class AppDispatcher extends JobDispatcher {
  register() {
    this.registerJob('send_email', SendEmailJob);
  }
}</code></pre>

<h3>Dispatching Jobs</h3>
<pre><code class="language-typescript">// In controller
await dispatcher.dispatch('send_email', {
  to: 'user@example.com',
  subject: 'Welcome!',
});</code></pre>

<h3>Scheduled Jobs</h3>
<pre><code class="language-typescript">class CleanupJob extends Job {
  static schedule = '0 2 * * *'; // Daily at 2 AM
  
  static async handle() {
    // Cleanup logic
  }
}</code></pre>`,
    category: "package",
    order: 6,
  },
  rpc: {
    slug: "rpc",
    title: "nomo/rpc",
    content: `<h2>nomo/rpc</h2>
<p>Type-safe RPC for inter-worker communication.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/rpc</code></pre>

<h3>Features</h3>
<ul>
  <li>Type-safe method calls</li>
  <li>Service bindings support</li>
  <li>Request/response typing</li>
  <li>Error handling</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { RpcServer, RpcClient } from 'nomo/rpc';

class UserRpcServer extends RpcServer {
  async getUser(id: number) {
    return { id, name: 'John' };
  }
  
  async createUser(data: { name: string; email: string }) {
    return { id: 1, ...data };
  }
}

// Register methods
router.registerRpc('users', UserRpcServer);</code></pre>

<h3>Calling RPC</h3>
<pre><code class="language-typescript">const client = new RpcClient('users');

const user = await client.call('getUser', 1);
const newUser = await client.call('createUser', { name: 'Jane', email: 'jane@example.com' });</code></pre>

<h3>Type-safe Client</h3>
<pre><code class="language-typescript">interface UserRpc {
  getUser(id: number): Promise<{ id: number; name: string }>;
  createUser(data: { name: string; email: string }): Promise<{ id: number }>;
}

const client = new RpcClient<UserRpc>('users');

const user = await client.getUser(1);
const newUser = await client.createUser({ name: 'Jane' });</code></pre>`,
    category: "package",
    order: 7,
  },
  durable_objects: {
    slug: "durable_objects",
    title: "nomo/durable_objects",
    content: `<h2>nomo/durable_objects</h2>
<p>Abstractions for Cloudflare Durable Objects.</p>

<h3>Installation</h3>
<pre><code class="language-bash">pnpm add nomo/durable_objects</code></pre>

<h3>Features</h3>
<ul>
  <li>Class-based DO definitions</li>
  <li>Storage abstractions</li>
  <li>Alarm support</li>
  <li>WebSocket handling</li>
</ul>

<h3>Basic Usage</h3>
<pre><code class="language-typescript">import { DurableObject, state, env } from 'nomo/durable_objects';

export class CounterObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const current = (await this.storage.get('count')) || 0;
    await this.storage.put('count', current + 1);
    return new Response(JSON.stringify({ count: current + 1 }));
  }
}</code></pre>

<h3>Storage Operations</h3>
<pre><code class="language-typescript">// Get/Set
await this.storage.get('key');
await this.storage.put('key', 'value');

// Delete
await this.storage.delete('key');

// List
const items = await this.storage.list({ prefix: 'user:' });

// Transactions
await this.storage.transaction(async (tx) => {
  await tx.put('key1', 'value1');
  await tx.put('key2', 'value2');
});</code></pre>

<h3>Alarms</h3>
<pre><code class="language-typescript">export class TimerObject extends DurableObject {
  async alarm() {
    // Handle scheduled alarm
  }
  
  async scheduleAlarm(delaySeconds: number) {
    await this.storage.setAlarm(Date.now() + delaySeconds * 1000);
  }
}</code></pre>

<h3>WebSockets</h3>
<pre><code class="language-typescript">export class ChatRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    this.clients.add(pair.socket);
    
    pair.socket.addEventListener('message', (event) => {
      // Broadcast to all clients
    });
    
    return new Response(null, { status: 101, webSocket: pair.socket });
  }
}</code></pre>`,
    category: "package",
    order: 8,
  },
};
