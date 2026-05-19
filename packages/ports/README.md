# @nowarelabs/ports

A robust foundation for defining system boundaries (Sea-Level Ports) in Hexagonal Architecture.

## Core Concepts

### BasePort

The primary contract for all system goals. Provides:

- **Unified Lifecycle**: Managed `execute()` method that wraps implementation in hooks.
- **Hooks**: Supports `before`, `after`, and `around` hooks for cross-cutting concerns (e.g., logging, validation).
- **Metadata**: Built-in store for execution context.
- **Infrastructure Access**: Safe access to `env`, `ctx`, and `request`.

## Usage Reference

### 1. Creating a Port implementation

Implementations of ports should extend `BasePort` and implement `handleExecute`.

```typescript
import { BasePort } from "@nowarelabs/ports";
import type { UseCaseResult } from "@nowarelabs/shared";

export class RegisterUserPort extends BasePort<Input, Output> {
  protected async handleExecute(input: Input): Promise<UseCaseResult<Output>> {
    // Core implementation logic
    return { success: true, data: { id: "123" }, status: "delivered" };
  }
}
```

### 2. Lifecycle Hooks

Ports support two types of hooks: **Instance Hooks** (Convention) and **Static Hooks** (Configuration).

#### Instance Hooks (Convention)

Best for logic specific to a single port class.

```typescript
export class ValidatedPort extends BasePort {
  protected async beforeExecute() {
    // Validation logic
    if (this.metadata.invalid)
      return { success: false, error: new Error("Invalid"), status: "abandoned" };
  }

  protected async afterExecute(result) {
    console.log("Port execution finished", result);
  }
}
```

#### Static Hooks (Configuration)

Best for global concerns like tracing or performance monitoring.

```typescript
RegisterUserPort.before((port) => {
  port.setMetadata("start_time", Date.now());
});

RegisterUserPort.after((port, result) => {
  const duration = Date.now() - port.getMetadata("start_time");
  console.log(`${port.constructor.name} took ${duration}ms`);
});
```

## Development

- Install dependencies: `vp install`
- Run the unit tests: `vp test`
- Build the library: `vp pack`
