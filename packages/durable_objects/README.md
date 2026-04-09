# nomo/durable-objects

Production-ready Durable Objects with a Rails-like DSL and composition via the Delegate Pattern.

## Features

- **Rails-like DSL**: Declaring behaviors (Populate, View, Queue, etc.) in a concise, readable way.
- **Composition via Delegates**: Mix and match patterns (Check, Populate, View, Queue, Lock, etc.) within a single Durable Object.
- **Persistent SQL Storage**: Built-in integration with D1/SQLite storage using Drizzle ORM.
- **Automatic RPC Exposure**: DSL-registered patterns automatically expose their primary methods for direct RPC calls.

## Installation

```bash
pnpm add nomo/durable-objects
```

## Usage

Extend `BaseDurableObject` and use the DSL in your constructor to add behaviors.

```typescript
import { BaseDurableObject } from "nomo/durable-objects";
import { matches } from "./schema";

export class MatchViewDO extends BaseDurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // 1. Data Projection Pattern
    this.is_view({
      table: matches,
      primaryKey: "id"
    });

    // 2. Population Pattern
    this.can_populate({
      from: async (owner, matchId) => {
        const data = await owner.env.MATCH_SERVICE.getMatch(matchId);
        return [data];
      },
      into: matches
    });

    // 3. Task Queue Pattern
    this.is_queue({
      name: "score_updates",
      onProcess: async (owner, item) => {
        await owner.db.update(matches).set({ score: item.score }).where(eq(matches.id, item.id));
      }
    });

    // 4. Locking Pattern
    this.is_lock({
      type: "status",
      timeoutMs: 30000
    });
  }
}
```

### Available Patterns (DSL)

| DSL Method | Delegate | Description |
|------------|----------|-------------|
| `is_view(config)` | `ViewDelegate` | Exposes `view.handle()` and `view.find()` for querying local state. |
| `can_populate(config)` | `PopulateDelegate` | Exposes `populate()` to fill DO storage from external sources. |
| `is_queue(config)` | `QueueDelegate` | SQL-backed queue for background tasks. |
| `is_check(config)` | `CheckDelegate` | Validation logic for incoming data. |
| `is_lock(config)` | `LockDelegate` | Synchronization for status or callback confirmation. |
| `is_search(config)` | `SearchDelegate` | LIKE-based search and pagination. |
| `is_sequential(config)`| `ExecutionDelegate`| Sequential task execution. |
| `is_parallel(config)` | `ExecutionDelegate`| Parallel task execution. |
| `is_event_log(config)` | `LogDelegate` | Recording events to a log table. |
| `is_calculate(config)` | `LogicDelegate` | Complex calculation logic. |
| `is_trigger(config)` | `LogicDelegate` | Reactive event triggers. |
| `is_configure(config)` | `ConfigDelegate` | Custom DO configuration handling. |

### RPC Accessibility

Methods defined by the DSL are automatically bound to the DO instance:

```typescript
const stub = env.MATCH_VIEW_DO.get(id);
await stub.populate("match_123"); // Calls the PopulateDelegate
const match = await stub.view.find("match_123"); // Calls the ViewDelegate.find
```

## Custom Delegates

You can create your own delegates by extending `DurableObjectBaseDelegate`:

```typescript
import { DurableObjectBaseDelegate } from "nomo/durable-objects";

export class CustomDelegate extends DurableObjectBaseDelegate {
  async handle(data: any) {
    // Custom logic
  }
}

// In your DO constructor:
this.use("custom", CustomDelegate, { /* config */ });
```

## License

MIT
