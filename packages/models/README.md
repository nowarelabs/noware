# nomo/models

An ActiveRecord-inspired ORM for Cloudflare's database landscape. It provides a type-safe, fluent DSL for interacting with D1 and Durable Objects SQL while maintaining a clean, class-based interface.

## Installation

```bash
pnpm add nomo/models
```

---

## 1. Core Concepts

### 1.1. `BaseModel`

All models should extend `BaseModel`. This provides built-in CRUD operations and lifecycle management.

```typescript
import { BaseModel } from "nomo/models";
import { accounts } from "./schema";

export class Account extends BaseModel<typeof accounts> {
  constructor(db: any) {
    super(db, accounts);
  }
}
```

### 1.2. The Capture & Sync Workflow

Models are typically generated or updated using the `nomo/migrations` `sync` command, ensuring that your TypeScript classes always match your database schema.

---

## 2. Querying with `FluentQuery`

The `query()` method returns a `FluentQuery` instance, enabling a chainable, expressive API.

### 2.1. Basic Queries

```typescript
// Find all active accounts
const active = await Account.where({ status: "active" }).all();

// Find one by email
const user = await Account.findBy({ email: "user@example.com" });

// Count records
const total = await Account.where({ isAdmin: true }).count();
```

### 2.2. Advanced Clauses

- **`select(...columns)`**: Narrow the returned data.
- **`join(table, on)`**: Perform relational joins.
- **`orderBy(column, direction)`**: Sort results.
- **`limit(n)` / `offset(n)`**: Pagination support.

```typescript
const feed = await Post.query()
  .select("title", "content")
  .join(users, "posts.user_id = users.id")
  .orderBy("created_at", "DESC")
  .limit(10)
  .all();
```

---

## 3. CRUD Operations

`BaseModel` provides standard methods for data manipulation:

- **`create(data)`**: Inserts a new record and runs "create" hooks.
- **`update(id, data)`**: Updates an existing record and runs "update" hooks.
- **`delete(id)`**: Removes a record and runs "delete" hooks.
- **`find(id)`**: Fetches a single record by primary key.

---

## 4. Lifecycle Hooks

Customize behavior by overriding protected hook methods in your model classes.

```typescript
export class User extends BaseModel<typeof users> {
  protected async _beforeCreate(data: UserInsert) {
    data.password = await hash(data.password);
    return data;
  }

  protected async _afterCreate(user: UserSelect) {
    await sendWelcomeEmail(user);
  }
}
```

Available hooks: `_beforeCreate`, `_afterCreate`, `_beforeUpdate`, `_afterUpdate`, `_beforeSave`, `_afterSave`, `_beforeDelete`, `_afterDelete`.

---

## 5. Multi-Driver Support

`nomo/models` works natively with:

- **Cloudflare D1**: Uses the standard D1 binding (`db.all`, `db.insert`, etc.).
- **Durable Objects**: Uses the `storage.sql` interface (`db.exec`).

Execution details are abstracted away, allowing you to use the same model logic regardless of where the data resides.

---

## License

MIT
