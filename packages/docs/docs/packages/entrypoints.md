# Entrypoints

Entrypoints provide the entry point for Cloudflare Workers, Durable Objects, and Workflows.

## BaseWorker

The main worker entry point that handles HTTP requests and dispatches to the router.

### Basic Setup

```typescript
import { Router } from 'nomo/router';
import { BaseWorker } from 'nomo/entrypoints';
import { AppRoutes } from './routes';

const router = new Router<Env, ExecutionContext>({
  drawer: AppRoutes
});

export default class AppWorker extends BaseWorker<Env> {
  router = router;
}
```

### With Job Dispatcher

```typescript
import { Router } from 'nomo/router';
import { JobDispatcher } from 'nomo/jobs';
import { BaseWorker } from 'nomo/entrypoints';
import { AppRoutes } from './routes';
import { JobRegistry } from './jobs';

const router = new Router<Env, ExecutionContext>({
  drawer: AppRoutes
});

const dispatcher = new JobDispatcher(JobRegistry);

export default class AppWorker extends BaseWorker<Env> {
  router = router;
  dispatcher = dispatcher;
}
```

## BaseDurableObject

Durable Object entry point for stateful coordination.

```typescript
import { BaseDurableObject } from 'nomo/entrypoints';
import { drizzle } from 'drizzle-orm/durable-object-sqlite';
import * as schema from '../db/schema';

export class CounterDO extends BaseDurableObject {
  async onMessage(message: string) {
    // Handle message
  }

  async onConnect(request: Request): Promise<Response> {
    return new Response('WebSocket connected');
  }
}
```

## BaseWorkflow

Cloudflare Workflow entry point.

```typescript
import { BaseWorkflow } from 'nomo/entrypoints';

export class UserOnboardingWorkflow extends BaseWorkflow<Env, { userId: string; email: string }> {
  async run(event, step) {
    await step('send_welcome_email', async () => {
      // Send email
    });
    
    await step('create_user_record', async () => {
      // Create user
    });
    
    await this.sleep(10); // Wait 10 seconds
    
    await step('send_follow_up', async () => {
      // Send follow up
    });
  }
}
```

## Full Worker Setup

### src/index.ts

```typescript
import { Router } from 'nomo/router';
import { JobDispatcher } from 'nomo/jobs';
import { BaseWorker } from 'nomo/entrypoints';

import { AppRoutes } from './routes';
import { JobRegistry } from './jobs';
import { AccountsDO } from './durable_objects/accounts';
import { UserOnboardingWorkflow } from './workflows/user_onboarding';

// Initialize router with RouteDrawer
const router = new Router<Env, ExecutionContext>({
  drawer: AppRoutes,
  onNotFound: (req, env, ctx) => {
    return new Response('Not Found', { status: 404 });
  },
  onError: (err, req, env, ctx) => {
    console.error('Worker error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});

// Initialize job dispatcher
const dispatcher = new JobDispatcher(JobRegistry);

// Export worker
export default class AppWorker extends BaseWorker<Env> {
  router = router;
  dispatcher = dispatcher;
}

// Export Durable Objects and Workflows
export { AccountsDO, UserOnboardingWorkflow };
```

### wrangler.jsonc

```jsonc
{
  "name": "my-app",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat", "nodejs_als"],
  
  // D1 Database
  "d1_databases": [{
    "binding": "DB",
    "database_name": "my-app-db",
    "database_id": "your-database-id"
  }],
  
  // Durable Objects
  "durable_objects": {
    "bindings": [
      { "class_name": "AccountsDO", "name": "ACCOUNTS_DO" }
    ]
  },
  
  // Workflows
  "workflows": [{
    "name": "USER_ONBOARDING_WORKFLOW",
    "binding": "USER_ONBOARDING_WORKFLOW",
    "class_name": "UserOnboardingWorkflow"
  }],
  
  // KV Namespaces
  "kv_namespaces": [
    { "binding": "CACHE", "id": "your-kv-id" }
  ],
  
  // Queues
  "queues": {
    "producers": [
      { "queue": "email-queue", "binding": "EMAIL_QUEUE" }
    ],
    "consumers": [
      { "queue": "email-queue", "max_batch_size": 100 }
    ]
  }
}
```

## Environment Types

```typescript
// src/env.ts
export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ACCOUNTS_DO: DurableObjectNamespace;
  USER_ONBOARDING_WORKFLOW: Workflow;
  EMAIL_QUEUE: Queue;
  SENDGRID_API_KEY: string;
  AUTH_SECRET: string;
}
```

## Methods

### BaseWorker Methods

| Method | Description |
|--------|-------------|
| `fetch(request, env, ctx)` | Handle HTTP request |
| `handle(request, env, ctx)` | Alias for fetch (service binding RPC) |
| `runJob(jobName, params, env, ctx)` | Run background job |
| `queue(batch, env, ctx)` | Handle queue messages |
| `rpc(method, args, env, ctx)` | Internal RPC call |

### BaseDurableObject Methods

| Method | Description |
|--------|-------------|
| `onMessage(message)` | Handle incoming message |
| `onConnect(request)` | Handle WebSocket connect |
| `alarm()` | Handle scheduled alarm |

### BaseWorkflow Methods

| Method | Description |
|--------|-------------|
| `run(event, step)` | Execute workflow |
| `sleep(seconds)` | Wait for duration |
| `step(name, fn)` | Define workflow step |

## Combining with Other Packages

### With Router

```typescript
const router = new Router<Env, ExecutionContext>({
  drawer: AppRoutes,
  drawerOptions: {
    // Custom options
  }
});
```

### With Jobs

```typescript
// Define job
export class SendEmailJob extends QueueJob<{ to: string; subject: string }> {
  static queue = 'emails';
  static retryLimit = 3;

  async perform() {
    await sendEmail(this.params.to, this.params.subject);
  }
}

// Register job
export const JobRegistry = {
  SendEmailJob
};

// Trigger job from controller
async triggerEmail() {
  await this.ctx.router.runJob('SendEmailJob', {
    to: 'user@example.com',
    subject: 'Welcome!'
  });
}
```

### With Durable Objects

```typescript
// In controller - access DO
async getOrCreateSession(userId: string) {
  const id = this.env.SESSIONS.idFromName(userId);
  const stub = this.env.SESSIONS.get(id);
  return stub.fetch('https://internal/session').then(r => r.json());
}
```