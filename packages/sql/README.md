# @nowarelabs/sql

A lightweight, dialect-agnostic SQL query builder for TypeScript/JavaScript. Build SQL queries programmatically with support for SQLite, PostgreSQL, and MySQL dialects.

## Features

- **Dialect Support**: SQLite (default), PostgreSQL, MySQL
- **TypeScript First**: Full type safety with minimal dependencies
- **Composable API**: Build complex queries from simple parts
- **Extensible**: Custom dialect strategies and SQL parts
- **Lifecycle Hooks**: Before/after hooks for query execution
- **Fluent Interface**: Chainable methods for readable query building
- **SQL Injection Safe**: Proper escaping of identifiers and literals

## Installation

```bash
# Using npm
npm install @nowarelabs/sql

# Using yarn
yarn add @nowarelabs/sql

# Using pnpm
pnpm add @nowarelabs/sql
```

## Quick Start

```typescript
import { sql } from "@nowarelabs/sql";

// Simple SELECT query
const query = sql
  .select("id", "name", "email")
  .from("users")
  .where(sql.composite(sql.id("status"), sql.op(" = "), sql.val("active")));

console.log(query.toSql());
// Output: SELECT"id", "name", "email"FROM"users"WHERE"status" = 'active'

// With explicit dialect strategy
import { PostgresStrategy } from "@nowarelabs/sql";
const pgQuery = query.toSql(new PostgresStrategy());
// Output: SELECT "id", "name", "email" FROM "users" WHERE "status" = 'active'
```

## API Reference

### Dialect Strategies

The package includes three built-in dialect strategies:

- `SqliteStrategy` (default)
- `PostgresStrategy`
- `MysqlStrategy`

You can also create custom dialect strategies by extending `BaseDialectStrategy`.

### SQL Parts

All SQL components are represented as `SqlPart` instances:

#### Primitives

- `sql.id(name)` - Creates an Identifier (properly quoted for the dialect)
- `sql.val(value)` - Creates a Literal (properly escaped for the dialect)
- `sql.key(text)` - Creates a Keyword (uppercased)
- `sql.raw(sql)` - Creates a Raw SQL part (verbatim)
- `sql.op(text)` - Creates a Punctuation part
- `sql.nl()` - Creates a NewLine part
- `sql.indent(level)` - Creates an Indent part (default 2 spaces)

#### Helpers

- `sql.composite(...parts)` - Creates a Composite part (concatenates parts)
- `sql.join(parts, separator)` - Joins parts with a separator
- `sql.default(value)` - Creates a DEFAULT clause

#### Specialized

- `sql.primaryKey()` - Creates a PRIMARY KEY keyword
- `sql.currentTimestamp()` - Creates a CURRENT_TIMESTAMP keyword
- `sql.dataType(typeName)` - Creates a DataType (uppercased)

#### JSON Helpers (SQLite/PostgreSQL/MySQL)

- `sql.json.extract(jsonColumn, path)` - JSON_EXTRACT function
- `sql.json.set(jsonColumn, path, value)` - JSON_SET function
- `sql.json.valid(jsonColumn)` - JSON_VALID function

#### Generated Columns

- `sql.generated(expression, stored = false)` - GENERATED ALWAYS AS clause

#### Common Table Expressions (CTE)

- `sql.with(recursive = false).as(name, query)` - WITH [RECURSIVE] name AS (query)

#### Conflict Resolution

- `sql.onConflict(target).doNothing()` - ON CONFLICT ... DO NOTHING
- `sql.onConflict(target).doUpdate(set)` - ON CONFLICT ... DO UPDATE SET ...

### QueryBuilder

Fluent interface for building SQL queries:

```typescript
import { QueryBuilder } from "@nowarelabs/sql";

// Create a builder instance
const builder = new QueryBuilder(request, env, ctx);

// SELECT
builder.select("id", "name").from("users").where(sql.id("age").op(">").sql.val(18));

// INSERT
builder
  .insertInto("users", ["name", "email"])
  .values("Alice", "alice@example.com")
  .raw(sql.onConflict("email").doNothing());

// Raw SQL
builder.rawSql("SELECT * FROM logs WHERE created_at > ?");
```

### BaseSql

Extensible base class for SQL services with lifecycle hooks:

```typescript
import { BaseSql } from "@nowarelabs/sql";

class UserService extends BaseSql {
  async findActive() {
    await this.runBeforeHooks("findActive");
    const query = this.select("*").from("users").where(sql.id("active"), "=", true);
    const result = await this.runAfterHooks("findActive", query);
    return result;
  }
}

// Register hooks
UserService.addBeforeHook((method) => {
  console.log(`About to execute: ${method}`);
});

UserService.addAfterHook((method, query) => {
  console.log(`Executed ${method}:`, query.toSql());
});
```

## Development

```bash
# Install dependencies
vp install

# Run unit tests
vp test

# Build the library
vp pack

# Lint (if configured)
vp lint

# Type check (if configured)
vp typecheck
```

## License

MIT

## References

- [SQLite Documentation](https://www.sqlite.org/lang.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [SQL Injection Prevention](https://owasp.org/www-community/attacks/SQL_Injection)
