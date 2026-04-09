import type { RouterContext } from "nomo/router";
import type { Env } from "../types";

export class HomeController {
  static index(_req: Request, _env: Env, ctx: RouterContext<Env>): Response {
    return ctx.html(HOME_PAGE);
  }
}

const HOME_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nomo Framework - Cloudflare Workers</title>
  <link rel="stylesheet" href="/assets/prism.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fafafa;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 3rem 0;
      margin-bottom: 2rem;
    }
    header .container { padding: 0 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .tagline { color: #8b9dc3; font-size: 1.2rem; }
    nav {
      background: white;
      border-radius: 8px;
      padding: 1rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    nav a {
      color: #333;
      text-decoration: none;
      margin-right: 1.5rem;
      font-weight: 500;
    }
    nav a:hover { color: #4a90d9; }
    .hero {
      background: white;
      border-radius: 8px;
      padding: 3rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .hero h2 { color: #1a1a2e; margin-bottom: 1rem; }
    .hero p { color: #666; margin-bottom: 1.5rem; }
    .code-block {
      background: #1a1a2e;
      color: #f8f8f2;
      padding: 1.5rem;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.9rem;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .feature {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .feature h3 { color: #1a1a2e; margin-bottom: 0.5rem; }
    .feature p { color: #666; font-size: 0.9rem; }
    .packages {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      margin-top: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .packages h2 { margin-bottom: 1rem; color: #1a1a2e; }
    .pkg-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }
    .pkg-item {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 6px;
      text-decoration: none;
      color: #333;
      transition: all 0.2s;
    }
    .pkg-item:hover {
      background: #4a90d9;
      color: white;
    }
    .pkg-item code { font-size: 0.8rem; color: #666; }
    .pkg-item:hover code { color: rgba(255,255,255,0.8); }
    footer {
      text-align: center;
      padding: 2rem;
      color: #666;
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>Nomo Framework</h1>
      <p class="tagline">Build powerful Cloudflare Workers applications with Rails-like patterns</p>
    </div>
  </header>
  
  <div class="container">
    <nav>
      <a href="/">Home</a>
      <a href="/getting-started">Getting Started</a>
      <a href="/architecture">Architecture</a>
      <a href="/docs">Documentation</a>
      <a href="/api">API Reference</a>
      <a href="/examples">Examples</a>
    </nav>

    <div class="hero">
      <h2>Build Modern Serverless Applications</h2>
      <p>Nomo is a comprehensive framework for building production-grade applications on Cloudflare Workers. Inspired by Ruby on Rails, it provides routing, controllers, models, services, and more.</p>
      <pre class="code-block"><code>import { Router, RouteDrawer } from 'nomo/router';
import { ApplicationController } from './controllers/application';

class AppRouter extends RouteDrawer {
  draw() {
    this.resources('users', ApplicationController);
  }
}

const router = new Router({ drawer: AppRouter });
export default { fetch: router.handle.bind(router) };</code></pre>
    </div>

    <div class="features">
      <div class="feature">
        <h3>Routing</h3>
        <p>Powerful trie-based router with nested resources, namespaces, and OpenAPI integration.</p>
      </div>
      <div class="feature">
        <h3>Controllers</h3>
        <p>Rails-like controllers with actions, filters, and automatic JSON response handling.</p>
      </div>
      <div class="feature">
        <h3>Models</h3>
        <p>Drizzle ORM integration with type-safe queries and migrations support.</p>
      </div>
      <div class="feature">
        <h3>Services</h3>
        <p>Business logic layer with dependency injection and service providers.</p>
      </div>
      <div class="feature">
        <h3>Jobs</h3>
        <p>Background job processing with queues and cron scheduling.</p>
      </div>
      <div class="feature">
        <h3>RPC</h3>
        <p>Type-safe RPC between workers with automatic method generation.</p>
      </div>
    </div>

    <div class="packages">
      <h2>Available Packages</h2>
      <div class="pkg-grid">
        <a href="/packages/router" class="pkg-item"><code>nomo/router</code></a>
        <a href="/packages/controllers" class="pkg-item"><code>nomo/controllers</code></a>
        <a href="/packages/models" class="pkg-item"><code>nomo/models</code></a>
        <a href="/packages/services" class="pkg-item"><code>nomo/services</code></a>
        <a href="/packages/views" class="pkg-item"><code>nomo/views</code></a>
        <a href="/packages/jobs" class="pkg-item"><code>nomo/jobs</code></a>
        <a href="/packages/rpc" class="pkg-item"><code>nomo/rpc</code></a>
        <a href="/packages/durable_objects" class="pkg-item"><code>nomo/durable_objects</code></a>
      </div>
    </div>
  </div>

  <footer>
    <p>Nomo Framework &copy; 2024 | Built for Cloudflare Workers</p>
  </footer>
</body>
</html>`;
