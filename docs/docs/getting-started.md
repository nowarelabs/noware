# Getting Started

Welcome to the Nomo Framework! This guide will help you get up and running with building production-grade applications on Cloudflare Workers.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Cloudflare account (for deployment)

## Quick Start

### 1. Create a New Project

```bash
# Create a new nomo application
pnpm create nomo-app my-app
cd my-app

# Install dependencies
pnpm install
```

### 2. Project Structure

A typical Nomo project follows this structure:

```
my-app/
├── src/
│   ├── controllers/    # Request handlers
│   ├── models/         # Database models
│   ├── services/       # Business logic
│   ├── views/          # UI components
│   ├── lib/            # Utilities
│   ├── router.ts       # Route definitions
│   └── index.ts        # Worker entry point
├── package.json
├── tsconfig.json
├── turbo.json
└── wrangler.toml
```

### 3. Create Your First Route

Create `src/router.ts`:

```typescript
import { Router, RouteDrawer } from "nomo/router";
import { UsersController } from "./controllers/users";

class AppRouter extends RouteDrawer {
  draw() {
    // Root route
    this.get("/", (req, env, ctx) => {
      return ctx.json({ message: "Welcome to Nomo!" });
    });

    // RESTful resources
    this.resources("users", UsersController);

    // Custom routes
    this.get("/health", (req, env, ctx) => {
      return ctx.json({ status: "ok" });
    });
  }
}

export const router = new Router({ drawer: AppRouter });
```

### 4. Create a Controller

Create `src/controllers/users.ts`:

```typescript
import { Controller, action } from "nomo/controllers";

export class UsersController extends Controller {
  // GET /users
  static async index(_req: Request, _env: any, ctx: any) {
    const users = [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
    ];
    return ctx.json({ users });
  }

  // GET /users/:id
  static async show(req: Request, _env: any, ctx: any) {
    const { id } = ctx.params;
    return ctx.json({ user: { id, name: "Alice", email: "alice@example.com" } });
  }

  // POST /users
  static async create(req: Request, _env: any, ctx: any) {
    const body = await ctx.parseJson();
    // Save to database...
    return ctx.json({ user: body }, { status: 201 });
  }

  // PATCH /users/:id
  static async update(req: Request, _env: any, ctx: any) {
    const { id } = ctx.params;
    const body = await ctx.parseJson();
    return ctx.json({ user: { id, ...body } });
  }

  // DELETE /users/:id
  static async destroy(req: Request, _env: any, ctx: any) {
    const { id } = ctx.params;
    return ctx.json({ deleted: true, id });
  }
}
```

### 5. Create the Worker Entry Point

Create `src/index.ts`:

```typescript
import { BaseWorker } from "nomo/entrypoints";
import { router } from "./router";

export default class Worker extends BaseWorker {
  router = router;
}
```

### 6. Configure Wrangler

Update `wrangler.toml`:

```toml
name = "my-nomo-app"
compatibility_date = "2024-01-01"
main = "src/index.ts"

[env.production]
name = "my-nomo-app-prod"
```

### 7. Run Locally

```bash
# Development server
pnpm dev
```

This starts a local Cloudflare Workers dev server at `http://localhost:8787`.

### 8. Deploy

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

## Next Steps

- [Architecture Overview](/architecture) - Learn about Nomo's architecture
- [API Reference](/api) - Complete API documentation
- [Examples](/examples) - Practical code examples

## Package Overview

Nomo consists of several packages:

| Package                | Description                              |
| ---------------------- | ---------------------------------------- |
| `nomo/router`          | Trie-based routing with RESTful patterns |
| `nomo/controllers`     | Rails-like request handlers              |
| `nomo/models`          | Drizzle ORM integration                  |
| `nomo/services`        | Business logic layer                     |
| `nomo/views`           | JSX and templating                       |
| `nomo/jobs`            | Background job processing                |
| `nomo/rpc`             | Type-safe inter-worker RPC               |
| `nomo/durable_objects` | Durable Object abstractions              |
