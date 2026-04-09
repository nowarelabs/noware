# nomo/entrypoints

The adapter layer for Cloudflare's serverless infrastructure. `nomo/entrypoints` provides base classes that wrap standard Cloudflare primitives (Workers, Durable Objects, and Workflows), bridging them into the nomo framework.

## Installation

```bash
pnpm add nomo/entrypoints
```

---

## 1. Supported Entrypoints

### 1.1. `BaseWorker`

Simple wrapper for standard Cloudflare Workers.

```typescript
import { BaseWorker } from "nomo/entrypoints";

export default class MainWorker extends BaseWorker {
  async fetch(request, env, ctx) {
    // Your main entry point logic
  }

  /**
   * Helper to dispatch RPC calls to the router/controllers.
   */
  async someMethod() {
    return await this.rpc("service#method", arg1, arg2);
  }
}
```

### 1.2. `BaseDurableObject`

Extends the standard Cloudflare `DurableObject` class, providing a clean foundation for stateful actors.

```typescript
import { BaseDurableObject } from "nomo/entrypoints";

export class AccountSession extends BaseDurableObject {
  // state and env are automatically managed
}
```

### 1.3. `BaseWorkflow`

Adapter for Cloudflare Workflows, implementing the `WorkflowEntrypoint`.

```typescript
import { BaseWorkflow } from "nomo/entrypoints";

export class SignupWorkflow extends BaseWorkflow {
  async run(event, step) {
    // State-aware workflow execution
  }
}
```

---

## 2. Why Use Entrypoints?

While you can use standard Cloudflare classes, using `nomo/entrypoints` ensures:

- **Consistency**: All entrypoints share a similar constructor and initialization pattern.
- **Framework Integration**: Future enhancements to the nomo framework will leverage these base classes for automatic instrumentation, logging, and error handling.
- **Type Safety**: Provides reinforced type definitions for Cloudflare bindings and context.

---

## License

MIT
