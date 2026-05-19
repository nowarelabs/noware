# @nowarelabs/usecases

A robust foundation for defining core business logic (Use Cases) following Alistair Cockburn's Goal-Based Model.

## Core Concepts

### BaseUseCase

The primary implementation logic for a system goal. Provides:

- **Unified Lifecycle**: Managed `execute()` method that wraps implementation in `before`, `after`, and `around` hooks.
- **Cockburn's Model**:
  - `perform()`: The Main Success Scenario.
  - `handleGoalAbandonment()`: Extension points (failure handling).
  - Sub-interactions (`subInteraction`, `trySubInteraction`): Managing recursive goals.
- **Metadata**: Built-in store for execution context.

## Usage Reference

### 1. Creating a Use Case

Implementations of use cases should extend `BaseUseCase` and implement the `perform` method.

```typescript
import { BaseUseCase, ValidationError } from "@nowarelabs/usecases";

export class RegisterUserUseCase extends BaseUseCase<Input, Output> {
  protected async perform(input: Input): Promise<Output> {
    if (!input.email) {
      throw new ValidationError("Email is required");
    }
    // Main success scenario logic here
    return { id: "123", email: input.email };
  }
}
```

### 2. Lifecycle Hooks

Use Cases support two types of hooks: **Instance Hooks** (Convention) and **Static Hooks** (Configuration).

#### Instance Hooks (Convention)

Best for logic specific to a single use case class.

```typescript
export class ValidatedUseCase extends BaseUseCase {
  protected async beforeExecute() {
    // Logic to run before perform
    if (this.metadata.skip)
      return { success: false, error: new Error("Skipped"), status: "abandoned" };
  }

  protected async afterExecute(result) {
    console.log("Use Case finished", result);
  }
}
```

#### Static Hooks (Configuration)

Best for global concerns like tracing or performance monitoring.

```typescript
RegisterUserUseCase.before((useCase) => {
  useCase.setMetadata("start_time", Date.now());
});

RegisterUserUseCase.after((useCase, result) => {
  const duration = Date.now() - (useCase.getMetadata("start_time") as number);
  console.log(`${useCase.constructor.name} took ${duration}ms`);
});
```

### 3. Sub-Interactions

To manage recursive goals, you can trigger other use cases from within a use case:

- `this.subInteraction(otherUseCase, input)`: Unwraps data on success, throws a `SubGoalAbandonedError` if the sub-goal fails.
- `this.trySubInteraction(otherUseCase, input)`: Returns the raw `UseCaseResult`, giving you full control over failure handling.

## Development

- Install dependencies: `vp install`
- Run the unit tests: `vp test`
- Build the library: `vp pack`
