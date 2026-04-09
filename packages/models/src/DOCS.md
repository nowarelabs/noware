# nomo/models Documentation

A Rails-inspired ORM layer for Cloudflare Workers (D1, Durable Objects) and other SQL databases. This package provides a fluent query builder, relationship management, lifecycle callbacks, and soft-delete patterns.

---

## Table of Contents

1. [FluentQuery Class](#fluentquery-class)
2. [BaseModel Class](#basemodel-class)
3. [Lifecycle Methods](#lifecycle-methods)
4. [Relationship Methods](#relationship-methods)
5. [Tips & Tricks](#tips--tricks)

---

## FluentQuery Class

A chainable query builder that constructs SQL statements programmatically. Used internally by BaseModel but can be instantiated directly for complex queries.

### `query()`

**Purpose**: Creates a new FluentQuery instance bound to a table.

**Under the Hood**: Initializes a new Statement builder with the table name and dialect strategy.

**Example**:
```typescript
const query = new FluentQuery(db, usersTable, logger);
const users = await query.where({ active: true }).limit(10).all();
```

**Expected Result**: Array of user records matching the conditions.

---

### `select(...columns)`

**Purpose**: Specifies which columns to return instead of all (`*`).

**Under the Hood**: Builds a `SELECT` clause with only the specified columns. If `"*"` is passed, resets to select all columns.

**Example**:
```typescript
const users = await userModel
  .select("id", "email", "name")
  .where({ active: true })
  .all();
```

**Expected Result**:
```json
[
  { "id": 1, "email": "john@example.com", "name": "John" },
  { "id": 2, "email": "jane@example.com", "name": "Jane" }
]
```

**Tip**: Use this to reduce payload size when you only need specific fields.

---

### `where(conditions)`

**Purpose**: Filters records based on conditions.

**Under the Hood**: Builds a `WHERE` clause. Supports special operators via object syntax:
- `{ eq: value }` - equals
- `{ neq: value }` - not equals
- `{ gt: value }` - greater than
- `{ gte: value }` - greater than or equal
- `{ lt: value }` - less than
- `{ lte: value }` - less than or equal
- `{ like: value }` - LIKE pattern match
- `{ in: [value1, value2, ...] }` - IN clause (matches any value in array)
- `{ nin: [value1, value2, ...] }` - NOT IN clause (matches values not in array)
- `null` - IS NULL

**Example**:
```typescript
// Simple equality
const users = await userModel.where({ role: "admin" }).all();

// Complex conditions
const users = await userModel.where({
  role: "admin",
  age: { gte: 18 },
  name: { like: "%john%" },
  deleted_at: null
}).all();

// IN clause - find users with specific roles
const users = await userModel.where({
  role: { in: ["admin", "moderator", "editor"] }
}).all();

// NOT IN clause - exclude specific IDs
const users = await userModel.where({
  id: { nin: [1, 2, 3] }
}).all();
```

**Expected Result**: Records matching all conditions combined with AND.

**Tip**: Passing `null` as a value generates `IS NULL` - use this for optional filters.

---

### `orderBy(column, direction)`

**Purpose**: Sorts results by a column.

**Under the Hood**: Builds an `ORDER BY` clause. Multiple calls add multiple order clauses.

**Example**:
```typescript
const users = await userModel
  .where({ active: true })
  .orderBy("created_at", "DESC")
  .orderBy("name", "ASC")
  .all();
```

**Expected Result**: Records sorted by created_at descending, then name ascending.

---

### `limit(n)` / `offset(n)`

**Purpose**: Pagination - limit results and skip to a specific position.

**Under the Hood**: Builds `LIMIT` and `OFFSET` clauses.

**Example**:
```typescript
const page = 2;
const pageSize = 20;
const users = await userModel
  .where({ active: true })
  .orderBy("created_at", "DESC")
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .all();
```

**Expected Result**: 20 records for page 2.

---

### `with(...relations)` / `withJoins(...relations)` / `withSeparateQueries(...relations)`

**Purpose**: Eager load related records to avoid N+1 query problems.

**Under the Hood**:
- **`with()`**: Auto-selects best strategy (preload or joins)
- **`withJoins()`**: Generates a single SQL query with LEFT JOINs, then parses prefixed columns
- **`withSeparateQueries()`**: Executes N+1 queries - collects all foreign keys, queries related table once, groups results

**Example**:
```typescript
// With auto strategy
const posts = await postModel
  .with("author", "comments")
  .where({ published: true })
  .all();

// With explicit joins (single query)
const posts = await postModel
  .withJoins("author", "tags")
  .where({ published: true })
  .all();

// With separate queries (preload pattern)
const posts = await postModel
  .withSeparateQueries("author", "comments")
  .where({ published: true })
  .all();
```

**Expected Result**:
```json
[
  {
    "id": 1,
    "title": "My Post",
    "author_id": 5,
    "author": [{ "id": 5, "name": "John" }],
    "comments": [
      { "id": 1, "body": "Great post!" },
      { "id": 2, "body": "Thanks!" }
    ]
  }
]
```

**Tip**: Use `withJoins()` when you need WHERE clauses on related tables. Use `withSeparateQueries()` for has_many relations where you want to filter in memory.

---

### `pluck(column)`

**Purpose**: Select a single column and return as a flat array.

**Under the Hood**: Builds a `SELECT column FROM table` query and maps results to extract just that column value.

**Example**:
```typescript
const emailList = await userModel
  .where({ active: true })
  .pluck("email");
```

**Expected Result**: `["john@example.com", "jane@example.com"]`

**Tip**: Use this to get just IDs for further queries, or to populate dropdown options.

---

### `count()`

**Purpose**: Get the count of records matching conditions.

**Under the Hood**: Executes `SELECT COUNT(*) as count` with any WHERE clauses.

**Example**:
```typescript
const totalAdmins = await userModel.where({ role: "admin" }).count();
```

**Expected Result**: `42`

---

### `first()`

**Purpose**: Get a single record (adds LIMIT 1).

**Under the Hood**: Sets limit to 1 and returns first result or null.

**Example**:
```typescript
const user = await userModel.where({ email: "john@example.com" }).first();
```

**Expected Result**: `{ "id": 1, "email": "john@example.com", ... }` or `null`

---

### `all()`

**Purpose**: Execute the query and return all results.

**Under the Hood**: Builds the full SQL statement, executes it via the appropriate database driver (D1, Drizzle, Durable Object storage, or RPC), and applies eager loading if relations were specified.

**Example**:
```typescript
const users = await userModel.where({ active: true }).all();
```

**Expected Result**: Array of matching records, or empty array if none found.

---

### `toSql()`

**Purpose**: Debugging - get the raw SQL string without executing.

**Under the Hood**: Builds the SQL and converts to string using the dialect strategy.

**Example**:
```typescript
const sql = userModel
  .where({ role: "admin", age: { gte: 18 } })
  .orderBy("created_at", "DESC")
  .limit(10)
  .toSql();

console.log(sql);
// SELECT * FROM users WHERE role = 'admin' AND age >= 18 ORDER BY created_at DESC LIMIT 10
```

---

## BaseModel Class

Extends FluentQuery with CRUD operations, relationships, callbacks, and lifecycle patterns.

### `create(data)`

**Purpose**: Insert a new record.

**Under the Hood**:
1. Runs `beforeValidation` and `afterValidation` callbacks
2. Runs `beforeSave` and `beforeCreate` callbacks
3. Auto-generates UUID if table has no auto-increment ID
4. Executes `INSERT ... RETURNING *`
5. Runs `afterCreate`, `afterSave`, and commit callbacks
6. Returns the created record with assigned ID

**Example**:
```typescript
const user = await userModel.create({
  email: "john@example.com",
  name: "John Doe",
  role: "user"
});
```

**Expected Result**: The newly created record with generated ID and timestamps.

**Error Handling**: Throws `ConflictError` on unique constraint violation.

---

### `update(id, data)`

**Purpose**: Update an existing record.

**Under the Hood**:
1. Runs `beforeValidation` and `afterValidation` callbacks
2. Runs `beforeSave` and `beforeUpdate` callbacks
3. Executes `UPDATE ... WHERE id = ? RETURNING *`
4. Runs `afterUpdate`, `afterSave`, and commit callbacks
5. Returns the updated record

**Example**:
```typescript
const updated = await userModel.update(123, {
  name: "John Smith",
  role: "admin"
});
```

**Expected Result**: The updated record with new values.

**Tip**: Use partial objects - only specify fields you want to change.

---

### `delete(id)`

**Purpose**: Hard delete a record.

**Under the Hood**:
1. Runs `beforeDestroy` callback
2. Executes `DELETE ... WHERE id = ? RETURNING *`
3. Runs `afterDestroy` and commit callbacks

**Example**:
```typescript
const success = await userModel.delete(123);
```

**Expected Result**: `true` if deleted, `false` if not found.

---

### `find(id)`

**Purpose**: Get a single record by ID.

**Under the Hood**: Uses Drizzle's query builder if available, otherwise falls back to FluentQuery with `{ id }` condition.

**Example**:
```typescript
const user = await userModel.find(123);
```

**Expected Result**: The record or `null` if not found.

---

### `findBy(conditions, options?)`

**Purpose**: Find a single record by any conditions.

**Under the Hood**: Creates a FluentQuery with WHERE conditions and calls `first()`.

**Example**:
```typescript
const user = await userModel.findBy({ email: "john@example.com" });
const userWithOffset = await userModel.findBy({ role: "admin" }, { offset: 5 });
```

**Expected Result**: First matching record or `null`.

---

### `findAllBy(conditions, options?)`

**Purpose**: Find all records matching conditions with ordering and pagination.

**Under the Hood**: Creates a FluentQuery, applies order/limit/offset, calls `all()`.

**Example**:
```typescript
const admins = await userModel.findAllBy(
  { role: "admin" },
  {
    orderBy: { column: "created_at", direction: "DESC" },
    limit: 20,
    offset: 40
  }
);
```

**Expected Result**: Array of matching records.

---

### `findByIds(ids)`

**Purpose**: Batch fetch multiple records by their IDs.

**Under the Hood**: Uses the `in` operator internally - converts array to `WHERE id IN (...)`.

**Example**:
```typescript
const users = await userModel.findByIds([1, 2, 3, 4, 5]);
// SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5)
```

**Expected Result**: Array of records with matching IDs, or empty array if none found.

**Tip**: Use this for batch operations like syncing or bulk updates.

---

### `countBy(conditions)`

**Purpose**: Count records matching specific conditions.

**Under the Hood**: Creates a query with WHERE conditions and executes `SELECT COUNT(*)`.

**Example**:
```typescript
const adminCount = await userModel.countBy({ role: "admin" });
const activeVipCount = await userModel.countBy({ role: "vip", status: "active" });
```

**Expected Result**: Number as integer (e.g., `42`).

---

### `firstBy(conditions)`

**Purpose**: Alias for `findBy` - makes intent clearer when you want exactly one result.

**Under the Hood**: Identical to `findBy` - creates FluentQuery with WHERE conditions and calls `first()`.

**Example**:
```typescript
// findBy - more ambiguous
const user = await userModel.findBy({ email: "john@example.com" });

// firstBy - intent is clearer: "get first matching record"
const user = await userModel.firstBy({ email: "john@example.com" });
```

**Expected Result**: First matching record or `null` if none found.

---

### `findAllWith(conditions, includes, options?)`

**Purpose**: Find all records with related data (manual loading).

**Under the Hood**: Executes main query, then for each result, runs separate queries for each included relation based on foreign keys.

**Example**:
```typescript
const posts = await postModel.findAllWith(
  { published: true },
  {
    author: { model: "User", foreignKey: "author_id" },
    comments: { model: "Comment", foreignKey: "post_id" }
  },
  { limit: 10 }
);
```

**Expected Result**: Posts array with `author` and `comments` arrays attached.

**Tip**: Use this when you need explicit control over which models to load.

---

### `findWith(conditions, includes)`

**Purpose**: Find single record with related data.

**Example**:
```typescript
const post = await postModel.findWith(
  { id: 123 },
  { author: { model: "User", foreignKey: "author_id" } }
);
```

**Expected Result**: Single post with author attached.

---

### `all()` (BaseModel)

**Purpose**: Get all records from the table.

**Under the Hood**: Uses Drizzle's select if available, otherwise delegates to FluentQuery.

**Example**:
```typescript
const allUsers = await userModel.all();
```

**Expected Result**: Array of all records in the table.

---

### `count()` (BaseModel)

**Purpose**: Count all records or filtered records.

**Example**:
```typescript
const total = await userModel.count();
const admins = await userModel.where({ role: "admin" }).count();
```

**Expected Result**: Number as integer.

---

### `pluck(columns, conditions?, options?)`

**Purpose**: Get values of specific columns.

**Under the Hood**: Delegates to FluentQuery's pluck for single column, or select for multiple. The conditions parameter supports all `where()` operators including `in` and `nin`.

**Example**:
```typescript
// Basic - single column
const emails = await userModel.pluck("email");

// Multiple columns
const namesAndEmails = await userModel.pluck(["name", "email"], { active: true });

// With IN operator - get emails for specific roles
const adminEmails = await userModel.pluck("email", { role: { in: ["admin", "editor"] } });

// With NOT IN operator - exclude specific users
const userIds = await userModel.pluck("id", { id: { nin: [1, 2, 3] } });

// With options - order, limit, offset
const recentEmails = await userModel.pluck("email", { active: true }, {
  orderBy: { column: "created_at", direction: "DESC" },
  limit: 100
});
```

**Expected Result**: Array of values or array of objects.

---

## Relationship Methods

Define relationships in your model constructor:

```typescript
class Post extends BaseModel<typeof posts> {
  relationships = {
    author: { type: "belongs_to", model: "User", foreignKey: "author_id" },
    comments: { type: "has_many", model: "Comment", foreignKey: "post_id" },
    tags: { type: "has_many", model: "Tag", foreignKey: "post_id" },
  };
}
```

### `belongsTo(name, options)`

**Purpose**: Define a "this belongs to that" relationship.

**Example**:
```typescript
class Comment extends BaseModel<typeof comments> {
  constructor(...) {
    super(...arguments);
    this.belongsTo("post", { model: "Post", foreignKey: "post_id" });
  }
}
```

---

### `hasMany(name, options)`

**Purpose**: Define a "this has many that" relationship.

---

### `hasOne(name, options)`

**Purpose**: Define a "this has one that" relationship (similar to has_many but returns single record).

---

### `hasAndBelongsToMany(name, options)`

**Purpose**: Many-to-many relationship via junction table.

---

### Relationship Traversal Methods

**`listChildIds(id)`** - Get IDs of records where parent_id = id  
**`listParentIds(id)`** - Get IDs of parent records (for belongs_to relations)  
**`listSiblingIds(id)`** - Get IDs of records sharing the same parent  
**`listAncestorIds(id)`** - Traverse up the hierarchy  
**`listDescendantIds(id)`** - Traverse down the hierarchy  
**`listRelatedIds(id, relation)`** - Get IDs for a specific relation type

---

## Lifecycle Methods (Soft Delete & Status)

### Query Scopes

```typescript
// Filter by status
userModel.trashed()      // trashed_at IS NOT NULL
userModel.notTrashed()   // trashed_at IS NULL
userModel.hidden()       // hidden_at IS NOT NULL
userModel.notHidden()    // hidden_at IS NULL
userModel.flagged()      // flagged_at IS NOT NULL
userModel.notFlagged()   // flagged_at IS NULL
userModel.retired()      // retired_at IS NOT NULL
userModel.notRetired()   // retired_at IS NULL
userModel.active()       // trashed_at AND hidden_at AND retired_at are NULL
```

### Mutations

```typescript
await userModel.trash(123)    // Sets trashed_at = now
await userModel.restore(123)  // Sets trashed_at = null
await userModel.hide(123)     // Sets hidden_at = now
await userModel.unhide(123)   // Sets hidden_at = null
await userModel.flag(123)     // Sets flagged_at = now
await userModel.unflag(123)   // Sets flagged_at = null
await userModel.retire(123)   // Sets retired_at = now
await userModel.unretire(123) // Sets retired_at = null
await userModel.purge(123)    // Hard delete
```

---

## Callback System

Define lifecycle hooks in your model:

```typescript
class User extends BaseModel<typeof users> {
  constructor(...) {
    super(...arguments);
    
    this.beforeValidation((data) => {
      if (!data.email) throw new Error("Email required");
    });
    
    this.afterCreate((record) => {
      console.log(`Created user ${record.id}`);
    });
  }
}
```

**Available Callbacks**:
- `beforeValidation` / `afterValidation`
- `beforeSave` / `afterSave`
- `beforeCreate` / `afterCreate`
- `beforeUpdate` / `afterUpdate`
- `beforeDestroy` / `afterDestroy`
- `afterCommit` / `afterRollback`

**Callback Options**:
```typescript
this.beforeUpdate(function, { on: "create" });  // Only on create
this.beforeValidation(fn, { if: "isAdmin" });  // Conditional
this.beforeDelete(fn, { unless: "isProtected" });
```

---

## Tips & Tricks

### 1. Use `query()` for Complex Queries

```typescript
const result = await userModel
  .query()
  .select("id", "email", "name")
  .where({ active: true, role: "admin" })
  .orderBy("created_at", "DESC")
  .limit(10)
  .with("profile")  // Eager load profile
  .all();
```

### 2. Debug SQL with `toSql()`

```typescript
const sql = userModel
  .query()
  .where({ role: "admin" })
  .toSql();
// "SELECT * FROM users WHERE role = 'admin'"
```

### 3. Handle Database Errors

The `queryExec` method automatically converts common database errors to typed exceptions:
- `ConflictError` - Unique constraint violation
- `ConstraintError` - Foreign key, NOT NULL, CHECK violations
- `BadRequestError` - Datatype mismatches

### 4. Use Transactions

```typescript
await userModel.transaction(async (model) => {
  await model.update(userId, { points: 0 });
  await model.create({ userId, action: "reset", points: 0 });
});
```

### 5. Batch Operations with `pluck`

```typescript
// Get all user IDs for a role, then batch query
const userIds = await userModel.pluck("id", { role: "vip" });
const profiles = await profileModel.where({ user_id: { in: userIds } }).all();
```

### 6. Relationship Loading Strategies

| Method | Use When |
|--------|----------|
| `with()` | General use - auto-selects best approach |
| `withJoins()` | Need WHERE on related tables, small datasets |
| `withSeparateQueries()` | Large datasets, has_many relations |

### 7. Custom Dialect Support

```typescript
const query = new FluentQuery(db, table, logger, "postgres");
```

Supports: `sqlite` (default), `postgres`, `mysql`.

### 8. UUID Generation

If your table doesn't use auto-increment IDs, the model automatically generates UUIDs:

```typescript
// In _beforeCreate callback
if (!(data as any).id && !hasAutoIncrement) {
  (data as any).id = crypto.randomUUID();
}
```

### 9. Soft Deletes Are Just Filters

The lifecycle methods (`trash`, `hide`, `flag`, etc.) are just convenient wrappers around `update()`. You can achieve the same with:

```typescript
await userModel.update(123, { trashed_at: new Date().toISOString() });
```

### 10. Combine with Drizzle for Advanced Queries

For complex queries, fall back to Drizzle directly:

```typescript
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.role, "admin"))
  .limit(10);
```

---

### Appendix: Common Patterns

Here are common patterns that combine these methods:

```typescript
// 1. Find by multiple IDs (batch fetch)
const users = await userModel.findAllBy({ id: { in: [1, 2, 3] } });

// 2. Find first by condition, get single column
const firstAdminEmail = await userModel.where({ role: "admin" }).first().then(u => u?.email);

// 3. Get all IDs for a list of values (for batch operations)
const userIds = await userModel.pluck("id", { role: { in: ["vip", "premium"] } });

// 4. Find by IDs with relations + pagination
const posts = await postModel.findAllWith(
  { id: { in: [1, 2, 3] } },
  { author: { model: "User", foreignKey: "author_id" } },
  { orderBy: { column: "created_at", direction: "DESC" }, limit: 20, offset: 0 }
);
// Returns: Array of posts with id 1, 2, or 3, each with an `author` array containing matching User records

// 5. Find with relations + pagination
const posts2 = await postModel.findAllWith(
  { published: true },
  { author: { model: "User", foreignKey: "author_id" } },
  { orderBy: { column: "created_at", direction: "DESC" }, limit: 20, offset: 0 }
);

// 6. Count by condition
const adminCount = await userModel.where({ role: "admin" }).count();

// 7. Find by unique field (slug, email, etc)
const user = await userModel.findBy({ email: "john@example.com" });

// 8. Pluck with ordering
const recentNames = await userModel.pluck("name", { active: true }, { 
  orderBy: { column: "created_at", direction: "DESC" }, 
  limit: 10 
});

// 9. Find single with relations
const postWithAuthor = await postModel.findWith({ id: 123 }, { author: { model: "User", foreignKey: "author_id" } });

// 10. Chain: where -> with -> select -> orderBy -> limit -> all
const authors = await postModel
  .where({ published: true })
  .with("author")
  .select("id", "title", "author_id")
  .orderBy("created_at", "DESC")
  .limit(10)
  .all();
```

## Error Reference

| Error Type | Cause | Solution |
|------------|-------|----------|
| `ConflictError` | Duplicate unique value | Check for existing records |
| `ConstraintError` (FOREIGN_KEY) | Referenced record doesn't exist | Insert parent record first |
| `ConstraintError` (NOT_NULL) | Required field is null | Provide value |
| `ConstraintError` (CHECK) | Value violates check constraint | Fix value |
| `BadRequestError` | Type mismatch | Check data types |

---

## File Structure

```
packages/models/
├── src/
│   └── index.ts        # All code (FluentQuery, BaseModel, types)
├── dist/               # Compiled output
├── package.json
└── README.md
```