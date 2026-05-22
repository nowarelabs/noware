# @nowarelabs/models

A lightweight, zero-dependency ORM-like model layer following the Standard Gauge RCSM pattern (Model layer in M of RCSM).

**Connection Flow:** `BaseService → BaseModel → BasePersistence`

## Features

- **Zero external dependencies** - no Drizzle, no knex, no ORM bloat
- **Fluent query builder** with chainable API
- **Multiple database drivers** - works with Cloudflare D1, SQLite, PostgreSQL, MySQL, or any database with `execSql`, `prepare`, `all`, or `exec` methods
- **Lifecycle callbacks** - before/after hooks for validation, save, create, update, destroy
- **Relationship support** - belongs_to, has_one, has_many, has_and_belongs_to_many
- **Soft delete & lifecycle states** - trashed, hidden, flagged, retired
- **Pagination & search** - built-in helpers
- **Type-safe generics** - full TypeScript support

## Installation

```bash
npm install @nowarelabs/models
```

## Quick Start

### Define a Model

```typescript
import { BaseModel } from "@nowarelabs/models";
import type { ContextLike, EnvLike, RequestLike } from "@nowarelabs/shared";

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

export class UserModel extends BaseModel<ContextLike, EnvLike, RequestLike, any, any, User, UserInsert> {
  static tableName = "users";

  protected persistence: any;

  constructor(db: any, request: Request, env: EnvLike, ctx: ContextLike) {
    super(db, "users", request, env, ctx);
    this.persistence = { db };
  }

  protected getPersistence() {
    return this.persistence;
  }
}
```

### Basic CRUD Operations

```typescript
// Create
const user = await userModel.create({ name: "Alice", email: "alice@example.com" });

// Find by ID
const found = await userModel.find(user.id);

// Update
await userModel.update(user.id, { name: "Alice Smith" });

// Delete
await userModel.delete(user.id);

// Get all
const allUsers = await userModel.all();
```

## Query Builder

The `FluentQuery` class provides a chainable API for building SQL queries.

### Selecting Columns

```typescript
// Select specific columns
const users = await userModel.select("id", "name").all();

// Select all columns (default)
const users = await userModel.all();
```

### Where Clauses

```typescript
// Simple equality
const users = await userModel.where({ status: "active" }).all();

// Comparison operators
await userModel.where({ age: { gt: 18 } }).all();        // >
await userModel.where({ age: { gte: 18 } }).all();       // >=
await userModel.where({ age: { lt: 65 } }).all();        // <
await userModel.where({ age: { lte: 65 } }).all();       // <=
await userModel.where({ status: { neq: "deleted" } }).all(); // !=
await userModel.where({ status: { eq: "active" } }).all();   // =

// NULL checks
await userModel.where({ deleted_at: null }).all();       // IS NULL

// LIKE
await userModel.where({ name: { like: "%John%" } }).all();

// IN / NOT IN
await userModel.where({ id: { in: [1, 2, 3] } }).all();
await userModel.where({ id: { nin: [4, 5, 6] } }).all();

// Multiple conditions (AND)
await userModel.where({ status: "active", role: "admin" }).all();

// OR conditions
const query = userModel.query();
query.where({ status: "active" });
query.orWhere({ role: "admin" });
const users = await query.all();

// Callback-style complex conditions
await userModel.where((q) => {
  q.where({ status: "active" });
  q.orWhere({ role: "admin" });
}).all();
```

### Ordering, Limiting, and Pagination

```typescript
// Order by
const users = await userModel.orderBy("created_at", "DESC").all();

// Limit and offset
const users = await userModel.limit(10).offset(20).all();

// Find first
const firstUser = await userModel.query().limit(1).first();

// Find by conditions
const user = await userModel.findBy({ email: "alice@example.com" });

// Find all by conditions with options
const users = await userModel.findAllBy(
  { status: "active" },
  { orderBy: { column: "name", direction: "ASC" }, limit: 10, offset: 0 }
);

// Pagination
const result = await userModel.paginate({ page: 1, perPage: 10 });
// Returns: { items, total, page, perPage, totalPages }
```

### Plucking Values

```typescript
// Get array of single column values
const emails = await userModel.pluck("email");

// With conditions and options
const emails = await userModel.pluck("email", { status: "active" }, {
  orderBy: { column: "name" },
  limit: 10,
});
```

### Counting

```typescript
// Total count
const total = await userModel.count();

// Count with conditions
const activeCount = await userModel.countBy({ status: "active" });
```

### Finding by IDs

```typescript
const users = await userModel.findByIds([1, 2, 3]);
```

## Lifecycle States

Built-in soft delete and state management with timestamp columns.

### Querying by State

```typescript
// Trashed records
const trashed = await userModel.trashed().all();
const active = await userModel.notTrashed().all();

// Hidden records
const hidden = await userModel.hidden().all();
const visible = await userModel.notHidden().all();

// Flagged records
const flagged = await userModel.flagged().all();
const unflagged = await userModel.notFlagged().all();

// Retired records
const retired = await userModel.retired().all();
const active = await userModel.notRetired().all();

// Active (not trashed, not hidden, not retired)
const active = await userModel.active().all();
```

### Mutating State

```typescript
// Soft delete
await userModel.trash(id);
await userModel.restore(id);

// Hide/unhide
await userModel.hide(id);
await userModel.unhide(id);

// Flag/unflag
await userModel.flag(id);
await userModel.unflag(id);

// Retire/unretire
await userModel.retire(id);
await userModel.unretire(id);

// Permanent delete
await userModel.purge(id);
```

## Lifecycle Callbacks

Register callbacks that run at specific points during CRUD operations.

### Available Events

| Event | When |
|-------|------|
| `beforeValidation` | Before validation runs |
| `afterValidation` | After validation passes |
| `beforeSave` | Before any save (create or update) |
| `afterSave` | After any save completes |
| `beforeCreate` | Before creating a record |
| `afterCreate` | After creating a record |
| `beforeUpdate` | Before updating a record |
| `afterUpdate` | After updating a record |
| `beforeDestroy` | Before deleting a record |
| `afterDestroy` | After deleting a record |
| `afterCommit` | After successful commit |
| `afterCreateCommit` | After create commit |
| `afterUpdateCommit` | After update commit |
| `afterSaveCommit` | After save commit |
| `afterDestroyCommit` | After destroy commit |
| `afterRollback` | On rollback/failure |

### Registering Callbacks

```typescript
export class UserModel extends BaseModel<...> {
  constructor(...args: any[]) {
    super(...args);

    this.beforeCreate((data) => {
      data.created_at = new Date().toISOString();
    });

    this.beforeUpdate((data) => {
      data.updated_at = new Date().toISOString();
    });

    this.afterCreate((record) => {
      console.log(`User created: ${record.id}`);
    });

    this.beforeDestroy((data) => {
      // Return ABORT to cancel the operation
      if (data.protected) return ABORT;
    });

    // Conditional callbacks
    this.afterCreate(sendWelcomeEmail, { on: "create" });
    this.beforeUpdate(validateEmail, { if: (data) => data.email });
    this.beforeUpdate(skipIfAdmin, { unless: (data) => data.role === "admin" });
  }
}
```

### Callback Options

```typescript
// Run only on specific operations
{ on: "create" }
{ on: ["create", "update"] }

// Run only if condition is true
{ if: (record) => record.status === "active" }
{ if: "methodName" } // references a method on the model

// Run unless condition is true
{ unless: (record) => record.role === "admin" }
```

## Relationships

Define relationships between models for eager loading and traversal.

### Defining Relationships

```typescript
export class UserModel extends BaseModel<...> {
  constructor(...args: any[]) {
    super(...args);

    this.hasMany("posts", { model: "PostModel", foreignKey: "user_id" });
    this.hasOne("profile", { model: "ProfileModel", foreignKey: "user_id" });
    this.belongsTo("team", { model: "TeamModel", foreignKey: "team_id" });
    this.hasAndBelongsToMany("roles", { model: "RoleModel", through: "user_roles" });
  }
}
```

### Eager Loading

```typescript
// Load with separate queries (default)
const users = await userModel.with("posts", "profile").all();

// Load with JOINs
const users = await userModel.withJoins("posts").all();

// Force separate queries
const users = await userModel.withSeparateQueries("posts").all();
```

### Relationship Traversal

```typescript
// List related IDs
const postIds = await userModel.listChildIds("posts", userId);
const teamId = await userModel.listParentIds("team", userId);
const siblingIds = await userModel.listSiblingIds("posts", postId);

// Hierarchical traversal
const ancestorIds = await userModel.listAncestorIds("parent", nodeId);
const descendantIds = await userModel.listDescendantIds("children", nodeId);
const cousinIds = await userModel.listCousinIds("siblings", nodeId);

// Generic related IDs
const relatedIds = await userModel.listRelatedIds("posts", userId);
```

## Search and Filtering

```typescript
// Full-text search across columns
const results = await userModel.search("alice", ["name", "email"]);

// Filterable pagination
const result = await userModel.paginate({
  page: 1,
  perPage: 10,
  filters: { status: "active" },
});

// Define filterable columns on your model
class UserModel extends BaseModel<...> {
  static filterableBy = ["status", "role", "team_id"];
  static searchableBy = ["name", "email"];
}
```

## Include/Eager Loading

```typescript
// Find with included relations
const user = await userModel.findWith(
  { id: userId },
  {
    posts: { model: "PostModel", foreignKey: "user_id" },
    profile: { model: "ProfileModel", foreignKey: "user_id" },
  }
);

// Find all with included relations
const users = await userModel.findAllWith(
  { status: "active" },
  { posts: { model: "PostModel", foreignKey: "user_id" } },
  { orderBy: { column: "name" }, limit: 10 }
);
```

## Model Registry

Register models for cross-model relationship resolution.

```typescript
// Register models
BaseModel.register("UserModel", UserModel);
BaseModel.register("PostModel", PostModel);

// Access registered models
const UserModel = BaseModel.registry["UserModel"];
```

## defineModel Helper

Create a simple model definition.

```typescript
import { defineModel } from "@nowarelabs/models";

const UserSchema = defineModel("users", {
  id: "integer",
  name: "text",
  email: "text",
  created_at: "text",
});
```

## SQL Builder (Advanced)

For custom queries, use the built-in SQL builder.

```typescript
import { sql, Statement, SqlPart } from "@nowarelabs/models";

// Build a custom statement
const stmt = sql.statement([
  sql.key("SELECT "),
  sql.id("name"),
  sql.key(", "),
  sql.id("email"),
  sql.key(" FROM "),
  sql.id("users"),
  sql.key(" WHERE "),
  sql.id("status"),
  sql.op(" = "),
  sql.val("active"),
]);

// Compile to SQL
const result = stmt.toSql();
console.log(result.data.value);
// SELECT "name", "email" FROM "users" WHERE "status" = 'active'

// SQL helper functions
sql.raw("SELECT")        // Raw SQL string
sql.id("users")          // Quoted identifier: "users"
sql.val("Alice")         // Escaped value: 'Alice'
sql.op(" = ")            // Operator
sql.key("SELECT ")       // SQL keyword
sql.nl()                 // Newline
sql.composite(...)       // Composite parts
sql.join(parts, sep)     // Join parts with separator
```

## Error Handling

The package provides custom error classes for common database errors.

```typescript
import { ConflictError, ConstraintError, BadRequestError, CallbackAbortError, ABORT } from "@nowarelabs/models";

// Errors are automatically thrown by queryExec:
// - ConflictError: UNIQUE constraint failed
// - ConstraintError: FOREIGN KEY, NOT NULL, CHECK constraints
// - BadRequestError: Datatype mismatch

// Use ABORT in callbacks to cancel operations
this.beforeCreate((data) => {
  if (!data.email.includes("@")) return ABORT;
});
```

## Database Compatibility

The model layer works with any database that provides one of these interfaces:

| Method | Compatible With |
|--------|----------------|
| `db.execSql(sql)` | Custom SQL executors |
| `db.prepare(sql).all()` | Cloudflare D1, better-sqlite3 |
| `db.all({ sql })` | Durable Objects, custom APIs |
| `db.exec(sql).toArray()` | SQLite WASM |
| `db.select().from()` | Drizzle-like query builders |

## Logger

A fallback logger is included that matches `@noblackbox/logger` interface.

```typescript
import { Logger } from "@nowarelabs/models";

const logger = new Logger({ service: "my-app", context: { table: "users" } });
logger.info("User created", { id: 123 });
logger.debug("Query executed", { sql: "SELECT..." });
logger.error("Database error", { error: err.message });
logger.warn("Deprecated method called");
```

## API Reference

### BaseModel

| Method | Returns | Description |
|--------|---------|-------------|
| `create(data)` | `Promise<TSelect>` | Create a new record |
| `find(id)` | `Promise<TSelect \| null>` | Find record by ID |
| `update(id, data)` | `Promise<TSelect>` | Update a record |
| `delete(id)` | `Promise<boolean>` | Delete a record |
| `all()` | `Promise<TSelect[]>` | Get all records |
| `query()` | `FluentQuery` | Start a fluent query |
| `where(conditions)` | `FluentQuery` | Add WHERE clause |
| `select(...columns)` | `FluentQuery` | Select columns |
| `orderBy(col, dir)` | `FluentQuery` | Order results |
| `limit(n)` | `FluentQuery` | Limit results |
| `offset(n)` | `FluentQuery` | Offset results |
| `with(...relations)` | `FluentQuery` | Eager load relations |
| `count()` | `Promise<number>` | Count records |
| `countBy(conditions)` | `Promise<number>` | Count with conditions |
| `findBy(conditions)` | `Promise<TSelect \| null>` | Find one by conditions |
| `findAllBy(conditions, opts)` | `Promise<TSelect[]>` | Find many by conditions |
| `findByIds(ids)` | `Promise<TSelect[]>` | Find by array of IDs |
| `firstBy(conditions)` | `Promise<TSelect \| null>` | Find first by conditions |
| `pluck(column, cond, opts)` | `Promise<any[]>` | Get column values |
| `paginate(params)` | `Promise<PaginatedResult>` | Paginated results |
| `search(term, columns)` | `FluentQuery` | Full-text search |
| `trash(id)` | `Promise<TSelect>` | Soft delete |
| `restore(id)` | `Promise<TSelect>` | Restore soft deleted |
| `hide(id)` | `Promise<TSelect>` | Hide record |
| `unhide(id)` | `Promise<TSelect>` | Unhide record |
| `flag(id)` | `Promise<TSelect>` | Flag record |
| `unflag(id)` | `Promise<TSelect>` | Unflag record |
| `retire(id)` | `Promise<TSelect>` | Retire record |
| `unretire(id)` | `Promise<TSelect>` | Unretire record |
| `purge(id)` | `Promise<boolean>` | Permanent delete |
| `transaction(fn)` | `Promise<T>` | Wrap in transaction |

### FluentQuery

| Method | Returns | Description |
|--------|---------|-------------|
| `select(...cols)` | `this` | Select columns |
| `where(conditions)` | `this` | Add AND condition |
| `orWhere(conditions)` | `this` | Add OR condition |
| `orderBy(col, dir)` | `this` | Order by column |
| `limit(n)` | `this` | Set limit |
| `offset(n)` | `this` | Set offset |
| `with(...rels)` | `this` | Eager load relations |
| `withJoins(...rels)` | `this` | Load via JOINs |
| `withSeparateQueries(...rels)` | `this` | Load via separate queries |
| `join(table, on)` | `this` | Add JOIN clause |
| `all()` | `Promise<TSelect[]>` | Execute and get all |
| `first()` | `Promise<TSelect \| null>` | Get first result |
| `count()` | `Promise<number>` | Count results |
| `pluck(column)` | `Promise<TSelect[K][]>` | Get column values |
| `toSql()` | `string` | Get generated SQL |
| `clone()` | `FluentQuery` | Clone the query |
| `paginate(params)` | `Promise<PaginatedResult>` | Paginate results |

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
