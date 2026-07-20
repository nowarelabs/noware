# @nowarelabs/models

A lightweight, zero-dependency ORM-like model layer for Cloudflare D1, Durable Objects, and any SQL-compatible driver.

**Architecture:** `BaseService → BaseModel → BasePersistence`

## Features

- **Zero runtime dependencies** — no Drizzle, no knex
- **Parameterized queries** on `db.prepare` (D1); string interpolation fallback for `execSql`/`all`/`exec`
- **Fluent query builder** with chainable API
- **Lifecycle callbacks** — before/after hooks with conditional guards and abort support
- **Relationships** — belongs_to, has_one, has_many, has_and_belongs_to_many with eager loading via JOINs or separate queries
- **Transactions** — BEGIN/COMMIT/ROLLBACK with per-operation rollback callbacks
- **Soft delete & lifecycle states** — trashed, hidden, flagged, retired
- **Pagination, search, and filtering** — built-in helpers
- **TypeScript generics** throughout

## Installation

```bash
npm install @nowarelabs/models
```

## Quick Start

### Define a Model

```typescript
import { BaseModel } from "@nowarelabs/models";

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface UserInsert {
  name: string;
  email: string;
}

export class UserModel extends BaseModel<
  ContextLike,
  EnvLike,
  RequestLike,
  any,
  any,
  User,
  UserInsert
> {
  static tableName = "users";

  protected persistence: any;

  constructor(init: ModelInit) {
    super(init);
  }

  protected getPersistence() {
    return this.persistence;
  }
}
```

### Instantiating

There are two ways to construct a model, depending on whether you have a database handle directly or need to resolve it lazily:

```typescript
// Direct — pass db and table explicitly
const model = new UserModel({ db: d1Binding, table: "users" });

// Lazy — resolve db later via getPersistence()
const model = new UserModel({ request, env, ctx });
```

When using `ModelDbInit` (`{ db, table }`), the db is available immediately. When using `ModelRequestInit` (`{ request, env, ctx }`), the table name falls back to the static `tableName` property and the db is resolved lazily through `getPersistence()`.

### Basic CRUD

```typescript
// Create
const user = await model.create({ name: "Alice", email: "alice@example.com" });

// Find by ID
const found = await model.find(user.id);

// Update
await model.update(user.id, { name: "Alice Smith" });

// Delete (returns boolean)
const deleted = await model.delete(user.id);

// Get all
const allUsers = await model.all();
```

## End-to-End Guide

A complete walkthrough from schema to running code. A working example lives in [`examples/d1-orm-demo/`](./examples/d1-orm-demo/).

### 1. Define your schema

Plain objects describe your columns for typing and introspection:

```typescript
// schema.ts
export const usersTable = {
  id: { type: "text", primaryKey: true },
  name: { type: "text" },
  email: { type: "text" },
  created_at: { type: "text" },
} as const;

export const postsTable = {
  id: { type: "text", primaryKey: true },
  user_id: { type: "text" },
  title: { type: "text" },
  body: { type: "text" },
  published_at: { type: "text" },
} as const;

export type UserRow = { id: string; name: string; email: string; created_at: string };
export type PostRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  published_at: string | null;
};
```

### 2. Define each model

Each model extends `BaseModel`, declares its table, columns, relationships, and lifecycle hooks in the constructor body:

```typescript
// models/User.ts
import { BaseModel } from "@nowarelabs/models";
import { usersTable, type UserRow } from "../schema.js";

export class User extends BaseModel<
  any,
  any,
  any,
  any,
  typeof usersTable,
  UserRow,
  Partial<UserRow>
> {
  static tableName = "users";
  static columnTypes = Object.fromEntries(Object.entries(usersTable).map(([k, v]) => [k, v.type]));

  protected persistence: any = null;

  constructor(init: any) {
    super({ ...init, table: init.table ?? usersTable });

    this.hasMany("posts", { model: "Post", foreignKey: "user_id" });

    this.beforeCreate((data: any) => {
      if (!data.created_at) data.created_at = new Date().toISOString();
    });
  }

  protected getPersistence() {
    return { db: this.db };
  }
}

BaseModel.register("User", User);
```

```typescript
// models/Post.ts
import { BaseModel } from "@nowarelabs/models";
import { postsTable, type PostRow } from "../schema.js";

export class Post extends BaseModel<
  any,
  any,
  any,
  any,
  typeof postsTable,
  PostRow,
  Partial<PostRow>
> {
  static tableName = "posts";
  static columnTypes = Object.fromEntries(Object.entries(postsTable).map(([k, v]) => [k, v.type]));

  protected persistence: any = null;

  constructor(init: any) {
    super({ ...init, table: init.table ?? postsTable });
    this.belongsTo("author", { model: "User", foreignKey: "user_id" });
  }

  protected getPersistence() {
    return { db: this.db };
  }
}

BaseModel.register("Post", Post);
```

### 3. Use it in your Worker

```typescript
import { User } from "./models/User.js";
import { Post } from "./models/Post.js";

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const db = env.DB as any;
    const users = new User({ db, table: "users" });
    const posts = new Post({ db, table: "posts" });

    // CREATE
    const alice = await users.create({ name: "Alice", email: "alice@example.com" });

    // FIND
    const found = await users.find(alice.id);
    const byEmail = await users.findBy({ email: "alice@example.com" });

    // FILTERED QUERY
    const recentUsers = await users
      .where({ created_at: { gt: "2026-01-01" } })
      .orderBy("created_at", "DESC")
      .limit(10)
      .all();

    // PAGINATION
    const page = await users.paginate({ page: 1, perPage: 20 });

    // CREATE RELATED RECORDS
    await posts.create({ user_id: alice.id, title: "Hello", body: "First post" });

    // EAGER LOADING (separate queries — safe default, works with LIMIT)
    const usersWithPosts = await users.with("posts").all();

    // EAGER LOADING (JOIN — no LIMIT/OFFSET on has_many)
    const postsWithAuthor = await posts.withJoins("author").all();

    // UPDATE
    await users.update(alice.id, { name: "Alice Smith" });

    // TRANSACTION
    await users.transaction(async (tx) => {
      const bob = await tx.create({ name: "Bob", email: "bob@example.com" });
      await posts.create({ user_id: bob.id, title: "Bob's post", body: "..." });
      // COMMIT happens automatically; if either write throws, both roll back
    });

    // DELETE
    await users.delete(alice.id);

    return Response.json({ page, usersWithPosts, postsWithAuthor });
  },
};
```

### Key things to know

- **`DatabaseInstance`** just needs to look like D1 (`prepare().bind().all()`), a DO storage wrapper (`execSql`), or anything with `.all()`/`.exec()`.
- **`static columnTypes`** on each model is required for `withJoins()` — that's how the library enumerates columns to alias.
- **`with()` / `withSeparateQueries`** is the safe default for `has_many` relations, especially combined with `limit`/`offset`. Use `withJoins()` only for `belongs_to`/`has_one`, or `has_many` when you're not paginating.
- **Lifecycle hooks** are registered in the constructor body and apply to every instance of that model.
- **Transactions** wrap real `BEGIN`/`COMMIT`/`ROLLBACK` and only fire commit-callbacks after a successful commit, and rollback-callbacks once per rolled-back operation.

### Running the example locally

```bash
bun run packages/models/examples/d1-orm-demo/main.ts
```

## Query Builder

The `FluentQuery` class provides a chainable API. Nothing executes until you call a terminal method (`.all()`, `.first()`, `.count()`, `.pluck()`, `.paginate()`).

```typescript
const results = await model
  .select("id", "name")
  .where({ status: "active" })
  .where({ age: { gte: 18 } })
  .orderBy("created_at", "DESC")
  .limit(10)
  .offset(0)
  .all();
```

### Where Operators

```typescript
// Equality (default)
.where({ status: "active" })

// Comparison
.where({ age: { gt: 18 } })   // >
.where({ age: { gte: 18 } })  // >=
.where({ age: { lt: 65 } })   // <
.where({ age: { lte: 65 } })  // <=
.where({ name: { neq: "" } }) // !=
.where({ name: { like: "%John%" } })

// NULL checks
.where({ deleted_at: null })  // IS NULL

// Set membership
.where({ id: { in: [1, 2, 3] } })
.where({ id: { nin: [4, 5, 6] } })

// Multiple conditions (AND)
.where({ status: "active", role: "admin" })

// OR conditions
const q = model.query();
q.where({ status: "active" });
q.orWhere({ role: "admin" });
const results = await q.all();

// Grouped conditions
.where((q) => {
  q.where({ status: "active" });
  q.orWhere({ role: "admin" });
})
```

### Convenience Query Methods

```typescript
await model.count(); // total count
await model.countBy({ status: "active" }); // count with conditions
await model.findBy({ email: "alice@example.com" }); // find one by conditions
await model.findAllBy({ status: "active" }, { orderBy: { column: "name" }, limit: 10 });
await model.findByIds([1, 2, 3]);
await model.firstBy({ status: "active" });

// Pluck — array of single column values
const emails = await model.pluck("email");
const emails = await model.pluck(
  "email",
  { status: "active" },
  { orderBy: { column: "name" }, limit: 10 },
);

// Pagination — returns { items, total, page, perPage, totalPages }
const page = await model.paginate({ page: 1, perPage: 10 });
```

### Search

Define searchable columns on your model, then call `search()`:

```typescript
class UserModel extends BaseModel<...> {
  static searchableBy = ["name", "email"];
  static filterableBy = ["status", "role", "team_id"];
}

// Full-text search across defined columns
const results = await model.search("alice").all();

// Filtered pagination
const page = await model.paginate({ page: 1, perPage: 10, filters: { status: "active" } });
```

Unlisted filter keys are silently ignored. Only columns in `filterableBy` are applied.

## Lifecycle States

Built-in soft delete and state management using timestamp columns (`trashed_at`, `hidden_at`, `flagged_at`, `retired_at`).

### Querying

```typescript
await model.trashed().all(); // trashed_at IS NOT NULL
await model.notTrashed().all(); // trashed_at IS NULL
await model.hidden().all();
await model.notHidden().all();
await model.flagged().all();
await model.notFlagged().all();
await model.retired().all();
await model.notRetired().all();
await model.active().all(); // trashed_at IS NULL AND hidden_at IS NULL AND retired_at IS NULL
```

### Mutating

```typescript
await model.trash(id); // sets trashed_at
await model.restore(id); // clears trashed_at
await model.hide(id);
await model.unhide(id);
await model.flag(id);
await model.unflag(id);
await model.retire(id);
await model.unretire(id);
await model.purge(id); // hard-deletes the record (delete + no soft state)
```

## Relationships

### Defining

```typescript
export class UserModel extends BaseModel<...> {
  constructor(init: ModelInit) {
    super(init);

    this.hasMany("posts", { model: "PostModel", foreignKey: "user_id" });
    this.hasOne("profile", { model: "ProfileModel", foreignKey: "user_id" });
    this.belongsTo("team", { model: "TeamModel", foreignKey: "team_id" });
    this.hasAndBelongsToMany("roles", { model: "RoleModel", through: "user_roles" });
  }
}
```

- **`belongsTo`** — FK lives on this model, points to the related model's PK
- **`hasOne`** — FK lives on the related model, returns a single record
- **`hasMany`** — FK lives on the related model, returns a collection
- **`hasAndBelongsToMany`** — requires a junction table (`through`)

### Eager Loading

Three strategies, each available on both `FluentQuery` and as delegates on `BaseModel`:

```typescript
// Separate queries (default, safest)
// Issues one batched query per relation: WHERE fk IN (...)
const users = await model.with("posts", "profile").all();

// JOIN strategy
// Adds LEFT JOINs, aliases columns as relName__col, deduplicates on id
// Requires registered models with columnTypes defined
const users = await model.withJoins("posts").all();

// Explicit separate queries (same as with())
const users = await model.withSeparateQueries("posts").all();
```

**`withJoins` guard:** Cannot be combined with `limit`/`offset` for `has_many`, `has_many_through`, or `has_and_belongs_to_many` relations. JOIN fan-out makes LIMIT semantics unreliable. Use `withSeparateQueries` instead for paginated queries with has-many relations.

**`withJoins` requirements:** The related model must be registered via `BaseModel.register()` and must define `static columnTypes`. If either is missing, an error is thrown instructing you to use `withSeparateQueries`.

### Relationship Traversal

```typescript
// Direct relationships
const postIds = await model.listChildIds("posts", userId); // has_many: related FK = userId
const teamId = await model.listParentIds("team", userId); // belongs_to: reads FK from this record
const siblingIds = await model.listSiblingIds("posts", postId); // has_many: same parent, exclude self

// Tree traversal (max depth 100, cycle-safe)
const ancestorIds = await model.listAncestorIds("parent", nodeId); // walks up via belongs_to
const descendantIds = await model.listDescendantIds("children", nodeId); // walks down via has_many

// Siblings of the parent's other children
const cousinIds = await model.listCousinIds("posts", "author", postId);

// Through a junction table
const tagIds = await model.listAssociatedThroughIds("tags", "post_tags", postId);

// Generic dispatcher (delegates to child/parent based on relation type)
const relatedIds = await model.listRelatedIds("posts", userId);
```

### Model Registry

Register models so relationship traversal and eager loading can resolve them by name:

```typescript
BaseModel.register("UserModel", UserModel);
BaseModel.register("PostModel", PostModel);
```

### findWith / findAllWith

Enrich records with related data without defining formal relationships:

```typescript
const user = await model.findWith(
  { id: userId },
  {
    posts: { model: "PostModel", foreignKey: "user_id" },
    profile: { model: "ProfileModel", foreignKey: "user_id" },
  },
);

const users = await model.findAllWith(
  { status: "active" },
  { posts: { model: "PostModel", foreignKey: "user_id" } },
  { orderBy: { column: "name" }, limit: 10 },
);
```

## Transactions

Wrap multiple operations in a transaction. Operations inside the callback are queued and flushed after COMMIT; on error, ROLLBACK is issued and `afterRollback` fires.

```typescript
await model.transaction(async (m) => {
  const user = await m.create({ name: "Alice" });
  await m.update(user.id, { name: "Alice Smith" });
  // COMMIT happens automatically after the callback returns
});
```

### Behavior

- `BEGIN` is issued before the callback
- `COMMIT` is issued after the callback returns successfully
- On any error: `ROLLBACK` is issued, then `afterRollback` fires once per operation
- Post-commit callbacks (`afterCommit`, `afterCreateCommit`, etc.) are queued during the transaction and flushed only after COMMIT succeeds
- If a post-commit callback throws, it is caught and logged — it does **not** trigger a rollback of the already-committed data

### Rollback Callbacks

`afterRollback` receives the operation's record data merged with the error:

```typescript
this.afterRollback((data, context) => {
  // data = { id: 1, name: "Alice", error: "boom" }
  // context = "create" | "update" | "destroy"
  console.log(`Rolled back ${context}:`, data.error);
});
```

If no operations were queued (empty transaction), `afterRollback` fires once with a neutral `"create"` context.

## Lifecycle Callbacks

### Events

| Event                | When                               | Receives                      |
| -------------------- | ---------------------------------- | ----------------------------- |
| `beforeValidation`   | Before validation runs             | data (mutable)                |
| `afterValidation`    | After validation passes            | data (mutable)                |
| `beforeSave`         | Before any save (create or update) | data (mutable)                |
| `afterSave`          | After any save completes           | record                        |
| `beforeCreate`       | Before creating a record           | data (mutable)                |
| `afterCreate`        | After creating a record            | record                        |
| `beforeUpdate`       | Before updating a record           | data (mutable)                |
| `afterUpdate`        | After updating a record            | record                        |
| `beforeDestroy`      | Before deleting a record           | id                            |
| `afterDestroy`       | After deleting a record            | id                            |
| `afterCommit`        | After successful commit            | record                        |
| `afterCreateCommit`  | After create commit                | record                        |
| `afterUpdateCommit`  | After update commit                | record                        |
| `afterSaveCommit`    | After save commit                  | record                        |
| `afterDestroyCommit` | After destroy commit               | id                            |
| `afterRollback`      | On rollback/failure                | { ...record, error }, context |

### Execution Order

**create:** `beforeValidation` → `afterValidation` → `beforeSave` → `beforeCreate` → [INSERT] → `afterCreate` → `afterSave` → (`afterCommit` / `afterCreateCommit` / `afterSaveCommit`)

**update:** `beforeValidation` → `afterValidation` → `beforeSave` → `beforeUpdate` → [UPDATE] → `afterUpdate` → `afterSave` → (`afterCommit` / `afterUpdateCommit` / `afterSaveCommit`)

**delete:** `beforeDestroy` → [DELETE] → `afterDestroy` → (`afterCommit` / `afterDestroyCommit`)

### Registering Callbacks

All registration methods are `protected` — call them in your subclass constructor:

```typescript
export class UserModel extends BaseModel<...> {
  constructor(init: ModelInit) {
    super(init);

    this.beforeCreate((data) => {
      data.created_at = new Date().toISOString();
    });

    this.afterCreate((record) => {
      console.log(`User created: ${record.id}`);
    });

    this.beforeDestroy((id) => {
      // Return ABORT to cancel the operation
      if (id === 1) return ABORT;
    });
  }
}
```

### Callback Options

```typescript
// Run only on specific operations
this.afterCreate(sendWelcomeEmail, { on: "create" });
this.afterSave(logChange, { on: ["create", "update"] });

// Run only if condition is true (function or method name string)
this.beforeUpdate(validateEmail, { if: (data) => data.email });
this.beforeUpdate(validateEmail, { if: "isEmailChange" });

// Run unless condition is true
this.beforeUpdate(skipIfAdmin, { unless: (data) => data.role === "admin" });
```

### ABORT

Return `ABORT` from any before-callback to cancel the operation:

```typescript
import { ABORT } from "@nowarelabs/models";

this.beforeCreate((data) => {
  if (!data.email) return ABORT;
});
```

This throws a `CallbackAbortError`, which propagates up and prevents the SQL from executing.

## Database Compatibility

The model layer works with any object providing one or more of these methods. Driver detection runs in this order:

| Method                                  | Driver                         | Query Safety             |
| --------------------------------------- | ------------------------------ | ------------------------ |
| `db.prepare(sql).bind(...params).all()` | Cloudflare D1 / better-sqlite3 | **Parameterized** (safe) |
| `db.execSql(sql)`                       | D1 raw exec                    | String interpolation     |
| `db.all({ sql })`                       | Durable Objects storage        | String interpolation     |
| `db.exec(sql).toArray()`                | SQLite WASM                    | String interpolation     |

**Important:** Only the `db.prepare` path uses real parameterized queries. All other paths fall back to `interpolateSql`, which builds the SQL string with escaped literal values. Use `db.prepare` when available for protection against injection.

## Error Handling

```typescript
import {
  ConflictError,
  ConstraintError,
  BadRequestError,
  CallbackAbortError,
  ABORT,
} from "@nowarelabs/models";
```

| Error                | Trigger                                           | Details                                                                        |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ConflictError`      | UNIQUE constraint failed                          | —                                                                              |
| `ConstraintError`    | FOREIGN KEY, NOT NULL, or CHECK constraint failed | `.type` = `"FOREIGN_KEY"` / `"NOT_NULL"` / `"CHECK"`, `.details.originalError` |
| `BadRequestError`    | Datatype mismatch                                 | —                                                                              |
| `CallbackAbortError` | Callback returned `ABORT`                         | —                                                                              |

Errors are thrown automatically by `queryExec` when SQL execution fails. You can also throw them manually from callbacks.

## SQL Builder (Advanced)

For custom queries, use the built-in SQL AST builder:

```typescript
import { sql } from "@nowarelabs/models";

const stmt = sql.statement([
  sql.key("SELECT "),
  sql.id("name"),
  sql.op(", "),
  sql.id("email"),
  sql.key(" FROM "),
  sql.id("users"),
  sql.key(" WHERE "),
  sql.id("status"),
  sql.op(" = "),
  sql.val("active"),
]);

const result = stmt.toSql();
// result.success = true
// result.data.value = 'SELECT "name", "email" FROM "users" WHERE "status" = 'active''
// result.params = []
```

### Helpers

| Helper                    | Purpose                        | Example Output                                      |
| ------------------------- | ------------------------------ | --------------------------------------------------- |
| `sql.raw(str)`            | Raw SQL, no escaping           | `SELECT`                                            |
| `sql.id(str)`             | Quoted identifier              | `"users"`                                           |
| `sql.val(val)`            | Escaped value with placeholder | `__PH_0__` (compiled to `'Alice'` in interpolation) |
| `sql.op(str)`             | Operator                       | `= `                                                |
| `sql.key(str)`            | SQL keyword                    | `SELECT `                                           |
| `sql.nl()`                | Newline                        |                                                     |
| `sql.composite(...parts)` | Group parts into one SqlPart   | `"users"."name"`                                    |
| `sql.join(parts, sep)`    | Join parts with separator      | `"name", "email"`                                   |

## Logger

A minimal fallback logger matching `@noblackbox/logger`'s interface. Used automatically when `ctx.logger` is not available.

```typescript
import { Logger } from "@nowarelabs/models";

const logger = new Logger({ service: "my-app", context: { table: "users" } });
logger.info("User created", { id: 123 });
logger.debug("Query executed", { sql: "SELECT..." });
logger.error("Database error", { error: err.message });
logger.warn("Deprecated method called");
```

## defineModel Helper

Create a simple model definition without class inheritance:

```typescript
import { defineModel } from "@nowarelabs/models";

const UserSchema = defineModel("users", {
  id: "integer",
  name: "text",
  email: "text",
  created_at: "text",
});

// Returns { tableName: "users", columns: { id: "integer", ... } }
// Pass as the `table` arg to ModelDbInit
const model = new UserModel({ db: d1, table: UserSchema });
```

## API Reference

### BaseModel

| Method                                       | Returns                       | Description                            |
| -------------------------------------------- | ----------------------------- | -------------------------------------- |
| `create(data)`                               | `Promise<TSelect>`            | Insert a record                        |
| `find(id)`                                   | `Promise<TSelect \| null>`    | Find by ID                             |
| `update(id, data)`                           | `Promise<TSelect>`            | Update by ID (throws if not found)     |
| `delete(id)`                                 | `Promise<boolean>`            | Delete by ID                           |
| `all()`                                      | `Promise<TSelect[]>`          | Get all records                        |
| `purge(id)`                                  | `Promise<boolean>`            | Hard-delete                            |
| `transaction(fn)`                            | `Promise<T>`                  | Wrap in BEGIN/COMMIT/ROLLBACK          |
| `query()`                                    | `FluentQuery`                 | Start a fluent query                   |
| `where(conditions)`                          | `FluentQuery`                 | Add WHERE clause                       |
| `select(...columns)`                         | `FluentQuery`                 | Select specific columns                |
| `orderBy(col, dir)`                          | `FluentQuery`                 | Order results                          |
| `limit(n)`                                   | `FluentQuery`                 | Limit results                          |
| `offset(n)`                                  | `FluentQuery`                 | Offset results                         |
| `with(...relations)`                         | `FluentQuery`                 | Eager load (separate queries)          |
| `withJoins(...relations)`                    | `FluentQuery`                 | Eager load via JOINs                   |
| `withSeparateQueries(...rels)`               | `FluentQuery`                 | Eager load (explicit separate queries) |
| `count()`                                    | `Promise<number>`             | Count all                              |
| `countBy(conditions)`                        | `Promise<number>`             | Count with conditions                  |
| `findBy(conditions)`                         | `Promise<TSelect \| null>`    | Find one by conditions                 |
| `findAllBy(conditions, opts?)`               | `Promise<TSelect[]>`          | Find many by conditions                |
| `findByIds(ids)`                             | `Promise<TSelect[]>`          | Find by ID array                       |
| `firstBy(conditions)`                        | `Promise<TSelect \| null>`    | Find first by conditions               |
| `pluck(column, cond?, opts?)`                | `Promise<any[]>`              | Array of column values                 |
| `search(term, columns?)`                     | `FluentQuery`                 | Full-text LIKE search                  |
| `paginate(params?)`                          | `Promise<PaginatedResult>`    | Paginated results                      |
| `trash(id)` / `restore(id)`                  | `Promise<TSelect>`            | Soft delete / restore                  |
| `hide(id)` / `unhide(id)`                    | `Promise<TSelect>`            | Hide / unhide                          |
| `flag(id)` / `unflag(id)`                    | `Promise<TSelect>`            | Flag / unflag                          |
| `retire(id)` / `unretire(id)`                | `Promise<TSelect>`            | Retire / unretire                      |
| `findWith(cond, includes)`                   | `Promise<TSelect>`            | Find with inline eager loading         |
| `findAllWith(cond, includes, opts?)`         | `Promise<TSelect[]>`          | Find all with inline eager loading     |
| `listChildIds(rel, id)`                      | `Promise<(string\|number)[]>` | has_many child IDs                     |
| `listParentIds(rel, id)`                     | `Promise<(string\|number)[]>` | belongs_to parent ID                   |
| `listSiblingIds(rel, id)`                    | `Promise<(string\|number)[]>` | Sibling IDs (same parent)              |
| `listAncestorIds(rel, id)`                   | `Promise<(string\|number)[]>` | Walk up tree (max 100)                 |
| `listDescendantIds(rel, id)`                 | `Promise<(string\|number)[]>` | Walk down tree (max 100)               |
| `listCousinIds(rel, parentRel, id)`          | `Promise<(string\|number)[]>` | Parent's other children                |
| `listAssociatedThroughIds(rel, through, id)` | `Promise<(string\|number)[]>` | IDs from junction table                |
| `listRelatedIds(rel, id)`                    | `Promise<(string\|number)[]>` | Generic dispatcher                     |

### FluentQuery

| Method                         | Returns                    | Description                            |
| ------------------------------ | -------------------------- | -------------------------------------- |
| `select(...cols)`              | `this`                     | Select columns                         |
| `where(conditions)`            | `this`                     | AND condition                          |
| `orWhere(conditions)`          | `this`                     | OR condition                           |
| `join(table, on)`              | `this`                     | JOIN clause                            |
| `orderBy(col, dir?)`           | `this`                     | ORDER BY                               |
| `limit(n)`                     | `this`                     | LIMIT                                  |
| `offset(n)`                    | `this`                     | OFFSET                                 |
| `with(...rels)`                | `this`                     | Eager load (separate queries)          |
| `withJoins(...rels)`           | `this`                     | Eager load via JOINs                   |
| `withSeparateQueries(...rels)` | `this`                     | Eager load (explicit separate queries) |
| `all()`                        | `Promise<TSelect[]>`       | Execute query                          |
| `first()`                      | `Promise<TSelect \| null>` | First result or null                   |
| `count()`                      | `Promise<number>`          | Count matching rows                    |
| `pluck(column)`                | `Promise<any[]>`           | Column values array                    |
| `findBy(conditions, opts?)`    | `Promise<TSelect \| null>` | Find one                               |
| `findAllBy(conditions, opts?)` | `Promise<TSelect[]>`       | Find many                              |
| `findByIds(ids)`               | `Promise<TSelect[]>`       | Find by IDs                            |
| `firstBy(conditions)`          | `Promise<TSelect \| null>` | Find first                             |
| `paginate(params?)`            | `Promise<PaginatedResult>` | Paginate                               |
| `toSql()`                      | `string`                   | Compiled SQL (no execution)            |
| `clone()`                      | `FluentQuery`              | Deep copy                              |

## Development

```bash
# Install dependencies
vp install

# Run tests
vp test

# Build
vp pack

# Type check and lint
vp check
```

## License

MIT - See LICENSE file for details.
