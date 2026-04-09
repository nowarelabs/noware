# nomo/domains

The Domain Orchestration layer for nomo applications. It enables the implementation of complex, multi-step business transactions as cohesive "Domain" classes, providing a reliable execution loop with built-in hooks for auditing and error handling.

## Installation

```bash
pnpm add nomo/domains
```

---

## 1. Core Concept: `BaseDomain`

A "Domain" in nomo is an aggregate root that orchestrates several underlying services or models to complete a high-level business objective. It focuses on the "what" and "when" of a process.

### The `perform` Loop

The center of every domain is the `perform` method, which provides a safe execution environment.

```typescript
import { BaseDomain } from "nomo/domains";

export class OrderDomain extends BaseDomain {
  async checkout(orderId: string) {
    return await this.perform(async () => {
      // 1. Validate Inventory
      // 2. Process Payment
      // 3. Mark Order as Paid
      return { success: true };
    });
  }
}
```

---

## 2. Lifecycle Hooks

`BaseDomain` provides hooks that automatically run around the `perform` callback, making it the perfect place for cross-cutting concerns like logging or telemetry.

- **`beforePerform()`**: Runs before the logic starts.
- **`afterPerform()`**: Runs after the logic completes successfully.
- **`onPerformError(error)`**: Runs if an exception is caught during execution.

```typescript
protected async beforePerform() {
    console.log(`[Domain] Starting: ${this.constructor.name}`);
}

protected async onPerformError(error: any) {
    // Report to error tracking service
}
```

---

## 3. Best Practices

- **Transactional Focus**: Use domains for logic that involves multiple side effects (e.g., updating a database AND sending an email).
- **Service Injection**: Domains should use services from `nomo/services` to perform the actual work.
- **Context Awareness**: Domains have access to `this.env` and `this.ctx`, allowing them to interact with Cloudflare bindings.

---

## License

MIT
