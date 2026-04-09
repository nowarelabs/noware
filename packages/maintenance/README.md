# nomo/maintenance

A framework for defining and running maintenance tasks in nomo applications. Inspired by Rake tasks, it provides a structured way to perform one-off database updates, data migrations, or system cleanup.

## Installation

```bash
pnpm add nomo/maintenance
```

---

## 1. Core Concept: `BaseTask`

Maintenance tasks are encapsulated in classes. This makes them reusable, testable, and allows for shared setup/teardown logic.

```typescript
import { BaseTask } from "nomo/maintenance";

export class CleanupOrphanedRecords extends BaseTask {
  async perform() {
    // Logic to identify and delete orphaned records...
    this.log("Cleanup completed.");
  }
}
```

---

## 2. Execution

Tasks are typically executed via the CLI or a dedicated maintenance endpoint.

```bash
# Conceptual execution
pnpm maintenance run CleanupOrphanedRecords
```

---

## 3. Why Use Maintenance Tasks?

- **Auditable**: Keep a history of scripts run against production.
- **Isolated**: Keep maintenance logic separate from your primary application flow.
- **Safe**: Use the same `BaseTask` interface to ensure standardized logging and error handling for all administrative actions.

---

## License

MIT
