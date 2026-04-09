# nomo/migrations

A production-ready, Rails-inspired migration DSL and runner for Cloudflare D1 and Durable Objects SQL.

Migrations are a feature of `nomo/migrations` that allow you to evolve your database schema over time. Rather than write schema modifications in pure SQL, migrations allow you to use a TypeScript Domain Specific Language (DSL) to describe changes to your tables.

After reading this guide, you will know:

- How to generate and structure migration files.
- Which methods the API provides to manipulate your database.
- How to manage associations, indexes, and primary keys.
- How migrations integrate with Drizzle ORM and Cloudflare Wrangler.
- How to run, rollback, and reset your database.

---

## Installation

Install the package via pnpm:

```bash
pnpm add nomo/migrations
```

Configure your `package.json` with the following scripts to enable the migration workflow:

```json
"scripts": {
  "db:migrate": "tsx ../packages/migrations/src/cli.ts migrate",
  "db:migrate:generate": "tsx ../packages/migrations/src/cli.ts generate",
  "db:migrate:sync": "tsx ../packages/migrations/src/cli.ts sync",
  "db:migrate:rollback": "tsx ../packages/migrations/src/cli.ts rollback",
  "db:migrate:status": "tsx ../packages/migrations/src/cli.ts status",
  "db:migrate:reset": "tsx ../packages/migrations/src/cli.ts reset"
}
```

---

## 1. Migration Overview

Migrations are a convenient way to evolve your database schema over time in a reproducible way. They use a TypeScript DSL so that you don't have to write SQL by hand, allowing your schema and changes to be database-independent.

You can think of each migration as being a new 'version' of the database. A schema starts off with nothing in it, and each migration modifies it to add or remove tables, columns, or indexes. The runner knows how to update your schema along this timeline, bringing it from whatever point it is in history to the latest version.

### The Capture & Sync Workflow

Unlike traditional migration tools, `nomo/migrations` is tightly integrated with the `nomo` ecosystem:

1.  **Define**: You write a migration using the DSL.
2.  **Sync**: Running `db:migrate:sync` "captures" your schema changes.
3.  **Generate**: It automatically produces a Drizzle ORM schema (`src/db/schema.ts`) matching your migrations.
4.  **Wrangler**: For Durable Objects, it automatically updates `wrangler.jsonc` with the correct migration tags.

---

## 2. Generating Migration Files

Migrations are stored as files in the `src/db/migrations` directory.

### Generating a Migration

Use the CLI to generate a new migration. The generator is smart: if you use patterns like `create_table_name` or `add_column_to_table`, it can help scaffold the content.

```bash
# Basic generation
pnpm db:migrate:generate create_products

# Detailed generation (conceptual)
pnpm db:migrate:generate add_part_number_to_products
```

---

## 3. Updating Your Schema

### 3.1. Creating a Table

```typescript
// db/migrations/20260205101010_create_products.ts
this.createTable("products", (t) => {
  t.string("name", { notNull: true });
  t.text("description");
  t.integer("price_cents", { default: 0 });
  t.boolean("is_active", { default: true });
  t.timestamps();
});
```

#### Custom Primary Keys and Options

```typescript
// Table without an 'id' column
this.createTable("settings", { id: false }, (t) => {
  t.string("key", { primaryKey: true });
  t.json("value");
});

// Composite-like primary key (requires manual SQL for full constraint,
// but DSL supports marking individual columns)
this.createTable("inventory", (t) => {
  t.integer("warehouse_id", { primaryKey: true });
  t.integer("product_id", { primaryKey: true });
  t.integer("quantity");
});
```

### 3.2. Column Types

The `TableBuilder` provides semantic methods for every SQLite-supported type. Each method accepts an optional `ColumnOptions` object.

#### Primary Keys & IDs

- **`t.id(opts)`**: The standard primary key.
  ```typescript
  t.id(); // INTEGER PRIMARY KEY AUTOINCREMENT
  t.id({ name: "custom_id" }); // Custom name
  ```

#### Text & Strings

- **`t.string(name, opts)`**: For labels, titles, and short text.
  ```typescript
  t.string("first_name", { notNull: true, default: "Guest" });
  t.string("slug", { unique: true, index: true });
  ```
- **`t.text(name, opts)`**: For long-form content.
  ```typescript
  t.text("biography", { comment: "User profile summary" });
  t.text("raw_content");
  ```

#### Numbers

- **`t.integer(name, opts)`**: For counts and IDs.
  ```typescript
  t.integer("retry_count", { default: 0 });
  t.integer("external_id", { index: true });
  ```
- **`t.bigint(name, opts)`**: For very large numbers.
  ```typescript
  t.bigint("total_atoms");
  ```
- **`t.decimal(name, opts)`**: For precise financial or scientific data.
  ```typescript
  t.decimal("price", { precision: 10, scale: 2 });
  t.decimal("latitude", { precision: 9, scale: 6 });
  ```

#### Logical & Specialized

- **`t.boolean(name, opts)`**: Stores true/false.
  ```typescript
  t.boolean("is_admin", { default: false });
  t.boolean("email_verified");
  ```
- **`t.uuid(name, opts)`**: Stores standard UUIDs.
  ```typescript
  t.uuid("public_id", {
    unique: true,
    default: sql`lower(hex(randomblob(16)))`,
  });
  ```

#### Dates & Times

- **`t.timestamp(name, opts)`**: ISO8601 UTC timestamp.
  ```typescript
  t.timestamp("deleted_at");
  t.timestamp("notified_at", { default: sql`CURRENT_TIMESTAMP` });
  ```
- **`t.datetime(name, opts)`**: Similar to timestamp, semantic alias.
  ```typescript
  t.datetime("occured_at");
  ```
- **`t.timestamps()`**: Convenience for record tracking.
  ```typescript
  t.timestamps(); // adds created_at & updated_at with automatic defaults
  ```

#### Complex Data

- **`t.json(name, opts)`**: Structured JSON data.
  ```typescript
  t.json("preferences", { default: '{"theme": "dark"}' });
  ```
- **`t.jsonb(name, opts)`**: Semantic alias for JSON (useful for ecosystem cross-compatibility).
  ```typescript
  t.jsonb("raw_payload");
  ```

### 3.3. Column Modifiers

Column modifiers allow you to add constraints, indexes, and metadata to your columns. They are passed as an options object to any column definition method.

#### Constraints

- **`notNull: true`**: Ensures the column cannot contain `NULL`.

  ```typescript
  t.string("username", { notNull: true });
  ```

- **`unique: true`**: Adds a unique constraint (and an implicit index).

  ```typescript
  t.string("email", { unique: true });
  ```

- **`primaryKey: true`**: Marks the column as part of the primary key.
  ```typescript
  t.string("api_key", { primaryKey: true });
  ```

#### Defaults & SQL Expressions

- **`default: value`**: Sets a static default value.
  ```typescript
  t.integer("retry_count", { default: 0 });
  t.string("status", { default: "draft" });
  ```
- **`default: sql`Tag**: Sets a dynamic default using raw SQL.
  ```typescript
  t.timestamp("created_at", { default: sql`CURRENT_TIMESTAMP` });
  t.uuid("request_id", { default: sql`lower(hex(randomblob(16)))` });
  ```

#### Indexes & Naming

- **`index: true`**: Shorthand for creating a single-column index.

  ```typescript
  t.string("slug", { index: true });
  ```

- **`name: string`**: Allows you to use a different name for the column in the database than in the DSL.
  ```typescript
  t.string("userHandle", { name: "user_handle" });
  ```

#### Precision & Scale (for Decimals)

- **`precision` & `scale`**: Control the exactness of the `decimal` type.
  ```typescript
  t.decimal("interest_rate", { precision: 5, scale: 4 }); // Allows 0.1234
  ```

#### Metadata & Comments

- **`comment: string`**: Intended for documentation within your code (not all dialects support this in the DB itself).
  ```typescript
  t.integer("raw_status", { comment: "0: internal, 1: external, 2: guest" });
  ```

#### Combining Modifiers

You can mix and match most modifiers for precise control:

```typescript
t.string("subscription_id", {
  notNull: true,
  unique: true,
  index: true,
  default: "trial",
});
```

### 3.4. Associations (References) Deep Dive

The `references` method is a high-level helper for creating foreign keys and relational structures.

#### Basic References (Belongs To)

- **Simple Reference**: Creates a `{name}_id` integer column.
  ```typescript
  t.references("user"); // user_id
  ```
- **With Foreign Key**: Adds the actual database-level `FOREIGN KEY` constraint.
  ```typescript
  t.references("user", { foreignKey: true });
  ```
- **Custom Options**: Control nullability, defaults, and constraints on the reference column.
  ```typescript
  t.references("project", {
    foreignKey: true,
    onDelete: "cascade",
    notNull: true,
  });
  ```

#### Custom Foreign Key Patterns

- **Custom Column Name**: Use a specific name for the joining column.
  ```typescript
  t.references("user", { columnName: "author_id", foreignKey: true });
  ```
- **Custom Target Table**: Reference a table with a different name from the column.
  ```typescript
  t.references("author", { foreignKey: "users" }); // author_id -> users(id)
  ```

#### Self-Referencing

Useful for hierarchies like parents/children.

```typescript
this.createTable("categories", (t) => {
  t.id();
  t.string("name");
  t.references("category", {
    columnName: "parent_id",
    foreignKey: true,
    onDelete: "set null",
  });
});
```

#### Polymorphic Associations

A single reference that can belong to multiple Different tables.

```typescript
this.createTable("comments", (t) => {
  t.id();
  t.text("body");

  // Creates record_id (integer) and record_type (string)
  t.references("record", { polymorphic: true, index: true });
});
```

#### Many-to-Many Join Tables

The `createJoinTable` helper scaffolds an optimized junction table.

```typescript
// Creates 'categories_products' table
this.createJoinTable("products", "categories");

// Customizable Join Table
this.createJoinTable("users", "teams", {
  tableName: "team_memberships",
  columnNames: ["member_id", "membership_id"],
  columnOptions: { notNull: true },
});
```

### 3.5. Modifying Existing Tables Deep Dive

The `Migration` class provides a suite of methods for evolving existing tables. These should generally be used within the `change()` method.

#### Table Operations

- **`renameTable(oldName, newName)`**:
  ```typescript
  this.renameTable("users", "accounts");
  ```

#### Column Operations

- **`addColumn(table, name, type, opts)`**:
  ```typescript
  this.addColumn("users", "bio", "text");
  this.addColumn("posts", "status", "string", {
    default: "draft",
    index: true,
  });
  ```
- **`removeColumn(table, name)`**:
  ```typescript
  this.removeColumn("users", "middle_name");
  ```
- **`renameColumn(table, oldName, newName)`**:
  ```typescript
  this.renameColumn("users", "pword", "password_digest");
  ```

#### Changing Column Properties

> [!NOTE]
> SQLite has limited support for modifying columns. The runner handles this by recreating the table when necessary.

- **`changeColumn(table, name, type, opts)`**: Completely redefines a column.
  ```typescript
  this.changeColumn("users", "age", "integer", { default: 0 });
  ```
- **`changeColumnDefault(table, name, value)`**:
  ```typescript
  this.changeColumnDefault("users", "active", true);
  ```
- **`changeColumnNull(table, name, nullable)`**:
  ```typescript
  this.changeColumnNull("users", "email", false); // Sets NOT NULL
  ```

#### Indexes

- **`addIndex(table, columns, opts)`**:
  ```typescript
  this.addIndex("users", "email", { unique: true });
  this.addIndex("posts", ["author_id", "created_at"]); // Multi-column
  ```
- **`removeIndex(table, columns, opts)`**:
  ```typescript
  this.removeIndex("users", "email");
  ```

#### Foreign Keys

- **`addForeignKey(table, toTable, opts)`**:
  ```typescript
  this.addForeignKey("posts", "users", {
    column: "author_id",
    onDelete: "cascade",
  });
  ```
- **`removeForeignKey(table, { name | column })`**:
  ```typescript
  this.removeForeignKey("posts", { column: "author_id" });
  ```

---

## 4. Reversing Migrations

### 4.1. Automatic Reversibility

The `change()` method is the preferred way to write migrations. The runner "understands" how to reverse the following operations automatically:

- `createTable` -> `dropTable`
- `addColumn` -> `removeColumn`
- `removeColumn` -> `addColumn` (requires types/options to be present)
- `renameColumn` -> `renameColumn` (swaps names)
- `renameTable` -> `renameTable` (swaps names)
- `addIndex` -> `removeIndex`
- `addForeignKey` -> `removeForeignKey`
- `createJoinTable` -> `dropTable`

#### Example: Automatic Reversal

```typescript
async change() {
  this.createTable('tags', (t) => {
    t.string('name', { index: true });
  });

  this.addColumn('users', 'tag_count', 'integer', { default: 0 });
}
// When rolled back:
// 1. Column 'tag_count' is removed from 'users'.
// 2. Table 'tags' is dropped.
```

### 4.2. Using `reversible`

When an operation isn't automatically reversible—or requires custom logic—use the `reversible()` block. This allows you to define distinct paths for the forward (`up`) and backward (`down`) directions.

#### Custom SQL Pattern

```typescript
async change() {
  await this.reversible(({ up, down }) => {
    // Create an FTS5 virtual table for search
    up(() => this.execute("CREATE VIRTUAL TABLE posts_search USING fts5(title, content)"));
    // Drop it on rollback
    down(() => this.execute("DROP TABLE posts_search"));
  });
}
```

#### Complex Data Migration Pattern

Sometimes you need to transform data while changing schema.

```typescript
async change() {
  this.addColumn('users', 'full_name', 'string');

  await this.reversible(({ up, down }) => {
    up(async () => {
      // Logic to merge first_name and last_name into full_name
      await this.execute("UPDATE users SET full_name = first_name || ' ' || last_name");
    });
    // On rollback, we just drop the column (automatic if change() is used)
    // but here we might want to ensure data isn't lost if we were splitting it
    down(() => {});
  });
}
```

### 4.3. Explicit `up` and `down`

If a migration is too complex for `change()`, you can define `up()` and `down()` methods explicitly.

```typescript
export default class ComplexLogic extends Migration {
  async up() {
    await this.createTable("legacy_data", (t) => {
      t.id();
      t.json("blob");
    });
    // custom complex logic...
  }

  async down() {
    // exact reverse operations...
    await this.dropTable("legacy_data");
  }
}
```

### 4.4. Irreversible Migrations

Some migrations, like dropping a table containing critical data, cannot be reversed safely. You can raise an error in the `down` direction to prevent accidental data loss.

```typescript
async change() {
  this.dropTable('temporary_logs');

  await this.reversible(({ down }) => {
    down(() => {
      throw new Error("This migration drops 'temporary_logs' and cannot be reversed.");
    });
  });
}
```

---

## 5. Running Migrations

The CLI provides several commands to manage your database lifecycle. These are typically mapped to `npm scripts` in your `package.json`.

### 5.1. `migrate`

Runs all pending migrations.

```bash
# Apply all pending migrations to the latest version
pnpm db:migrate

# Migrate up to a specific version (targeted forward)
pnpm db:migrate 20260205123456
```

### 5.2. `rollback`

Reverts the last applied migrations.

```bash
# Revert exactly one migration
pnpm db:migrate:rollback

# Revert multiple versions at once
pnpm db:migrate:rollback 3
```

### 5.3. `status`

Displays the current state of your database relative to your migration files.

```bash
pnpm db:migrate:status
```

Output example:

```text
Migration Status:
Status   Migration ID
-----------------------------------------
  up     20260205101010 (CreateProducts)
  up     20260205111111 (AddPriceToProducts)
 down    20260205123456 (CreateCategories)
```

### 5.4. `reset`

Drops all tables and re-runs all migrations from scratch. **This is destructive** and intended for development environments.

```bash
pnpm db:migrate:reset
```

---

## 6. Cloudflare Specifics

`nomo/migrations` is built for Cloudflare's unique database landscape, supporting both D1 (global) and Durable Objects SQL (local/distributed).

### 6.1. D1 vs. Durable Objects

You control where a table lives using the `location` option in `createTable`.

- **D1 (Default)**: Use `location: 'd1'`. Suitable for global application state.
- **Durable Objects**: Use `location: 'do'`. Requires a `durableObject` class name.

### 6.2. Durable Object Example

When migrating a Durable Object, the runner and `sync` command work together to manage Wrangler migration tags.

```typescript
// db/migrations/20260205202020_setup_counters.ts
export default class SetupCounters extends Migration {
  async change() {
    this.createTable(
      "counters",
      {
        location: "do",
        durableObject: "CounterDO",
      },
      (t) => {
        t.id();
        t.string("type", { index: true });
        t.integer("value", { default: 0 });
      },
    );
  }
}
```

### 6.3. The `sync` Command

The `db:migrate:sync` command is a vital part of the Cloudflare workflow:

1.  **Tag Generation**: It generates unique `tag` strings for Durable Object migrations.
2.  **Wrangler Updates**: It automatically updates your `wrangler.jsonc` file with the correct `migrations` blocks.
3.  **Multi-DO Support**: If you have multiple DO classes, `sync` ensures each one receives the correct schema updates.

---

## 7. Schema Tracking & Integration

### 7.1. The `schema_migrations` Table

The runner automatically creates and maintains a `schema_migrations` table in your D1 and Durable Object instances. It contains a single column:

- `version`: The timestamp (string) of applied migrations.

This table is the "database-side" source of truth that prevents duplicate runs.

### 7.2. Automated Drizzle Schema Generation

Running `db:migrate:sync` does more than just update Wrangler. It "captures" your entire migration history and generates a matching Drizzle ORM schema:

```typescript
// src/db/schema.ts (Generated automatically)
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  price_cents: integer("price_cents").default(0),
});
```

### 7.3. Why "Capture & Sync"?

By following this workflow, your TypeScript types (via Drizzle) are always 100% in sync with your migrations. You never have to manually edit `schema.ts`; simply write a migration, run `sync`, and your application code is updated.

---

## 8. Best Practices

### 8.1. Atomic Migrations

Each migration should ideally perform one logical change (e.g., creating a table and its associated indexes). This makes rollbacks cleaner and easier to reason about.

### 8.2. Naming Conventions

Use descriptive names for your migrations:

- `create_users`
- `add_email_index_to_users`
- `rename_bio_to_biography`

### 8.3. Data Migrations

When moving data between columns, use the `reversible` pattern shown in Section 4.2. Always test your rollbacks to ensure you don't lose data in production.

---

## 9. Troubleshooting

### CLI: "Database Connection Required"

Commands like `migrate` and `rollback` require a connection to D1 or a local Durable Object environment. Ensure your environment variables or Miniflare setup is active.

### SQLite Limits

Remember that SQLite has limited `ALTER TABLE` support. `nomo/migrations` handles this by recreating tables for complex changes (like `changeColumn`), but be aware of this for very large tables as it may take time.

### Sync Failures

If `db:migrate:sync` fails, check that your migrations are valid TypeScript and that you haven't introduced circular dependencies in your `createTable` callbacks.

---

## License

MIT
