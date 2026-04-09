# nomo/sql

The core SQL construction engine for the nomo ecosystem. It provides a declarative, type-safe DSL for building complex SQL statements that work seamlessly across SQLite (D1/Durable Objects), Postgres, and MySQL.

## Installation

```bash
pnpm add nomo/sql
```

---

## 1. Core Architecture

The package is built on three main pillars:

1.  **`SqlPart`**: The atomic unit of SQL. Every keyword, identifier, value, or operator is represented by a specific `SqlPart` subclass.
2.  **`Statement`**: A collection of `SqlPart` objects that can be composed and rendered into a final SQL string.
3.  **`DialectStrategy`**: A set of rules that define how `SqlPart` units are rendered for a specific database (e.g., how to quote identifiers or format values).

---

## 2. The `sql` Tag & Helpers

The `sql` object provides a rich set of helpers for constructing SQL components.

### 2.1. Basic Helpers

- **`sql.key(str)`**: A SQL keyword (e.g., `SELECT`, `FROM`).
- **`sql.id(name)`**: A database identifier (table or column name). Automatically escaped.
- **`sql.val(value)`**: A literal value. Automatically escaped and quoted based on type.
- **`sql.op(str)`**: A SQL operator (e.g., `=`, `>`, `JOIN`).
- **`sql.raw(str)`**: Unescaped raw SQL. Use with caution.

### 2.2. Composition Helpers

- **`sql.statement(parts[])`**: Creates a new `Statement` container.
- **`sql.composite(...parts)`**: Groups multiple parts into a single unit.
- **`sql.join(parts[], separator)`**: Joins an array of parts with a specific operator or string.
- **`sql.nl()`**: Injects a newline for pretty-printing.

---

## 3. Building Statements

Statements are chainable and composable.

```typescript
import { sql, getDialectStrategy } from "nomo/sql";

const stmt = sql
  .statement()
  .append(sql.key("SELECT "), sql.id("name"))
  .append(sql.nl(), sql.key("FROM "), sql.id("users"))
  .append(sql.nl(), sql.key("WHERE "), sql.id("id"), sql.op(" = "), sql.val(1));

const strategy = getDialectStrategy("sqlite");
const res = stmt.toSql(strategy);

if (res.success) {
  console.log(res.data.value);
  // SELECT "name"
  // FROM "users"
  // WHERE "id" = 1
}
```

---

## 4. Multi-Dialect Support

`nomo/sql` handles the nuances between different SQL engines automatically through strategies.

```typescript
import { getDialectStrategy } from "nomo/sql";

const sqlite = getDialectStrategy("sqlite");
const postgres = getDialectStrategy("postgres");

// Identifiers and values will be quoted/escaped according to the selected strategy.
```

---

## 5. Integration

This package serves as the foundation for:

- **`nomo/migrations`**: Driving the database evolution DSL.
- **`nomo/models`**: Powering the `FluentQuery` Active Record-style DSL.

By sharing this core, nomo ensures that SQL generation is consistent, secure, and easily extensible.

---

## License

MIT
