# API Reference

Complete API documentation for all Nomo packages.

## nomo/router

### Router Class

```typescript
import { Router } from 'nomo/router';

const router = new Router(options?)
```

**Options:**

- `strict` (boolean) - Enable strict path matching (default: false)
- `drawer` (class) - RouteDrawer class for defining routes

**Methods:**

#### Route Methods

```typescript
router.get(path, ...handlers);
router.post(path, ...handlers);
router.put(path, ...handlers);
router.patch(path, ...handlers);
router.delete(path, ...handlers);
router.all(path, ...handlers);
```

#### Resource Methods

```typescript
router.resources(path, controller);
router.resourceActions(path, controller);
```

#### Middleware

```typescript
router.use(middleware);
router.use(path, middleware);
```

#### OpenAPI

```typescript
router.openapi(config, handler);
router.getOpenApiDocument(info);
```

#### Error Handling

```typescript
router.onError(handler);
```

#### Handle Request

```typescript
router.handle(request, env, ctx): Promise<Response>
```

### RouteDrawer Class

```typescript
import { RouteDrawer } from "nomo/router";

class AppRouter extends RouteDrawer {
  draw() {
    this.get("/", handler);
  }
}
```

**Methods:**

- `get`, `post`, `put`, `patch`, `delete`, `all` - Define routes
- `resources(path, controller)` - RESTful resources
- `resourceActions(path, controller)` - Full resource actions
- `use(middleware)` - Add middleware
- `provide(name, service)` - Register service
- `inject<T>(name)` - Get service
- `scope(path, callback)` - Create scope
- `namespace(name, callback)` - Create namespace
- `version(v, callback)` - Create version scope
- `root(handler)` - Root route handler

### Context Methods

The router context (`ctx`) provides:

```typescript
// Responses
ctx.json(data, init?) => Response
ctx.text(data, init?) => Response
ctx.html(data, init?) => Response
ctx.redirect(url, status?) => Response

// Request data
ctx.params        // Route parameters
ctx.query         // Parsed query string
ctx.headers       // Request headers
ctx.parseJson()   // Parse JSON body

// Utilities
ctx.cache(seconds)     // Set cache headers
ctx.fetch(url, init)   // Make HTTP request

// Info
ctx.requestId
ctx.logger
ctx.router
ctx.source
```

### Validation

```typescript
Router.zValidator(target, schema);
```

Targets: `'json' | 'query' | 'header' | 'param'`

### Error Classes

```typescript
throw new NotFoundError(message, details);
throw new BadRequestError(message, details);
throw new ConflictError(message, details);
throw new ValidationError(message, details);
throw new UnprocessableEntityError(message, details);
throw new ConstraintError(message, constraintType, details);
```

### Utility Functions

```typescript
parseQuery(queryString) => Record<string, any>
splitPath(path) => string[]
isValidPath(path) => boolean
```

---

## nomo/controllers

### Controller Class

```typescript
import { Controller, action } from "nomo/controllers";

export class UsersController extends Controller {
  static async index(req, env, ctx) {
    return ctx.json({});
  }
  static async show(req, env, ctx) {
    return ctx.json({});
  }
}
```

**Static Properties:**

- `beforeAction` - Array of filter names to run before actions

**Methods:**

- `action(name)` - Create action handler for method
- `permit(params, keys)` - Filter allowed params

### Action Helper

```typescript
import { action } from "nomo/controllers";

this.get("/users", UsersController.action("index"));
this.post("/users", UsersController.action("create"));
```

---

## nomo/models

### Model Class

```typescript
import { Model } from 'nomo/models';

export class User extends Model {
  static table = 'users';
  static schema = pgTable('users', { ... });
}
```

**Static Methods:**

```typescript
// Querying
Model.query;
Model.all();
Model.findById(id);
Model.where(conditions);
Model.whereId(id);

// CRUD
Model.create(data);
Model.update(id, data);
Model.delete(id);
Model.upsert(where, data);

// Aggregation
Model.count();
Model.exists();
```

---

## nomo/services

### Service Class

```typescript
import { Service } from "nomo/services";

class EmailService extends Service {
  async send(to, subject, body) {
    /* ... */
  }
}
```

### ServiceProvider Class

```typescript
import { ServiceProvider } from "nomo/services";

class AppProvider extends ServiceProvider {
  register() {
    this.provide("emailService", EmailService);
  }
}
```

---

## nomo/views

### Functions

```typescript
import { html, render, JSX } from 'nomo/views';

// Template literal
html`<div>Hello ${name}</div>`

// JSX rendering
render(<Component />)

// JSX type
type JSX.Element
```

---

## nomo/jobs

### Job Class

```typescript
import { Job } from "nomo/jobs";

class SendEmailJob extends Job {
  static async handle(data) {
    /* ... */
  }
}
```

**Static Properties:**

- `schedule` - Cron expression for scheduled jobs

### JobDispatcher Class

```typescript
class AppDispatcher extends JobDispatcher {
  register() {
    this.registerJob("send_email", SendEmailJob);
  }
}
```

**Methods:**

- `dispatch(jobName, data, options?)`
- `runJob(name, data, env, ctx)`
- `handleQueue(batch, env, ctx)`

---

## nomo/rpc

### RpcServer Class

```typescript
import { RpcServer } from "nomo/rpc";

class UserRpcServer extends RpcServer {
  async getUser(id) {
    return {};
  }
}
```

**Methods:**

- `register(name, server)` - Register RPC methods

### RpcClient Class

```typescript
import { RpcClient } from "nomo/rpc";

const client = new RpcClient("users");
const result = await client.call("method", args);

// Type-safe
const client = new RpcClient<UserRpc>("users");
```

---

## nomo/durable_objects

### DurableObject Class

```typescript
import { DurableObject } from "nomo/durable_objects";

export class MyObject extends DurableObject {
  async fetch(request) {
    return new Response("OK");
  }
}
```

**Properties:**

- `storage` - Durable Object storage
- `state` - Object state
- `env` - Environment

**Storage Methods:**

```typescript
storage.get(key);
storage.put(key, value);
storage.delete(key);
storage.list(options);
storage.transaction(fn);
storage.setAlarm(time);
```

---

## nomo/entrypoints

### BaseWorker Class

```typescript
import { BaseWorker } from "nomo/entrypoints";

export default class Worker extends BaseWorker {
  router = myRouter;
  dispatcher = myDispatcher;
}
```

**Properties:**

- `router` - Router instance
- `dispatcher` - Job dispatcher

**Methods:**

- `fetch(request, env, ctx)` - HTTP handler
- `handle(request, env, ctx)` - RPC handler
- `runJob(name, params, env, ctx)` - Job runner

### BaseDurableObject Class

```typescript
import { BaseDurableObject } from "nomo/entrypoints";

export class MyObject extends BaseDurableObject {}
```

### BaseWorkflow Class

```typescript
import { BaseWorkflow } from "nomo/entrypoints";

export class MyWorkflow extends BaseWorkflow<Env, Input> {
  async run(event, step) {
    /* ... */
  }
}
```
