import type { RouterContext } from "nomo/router";
import type { Env } from "../types";
import { DOCS_PAGES, PACKAGE_DOCS } from "../data/docs";

export class DocsController {
  static index(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    return ctx.html(DOCS_INDEX_PAGE);
  }

  static page(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    const page = ctx.params.page || "index";
    const doc = DOCS_PAGES.find((d) => d.slug === page);

    if (!doc) {
      return ctx.html(NOT_FOUND_PAGE, { status: 404 });
    }

    return ctx.html(DOCS_PAGE_TEMPLATE(doc.title, doc.content));
  }

  static gettingStarted(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    return ctx.html(DOCS_PAGE_TEMPLATE("Getting Started", GETTING_STARTED_CONTENT));
  }

  static architecture(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    return ctx.html(DOCS_PAGE_TEMPLATE("Architecture", ARCHITECTURE_CONTENT));
  }

  static api(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    return ctx.html(DOCS_PAGE_TEMPLATE("API Reference", API_REFERENCE_CONTENT));
  }

  static examples(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    return ctx.html(DOCS_PAGE_TEMPLATE("Examples", EXAMPLES_CONTENT));
  }

  static packageDocs(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    const pkg = ctx.params.package;
    const doc = PACKAGE_DOCS[pkg];

    if (!doc) {
      return ctx.html(NOT_FOUND_PAGE, { status: 404 });
    }

    return ctx.html(DOCS_PAGE_TEMPLATE(doc.title, doc.content));
  }
}

const DOCS_INDEX_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation - Nomo Framework</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #fafafa; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #1a1a2e; margin-bottom: 1rem; }
    .nav { margin-bottom: 2rem; }
    .nav a { margin-right: 1rem; color: #4a90d9; }
    .section { background: white; padding: 2rem; border-radius: 8px; margin-bottom: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .section h2 { color: #1a1a2e; margin-bottom: 1rem; }
    .section p { color: #666; margin-bottom: 1rem; }
    .link-list a { display: block; padding: 0.5rem 0; color: #333; }
    .link-list a:hover { color: #4a90d9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Nomo Framework Documentation</h1>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/getting-started">Getting Started</a>
      <a href="/architecture">Architecture</a>
      <a href="/api">API Reference</a>
      <a href="/examples">Examples</a>
    </nav>
    
    <div class="section">
      <h2>Guides</h2>
      <div class="link-list">
        <a href="/getting-started">Getting Started</a>
        <a href="/architecture">Architecture Overview</a>
        <a href="/examples">Examples & Tutorials</a>
      </div>
    </div>
    
    <div class="section">
      <h2>API Reference</h2>
      <div class="link-list">
        <a href="/api">Full API Reference</a>
      </div>
    </div>
    
    <div class="section">
      <h2>Packages</h2>
      <div class="link-list">
        <a href="/packages/router">nomo/router</a>
        <a href="/packages/controllers">nomo/controllers</a>
        <a href="/packages/models">nomo/models</a>
        <a href="/packages/services">nomo/services</a>
        <a href="/packages/views">nomo/views</a>
        <a href="/packages/jobs">nomo/jobs</a>
        <a href="/packages/rpc">nomo/rpc</a>
      </div>
    </div>
  </div>
</body>
</html>`;

function DOCS_PAGE_TEMPLATE(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Nomo Framework</title>
  <link rel="stylesheet" href="/assets/prism.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #333; background: #fafafa; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    header { background: #1a1a2e; color: white; padding: 2rem 0; margin-bottom: 2rem; }
    header .container { padding: 0 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    nav { margin-bottom: 2rem; }
    nav a { margin-right: 1rem; color: #4a90d9; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    .content { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .content h2 { color: #1a1a2e; margin: 2rem 0 1rem; }
    .content h3 { color: #333; margin: 1.5rem 0 0.5rem; }
    .content p { margin-bottom: 1rem; color: #555; }
    .content code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9rem; }
    .content pre { background: #1a1a2e; color: #f8f8f2; padding: 1.5rem; border-radius: 6px; overflow-x: auto; margin: 1rem 0; }
    .content pre code { background: none; padding: 0; }
    .content ul, .content ol { margin: 1rem 0; padding-left: 2rem; }
    .content li { margin-bottom: 0.5rem; }
    .content table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    .content th, .content td { padding: 0.75rem; border: 1px solid #ddd; text-align: left; }
    .content th { background: #f5f5f5; font-weight: 600; }
    .content blockquote { border-left: 4px solid #4a90d9; padding-left: 1rem; margin: 1rem 0; color: #666; }
    .sidebar { position: fixed; right: 2rem; top: 50%; transform: translateY(-50%); width: 200px; }
    .sidebar a { display: block; padding: 0.5rem; color: #666; }
    .sidebar a:hover { color: #4a90d9; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>${title}</h1>
      <nav>
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="/getting-started">Getting Started</a>
        <a href="/architecture">Architecture</a>
        <a href="/api">API</a>
      </nav>
    </div>
  </header>
  <div class="container">
    <div class="content">
      ${content}
    </div>
  </div>
</body>
</html>`;
}

const NOT_FOUND_PAGE = `<!DOCTYPE html>
<html><head><title>404 - Not Found</title></head>
<body><h1>404 - Page Not Found</h1><p>The requested page could not be found.</p></body></html>`;

const GETTING_STARTED_CONTENT = `<h2>Quick Start</h2>
<p>Get started with Nomo in minutes. This guide will walk you through creating your first Nomo application.</p>

<h3>Installation</h3>
<p>Install the nomo framework using pnpm:</p>
<pre><code class="language-bash">pnpm create nomo-app my-app
cd my-app
pnpm install</code></pre>

<h3>Project Structure</h3>
<p>A typical Nomo project follows this structure:</p>
<pre><code class="language-text">my-app/
├── src/
│   ├── controllers/    # Request handlers
│   ├── models/        # Database models
│   ├── services/      # Business logic
│   ├── views/         # UI components
│   ├── router.ts      # Route definitions
│   └── index.ts       # Worker entry point
├── package.json
└── wrangler.toml</code></pre>

<h3>Creating Your First Route</h3>
<p>Define routes in your router file:</p>
<pre><code class="language-typescript">import { Router, RouteDrawer } from 'nomo/router';
import { UsersController } from './controllers/users';

class AppRouter extends RouteDrawer {
  draw() {
    this.resources('users', UsersController);
  }
}

export const router = new Router({ drawer: AppRouter });</code></pre>

<h3>Creating a Controller</h3>
<p>Controllers handle incoming requests:</p>
<pre><code class="language-typescript">import { Controller, action } from 'nomo/controllers';

export class UsersController extends Controller {
  static async index(_req, env, ctx) {
    return ctx.json({ users: [] });
  }
  
  static async show(req, env, ctx) {
    const userId = ctx.params.id;
    return ctx.json({ id: userId });
  }
}</code></pre>

<h3>Running Locally</h3>
<p>Start the development server:</p>
<pre><code class="language-bash">pnpm dev</code></pre>

<p>This will start a local Cloudflare Workers dev server at http://localhost:8787.</p>

<h3>Deploying</h3>
<p>Deploy to Cloudflare Workers:</p>
<pre><code class="language-bash">pnpm deploy</code></pre>`;

const ARCHITECTURE_CONTENT = `<h2>Architecture Overview</h2>
<p>Nomo follows a MVC-like pattern optimized for serverless environments on Cloudflare Workers.</p>

<h3>Core Components</h3>

<h4>Router</h4>
<p>The router handles HTTP request routing using a trie-based data structure for efficient path matching.</p>
<ul>
  <li>Path parameter parsing</li>
  <li>Query string handling</li>
  <li>Middleware support</li>
  <li>OpenAPI integration</li>
</ul>

<h4>Controllers</h4>
<p>Controllers are request handlers that process incoming requests and return responses. They follow Rails conventions with RESTful actions.</p>

<h4>Models</h4>
<p>Models provide data access and business logic. Nomo uses Drizzle ORM for type-safe database operations.</p>

<h4>Services</h4>
<p>Services contain business logic and can be injected into controllers and models via dependency injection.</p>

<h3>Request Flow</h3>
<pre><code>Request → Router → Middleware → Controller → Response</code></pre>

<h3>Dependency Injection</h3>
<p>Nomo uses a provider system for dependency injection:</p>
<pre><code class="language-typescript">class AppRouter extends RouteDrawer {
  draw() {
    this.provide('userService', new UserService());
  }
}

// In controller
class UsersController extends Controller {
  static async index(req, env, ctx) {
    const users = ctx.router.inject('userService').findAll();
  }
}</code></pre>

<h3>Durable Objects</h3>
<p>Nomo provides abstractions for Durable Objects for stateful workloads.</p>

<h3>Workflows</h3>
<p>Long-running operations can be handled using Cloudflare Workflows.</p>`;

const API_REFERENCE_CONTENT = `<h2>API Reference</h2>
<p>Complete API documentation for all Nomo packages.</p>

<h3>nomo/router</h3>
<p>Core routing package.</p>

<h4>Classes</h4>
<ul>
  <li><strong>Router</strong> - Main router implementation</li>
  <li><strong>RouteDrawer</strong> - DSL for defining routes</li>
  <li><strong>RouteDrawer</strong> - Base class for route builders</li>
</ul>

<h4>Functions</h4>
<ul>
  <li><strong>parseQuery(queryString)</strong> - Parse URL query string</li>
  <li><strong>splitPath(path)</strong> - Split path into segments</li>
  <li><strong>isValidPath(path)</strong> - Validate path format</li>
</ul>

<h3>nomo/controllers</h3>
<p>Controller abstractions.</p>

<h4>Classes</h4>
<ul>
  <li><strong>Controller</strong> - Base controller class</li>
</ul>

<h3>nomo/models</h3>
<p>Model and database abstractions.</p>

<h3>nomo/services</h3>
<p>Service layer implementation.</p>

<h3>nomo/views</h3>
<p>View and UI components.</p>`;

const EXAMPLES_CONTENT = `<h2>Examples</h2>
<p>Practical examples demonstrating Nomo features.</p>

<h3>Basic REST API</h3>
<p>Create a simple REST API:</p>
<pre><code class="language-typescript">import { Router, RouteDrawer } from 'nomo/router';
import { ResourceController } from 'nomo/controllers';

class ApiRouter extends RouteDrawer {
  draw() {
    this.resources('posts', ResourceController);
    this.resources('comments', ResourceController);
  }
}</code></pre>

<h3>Custom Actions</h3>
<p>Add custom controller actions:</p>
<pre><code class="language-typescript">class PostsController extends Controller {
  static async publish(req, env, ctx) {
    const postId = ctx.params.id;
    // Publish logic
    return ctx.json({ success: true });
  }
}

// In router
this.post('/posts/:id/publish', PostsController.action('publish'));</code></pre>

<h3>Database Queries</h3>
<p>Using models with Drizzle:</p>
<pre><code class="language-typescript">import { Model } from 'nomo/models';
import { eq } from 'drizzle-orm';

class UserModel extends Model {
  static table = 'users';
  
  static async findByEmail(email: string) {
    return this.query.where(eq(this.table.email, email));
  }
}</code></pre>

<h3>Service Injection</h3>
<p>Using services in controllers:</p>
<pre><code class="language-typescript">class AppRouter extends RouteDrawer {
  draw() {
    this.provide('emailService', new EmailService());
    this.resources('users', UsersController);
  }
}</code></pre>`;
