# @nowarelabs/adapters

A lightweight Hexagonal Architecture (Ports & Adapters) framework designed for convention-over-configuration.

## Core Concepts

### BaseAdapter

The foundation for all adapters. Provides:

- **Environment & Context**: Access to `env` and `ctx`.
- **Metadata**: A standard way to store and retrieve execution metadata.
- **Hooks**: Static and Instance-level lifecycles (`before`, `after`, `around`).
- **Response Helpers**: Standard helpers like `json()`, `notFound()`, `unauthorized()`, etc.

### DrivingAdapter (Inbound)

Translates external requests (HTTP, CLI) into domain operations.

- **Convention**: Defaults `mapInput` to the request body and `mapOutput` to a JSON response.
- **Error Mapping**: Automatically maps domain errors to HTTP status codes based on convention.

### DrivenAdapter (Outbound)

Translates domain requests into infrastructure calls (Database, External APIs).

- **Mandatory Translation**: Requires implementation of `handleExternalError()` to ensure infrastructure errors never leak into the domain.
- **Safe Execution**: Use `this.call(() => ...)` to wrap external calls in the standard adapter lifecycle (hooks).

---

## Usage Reference

### 1. Driving Adapters (HTTP/Inbound)

Driving adapters face the outside world. They implement `mapInput` and `mapOutput`.

```typescript
import { DrivingAdapter } from "@nowarelabs/adapters";
import { RegisterUserPort } from "@nowarelabs/ports";

export class RegisterUserAdapter extends DrivingAdapter<Input, Output, RegisterUserPort> {
  /**
   * TRANSLATE: External -> Domain
   * Optional: Defaults to returning req.body
   */
  protected async mapInput() {
    const body = await this.body();
    return {
      email: body.user_email,
      name: body.full_name,
    };
  }

  /**
   * TRANSLATE: Domain -> External
   * Optional: Defaults to this.json(output)
   */
  protected mapOutput(output) {
    return this.json(
      {
        id: output.id,
        welcome_message: `Hello ${output.name}!`,
      },
      201,
    );
  }
}
```

### 2. Driven Adapters (Infrastructure/Outbound)

Driven adapters implement Port interfaces defined by the domain.

```typescript
import { DrivenAdapter } from "@nowarelabs/adapters";
import { UserPort } from "@nowarelabs/ports";

export class UserRepository extends DrivenAdapter implements UserPort {
  async findById(id: string) {
    // Use this.call to wrap external calls in the hook lifecycle
    return this.call(async () => {
      const user = await this.db.users.findFirst({ where: { id } });
      if (!user) throw new NotFoundError("User not found");
      return user;
    });
  }

  /**
   * MANDATORY: Translate infrastructure errors to domain errors
   */
  protected handleExternalError(error: unknown) {
    if (error.code === "P2002") return new ConflictError("Email already exists");
    return new DatabaseError(String(error));
  }
}
```

### 3. Hooks Lifecycle

Adapters support two types of hooks: **Instance Hooks** (Convention) and **Static Hooks** (Configuration).

#### Instance Hooks (Convention)

Best for logic specific to a single adapter class.

```typescript
export class SecureAdapter extends DrivingAdapter {
  protected async beforeExecute() {
    const auth = this.headers["authorization"];
    if (!auth) return this.unauthorized("Missing token");

    this.setMetadata("user_id", parseToken(auth));
  }

  protected async afterExecute(result) {
    console.log("Execution finished", result);
  }
}
```

#### Static Hooks (Configuration)

Best for cross-cutting concerns (logging, global auth, tracing) applied from the outside.

```typescript
// Registration
MyAdapter.before(async (adapter) => {
  adapter.setMetadata("start_time", Date.now());
});

MyAdapter.after(async (adapter, result) => {
  const duration = Date.now() - adapter.getMetadata("start_time");
  console.log(`Executed in ${duration}ms`);
});

// Around hooks for wrapping (e.g. transactions)
MyAdapter.around(async (adapter, next) => {
  await db.transaction(async () => {
    return await next();
  });
});

// Skipping hooks
MyAdapter.skipBefore(LoggingHook);
```

### 4. Response Helpers (Built-in)

Available in both Driving and Driven adapters:

- `this.json(data, status?, headers?)`: Returns JSON response.
- `this.html(html, status?, headers?)`: Returns HTML response.
- `this.text(text, status?, headers?)`: Returns plain text response.
- `this.redirect(url, status?)`: Returns a redirect.
- `this.noContent()`: Returns 204 No Content.
- `this.notFound(msg?)`: Returns 404.
- `this.unauthorized(msg?)`: Returns 401.
- `this.forbidden(msg?)`: Returns 403.
- `this.badRequest(msg?)`: Returns 400.
- `this.unprocessableEntity(errors?)`: Returns 422.
- `this.internalServerError(msg?)`: Returns 500.

### 5. Infrastructure Helpers

- `this.getEnv(key, default?)`: Safe environment variable access.
- `this.waitUntil(promise)`: Extend execution for background tasks (Cloudflare/Edge compatible).
- `this.setMetadata(key, value)` / `this.getMetadata(key)`: Contextual storage.

### 6. Creating Custom Adapters (BaseAdapter)

If `DrivingAdapter` or `DrivenAdapter` don't fit your needs, you can extend `BaseAdapter` directly to create custom adapter types (e.g., Background Workers, Task Queues).

```typescript
import { BaseAdapter } from "@nowarelabs/adapters";

export class WorkerAdapter extends BaseAdapter {
  async process(data: any) {
    return this.runAroundHooks(async () => {
      // Custom execution logic
      const result = await this.doWork(data);
      return result;
    });
  }

  private async doWork(data: any) {
    // ...
  }
}
```

## Development

- Install dependencies: `vp install`
- Run the unit tests: `vp test`
- Build the library: `vp pack`
