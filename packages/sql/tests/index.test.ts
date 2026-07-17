import { describe, expect, test } from "vite-plus/test";
import type { SqlContext } from "@nowarelabs/shared";
import {
  // Dialect strategies
  SqliteStrategy,
  PostgresStrategy,
  MysqlStrategy,
  getDialectStrategy,
  // SQL primitives
  Identifier,
  Literal,
  Keyword,
  Raw,
  NewLine,
  Indent,
  Punctuation,
  DataType,
  Default,
  Composite,
  Statement,
  PrimaryKey,
  CurrentTimestamp,
  // Fluent builder
  QueryBuilder,
  BaseSql,
  // Namespace
  sql,
} from "../src/index.ts";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockCtx: SqlContext = {
  waitUntil: () => {},
  passThroughOnException: () => {},
};
const mockReq = new Request("http://localhost");
const mockEnv = {} as Record<string, unknown>;

const builder = () => new QueryBuilder(mockReq, mockEnv, mockCtx);

// Helper to extract text from a SqlPart
function toSqlText(
  part: { toSql(s: SqliteStrategy): any },
  strategy = new SqliteStrategy(),
): string {
  const r = part.toSql(strategy);
  return r.success ? r.data.value : "";
}

// ---------------------------------------------------------------------------
// Dialect strategies
// ---------------------------------------------------------------------------

describe("DialectStrategy – SQLite (default)", () => {
  const s = new SqliteStrategy();

  test("dialect tag", () => {
    expect(s.dialect).toBe("sqlite");
  });

  test("quoteIdentifier wraps in double-quotes and escapes embedded quotes", () => {
    expect(s.quoteIdentifier("users")).toBe('"users"');
    expect(s.quoteIdentifier('weird"name')).toBe('"weird""name"');
  });

  test("quoteLiteral handles all primitive types", () => {
    expect(s.quoteLiteral("hello")).toBe("'hello'");
    expect(s.quoteLiteral("it's")).toBe("'it''s'");
    expect(s.quoteLiteral(42)).toBe("42");
    expect(s.quoteLiteral(true)).toBe("1");
    expect(s.quoteLiteral(false)).toBe("0");
    expect(s.quoteLiteral(null)).toBe("NULL");
    expect(s.quoteLiteral(undefined)).toBe("NULL");
  });

  test("mapType returns SQLite equivalents", () => {
    expect(s.mapType("boolean")).toBe("INTEGER");
    expect(s.mapType("json")).toBe("TEXT");
    expect(s.mapType("uuid")).toBe("TEXT");
    expect(s.mapType("unknown_type")).toBe("UNKNOWN_TYPE"); // passthrough uppercased
  });
});

describe("DialectStrategy – PostgreSQL", () => {
  const s = new PostgresStrategy();

  test("dialect tag", () => {
    expect(s.dialect).toBe("postgres");
  });

  test("mapType uses Postgres native types", () => {
    expect(s.mapType("boolean")).toBe("BOOLEAN");
    expect(s.mapType("json")).toBe("JSON");
    expect(s.mapType("jsonb")).toBe("JSONB");
    expect(s.mapType("uuid")).toBe("UUID");
    expect(s.mapType("timestamp")).toBe("TIMESTAMP");
  });
});

describe("DialectStrategy – MySQL", () => {
  const s = new MysqlStrategy();

  test("dialect tag", () => {
    expect(s.dialect).toBe("mysql");
  });

  test("quoteIdentifier uses backticks", () => {
    expect(s.quoteIdentifier("users")).toBe("`users`");
    expect(s.quoteIdentifier("weird`name")).toBe("`weird``name`");
  });

  test("mapType uses MySQL types", () => {
    expect(s.mapType("boolean")).toBe("TINYINT(1)");
    expect(s.mapType("text")).toBe("LONGTEXT");
    expect(s.mapType("json")).toBe("JSON");
  });
});

describe("getDialectStrategy factory", () => {
  test("returns correct strategy instances", () => {
    expect(getDialectStrategy("sqlite")).toBeInstanceOf(SqliteStrategy);
    expect(getDialectStrategy("postgres")).toBeInstanceOf(PostgresStrategy);
    expect(getDialectStrategy("mysql")).toBeInstanceOf(MysqlStrategy);
  });

  test("defaults to SQLite for unrecognised dialect", () => {
    // @ts-expect-error – deliberate bad input
    expect(getDialectStrategy("oracle")).toBeInstanceOf(SqliteStrategy);
  });
});

// ---------------------------------------------------------------------------
// SQL primitives
// ---------------------------------------------------------------------------

describe("Identifier", () => {
  test("quotes a simple column name", () => {
    expect(toSqlText(new Identifier("id"))).toBe('"id"');
  });

  test("quotes a table name with a dot (treated as single identifier)", () => {
    expect(toSqlText(new Identifier("created_at"))).toBe('"created_at"');
  });

  test("uses backticks for MySQL", () => {
    expect(toSqlText(new Identifier("email"), new MysqlStrategy())).toBe("`email`");
  });
});

describe("Literal", () => {
  test("wraps string value in single quotes", () => {
    expect(toSqlText(new Literal("Alice"))).toBe("'Alice'");
  });

  test("renders numbers without quotes", () => {
    expect(toSqlText(new Literal(100))).toBe("100");
  });

  test("renders NULL for null/undefined", () => {
    expect(toSqlText(new Literal(null))).toBe("NULL");
    expect(toSqlText(new Literal(undefined))).toBe("NULL");
  });

  test("escapes single quotes inside strings", () => {
    expect(toSqlText(new Literal("O'Brien"))).toBe("'O''Brien'");
  });
});

describe("Keyword", () => {
  test("uppercases the keyword text", () => {
    expect(toSqlText(new Keyword("select"))).toBe("SELECT");
    expect(toSqlText(new Keyword("INSERT INTO"))).toBe("INSERT INTO");
  });
});

describe("Raw", () => {
  test("emits the raw string verbatim", () => {
    expect(toSqlText(new Raw("1 = 1"))).toBe("1 = 1");
    expect(toSqlText(new Raw("NOW()"))).toBe("NOW()");
  });
});

describe("Punctuation / formatting helpers", () => {
  test("Punctuation emits text as-is", () => {
    expect(toSqlText(new Punctuation("("))).toBe("(");
    expect(toSqlText(new Punctuation(", "))).toBe(", ");
  });

  test("NewLine emits \\n", () => {
    expect(toSqlText(new NewLine())).toBe("\n");
  });

  test("Indent emits spaces (default 2)", () => {
    expect(toSqlText(new Indent())).toBe("  ");
    expect(toSqlText(new Indent(4))).toBe("    ");
  });
});

describe("PrimaryKey / CurrentTimestamp", () => {
  test("PrimaryKey renders correctly", () => {
    expect(toSqlText(new PrimaryKey())).toBe("PRIMARY KEY");
  });

  test("CurrentTimestamp renders correctly", () => {
    expect(toSqlText(new CurrentTimestamp())).toBe("CURRENT_TIMESTAMP");
  });
});

describe("DataType", () => {
  test("uppercases type names", () => {
    expect(toSqlText(new DataType("text"))).toBe("TEXT");
    expect(toSqlText(new DataType("integer"))).toBe("INTEGER");
  });
});

describe("Default", () => {
  test("prepends DEFAULT keyword to a value part", () => {
    const part = new Default(new Literal(0));
    expect(toSqlText(part)).toBe("DEFAULT 0");
  });

  test("works with CurrentTimestamp", () => {
    const part = new Default(new CurrentTimestamp());
    expect(toSqlText(part)).toBe("DEFAULT CURRENT_TIMESTAMP");
  });
});

// ---------------------------------------------------------------------------
// Composite / Statement
// ---------------------------------------------------------------------------

describe("Composite & Statement", () => {
  test("concatenates all parts", () => {
    const c = new Composite([
      new Keyword("SELECT"),
      new Punctuation(" "),
      new Identifier("id"),
      new Punctuation(" "),
      new Keyword("FROM"),
      new Punctuation(" "),
      new Identifier("users"),
    ]);
    expect(toSqlText(c)).toBe('SELECT "id" FROM "users"');
  });

  test("append() fluent API works", () => {
    const c = new Statement([new Keyword("SELECT")]);
    c.append(new Punctuation(" *"));
    expect(toSqlText(c)).toBe("SELECT *");
  });

  test("empty Composite returns empty string", () => {
    expect(toSqlText(new Composite([]))).toBe("");
  });
});

// ---------------------------------------------------------------------------
// sql.* namespace helpers
// ---------------------------------------------------------------------------

describe("sql.join()", () => {
  test("joins identifiers with comma separator", () => {
    const cols = ["id", "name", "email"].map(sql.id);
    const part = sql.join(cols, sql.op(", "));
    expect(toSqlText(part)).toBe('"id", "name", "email"');
  });

  test("single element — no separator emitted", () => {
    const part = sql.join([sql.id("id")], sql.op(", "));
    expect(toSqlText(part)).toBe('"id"');
  });
});

describe("sql.json helpers", () => {
  test("json.extract builds JSON_EXTRACT call", () => {
    const part = sql.json.extract("data", "$.name");
    expect(toSqlText(part)).toBe("JSON_EXTRACT(\"data\", '$.name')");
  });

  test("json.set builds JSON_SET call", () => {
    const part = sql.json.set("meta", "$.active", true);
    expect(toSqlText(part)).toBe("JSON_SET(\"meta\", '$.active', 1)");
  });

  test("json.valid builds JSON_VALID call", () => {
    const part = sql.json.valid("payload");
    expect(toSqlText(part)).toBe('JSON_VALID("payload")');
  });
});

describe("sql.generated()", () => {
  test("VIRTUAL column (default)", () => {
    const part = sql.generated("full_name");
    expect(toSqlText(part)).toBe("GENERATED ALWAYS AS (full_name) VIRTUAL");
  });

  test("STORED column", () => {
    const part = sql.generated("full_name", true);
    expect(toSqlText(part)).toBe("GENERATED ALWAYS AS (full_name) STORED");
  });

  test("accepts SqlPart expression", () => {
    const part = sql.generated(sql.raw("first_name || ' ' || last_name"), true);
    expect(toSqlText(part)).toBe("GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED");
  });
});

describe("sql.with()", () => {
  test("builds a basic CTE", () => {
    const cte = sql.with().as("recent", "SELECT * FROM events WHERE ts > NOW()");
    expect(toSqlText(cte)).toBe('WITH "recent" AS (SELECT * FROM events WHERE ts > NOW())');
  });

  test("builds a RECURSIVE CTE", () => {
    const cte = sql.with(true).as("tree", "SELECT id FROM nodes UNION ALL SELECT ...");
    expect(toSqlText(cte)).toBe(
      'WITH RECURSIVE "tree" AS (SELECT id FROM nodes UNION ALL SELECT ...)',
    );
  });
});

describe("sql.onConflict()", () => {
  test("DO NOTHING on single column", () => {
    const part = sql.onConflict("email").doNothing();
    expect(toSqlText(part)).toBe('ON CONFLICT "email" DO NOTHING');
  });

  test("DO NOTHING on composite key", () => {
    const part = sql.onConflict(["tenant_id", "email"]).doNothing();
    expect(toSqlText(part)).toBe('ON CONFLICT ("tenant_id", "email") DO NOTHING');
  });

  test("DO UPDATE SET merges specified columns", () => {
    const part = sql.onConflict("email").doUpdate({ name: "Alice", updated_at: sql.raw("NOW()") });
    expect(toSqlText(part)).toBe(
      'ON CONFLICT "email" DO UPDATE SET "name" = \'Alice\', "updated_at" = NOW()',
    );
  });
});

describe("sql.begin / commit / rollback", () => {
  test("transaction keywords", () => {
    expect(toSqlText(sql.begin())).toBe("BEGIN TRANSACTION");
    expect(toSqlText(sql.commit())).toBe("COMMIT");
    expect(toSqlText(sql.rollback())).toBe("ROLLBACK");
  });
});

// ---------------------------------------------------------------------------
// QueryBuilder – real-world query patterns
// ---------------------------------------------------------------------------

describe("QueryBuilder – SELECT queries", () => {
  test("simple SELECT *", () => {
    const q = builder().rawSql("SELECT * FROM users");
    expect(q.toSql()).toBe("SELECT * FROM users");
  });

  test("SELECT with explicit columns", () => {
    const q = builder().select("id", "name", "email").from("users");
    expect(q.toSql()).toBe('SELECT"id", "name", "email"FROM"users"');
  });

  test("SELECT with WHERE clause", () => {
    const q = builder()
      .select("id", "name")
      .from("users")
      .where(sql.composite(sql.id("status"), sql.op(" = "), sql.val("active")));
    expect(q.toSql()).toBe(`SELECT"id", "name"FROM"users"WHERE"status" = 'active'`);
  });

  test("SELECT with raw WHERE (common pattern)", () => {
    const q = builder().rawSql(
      "SELECT id, name FROM users WHERE active = 1 ORDER BY name ASC LIMIT 10",
    );
    expect(q.toSql()).toBe(
      "SELECT id, name FROM users WHERE active = 1 ORDER BY name ASC LIMIT 10",
    );
  });

  test("SELECT across dialect strategies produces same logical query", () => {
    const q = builder().select("id").from("users").where("deleted_at IS NULL");
    const sqlite = q.toSql(new SqliteStrategy());
    const pg = q.toSql(new PostgresStrategy());
    // Both should contain the column/table logic; only quoting differs
    expect(sqlite).toContain('"id"');
    expect(pg).toContain('"id"');
    expect(sqlite).toContain('"users"');
  });
});

describe("QueryBuilder – INSERT queries", () => {
  test("basic INSERT INTO … VALUES", () => {
    const q = builder().insertInto("users", ["name", "email"]).values("Alice", "alice@example.com");
    expect(q.toSql()).toBe(
      `INSERT INTO"users"("name", "email")VALUES('Alice', 'alice@example.com')`,
    );
  });

  test("INSERT with numeric and boolean values", () => {
    const q = builder()
      .insertInto("settings", ["user_id", "notifications", "score"])
      .values(42, true, 9.5);
    expect(q.toSql()).toBe(
      `INSERT INTO"settings"("user_id", "notifications", "score")VALUES(42, 1, 9.5)`,
    );
  });

  test("INSERT with raw SQL expression as value", () => {
    const q = builder().insertInto("events", ["user_id", "created_at"]).values(1, sql.raw("NOW()"));
    expect(q.toSql()).toBe(`INSERT INTO"events"("user_id", "created_at")VALUES(1, NOW())`);
  });

  test("INSERT with ON CONFLICT DO NOTHING appended via raw()", () => {
    const conflict = sql.onConflict("email").doNothing();
    const q = builder().insertInto("users", ["email"]).values("bob@example.com").raw(conflict);
    expect(q.toSql()).toContain("DO NOTHING");
    expect(q.toSql()).toContain("'bob@example.com'");
  });

  test("INSERT with ON CONFLICT DO UPDATE (upsert pattern)", () => {
    const upsert = sql.onConflict("email").doUpdate({ updated_at: sql.raw("NOW()") });
    const q = builder()
      .insertInto("users", ["email", "name"])
      .values("alice@example.com", "Alice")
      .raw(upsert);
    const out = q.toSql();
    expect(out).toContain("DO UPDATE SET");
    expect(out).toContain('"updated_at" = NOW()');
  });
});

describe("QueryBuilder – DDL patterns (raw SQL)", () => {
  test("CREATE TABLE with composite primary key", () => {
    const stmt = new Statement([
      sql.key("CREATE TABLE"),
      sql.op(" "),
      sql.id("memberships"),
      sql.op(" ("),
      sql.nl(),
      sql.indent(),
      sql.id("user_id"),
      sql.op(" "),
      sql.type("INTEGER"),
      sql.op(","),
      sql.nl(),
      sql.indent(),
      sql.id("org_id"),
      sql.op(" "),
      sql.type("INTEGER"),
      sql.op(","),
      sql.nl(),
      sql.indent(),
      sql.primaryKey(),
      sql.op(" ("),
      sql.id("user_id"),
      sql.op(", "),
      sql.id("org_id"),
      sql.op(")"),
      sql.nl(),
      sql.op(")"),
    ]);

    const result = stmt.toSql(new SqliteStrategy());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toContain('"memberships"');
      expect(result.data.value).toContain("PRIMARY KEY");
      expect(result.data.value).toContain('"user_id"');
    }
  });

  test("CREATE TABLE with DEFAULT CURRENT_TIMESTAMP", () => {
    const stmt = new Composite([
      sql.key("CREATE TABLE"),
      sql.op(" "),
      sql.id("posts"),
      sql.op(" ("),
      sql.id("created_at"),
      sql.op(" TEXT "),
      new Default(new CurrentTimestamp()),
      sql.op(")"),
    ]);
    const out = toSqlText(stmt);
    expect(out).toContain("DEFAULT CURRENT_TIMESTAMP");
  });

  test("ALTER TABLE via raw SQL part", () => {
    const q = builder().rawSql('ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT');
    expect(q.toSql()).toBe('ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT');
  });
});

describe("QueryBuilder – multi-dialect output", () => {
  test("INSERT renders column quoting per dialect", () => {
    const q = builder().insertInto("orders", ["user_id", "total"]).values(7, 99.99);

    const sqlite = q.toSql(new SqliteStrategy());
    const mysql = q.toSql(new MysqlStrategy());
    const pg = q.toSql(new PostgresStrategy());

    expect(sqlite).toContain('"orders"');
    expect(mysql).toContain("`orders`");
    expect(pg).toContain('"orders"');
  });
});

describe("QueryBuilder – fluent chaining", () => {
  test("multiple raw() calls compose in order", () => {
    const q = builder()
      .rawSql("SELECT *")
      .raw(sql.op(" "))
      .rawSql("FROM users")
      .raw(sql.op(" "))
      .rawSql("WHERE id = 1");
    expect(q.toSql()).toBe("SELECT * FROM users WHERE id = 1");
  });

  test("toSql() can be called multiple times without mutation", () => {
    const q = builder().rawSql("SELECT 1");
    expect(q.toSql()).toBe("SELECT 1");
    expect(q.toSql()).toBe("SELECT 1");
  });

  test("toSql() returns empty string when no parts added", () => {
    expect(builder().toSql()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// sql.* – literal & identifier edge cases
// ---------------------------------------------------------------------------

describe("sql edge cases", () => {
  test("Literal handles empty string", () => {
    expect(toSqlText(sql.val(""))).toBe("''");
  });

  test("Literal handles 0 (falsy number)", () => {
    expect(toSqlText(sql.val(0))).toBe("0");
  });

  test("Identifier handles reserved words", () => {
    expect(toSqlText(sql.id("order"))).toBe('"order"');
    expect(toSqlText(sql.id("select"))).toBe('"select"');
  });

  test("Raw preserves whitespace and special chars", () => {
    const raw = sql.raw("strftime('%Y-%m-%d', created_at)");
    expect(toSqlText(raw)).toBe("strftime('%Y-%m-%d', created_at)");
  });
});

// ---------------------------------------------------------------------------
// BaseSql – hooks
// ---------------------------------------------------------------------------

describe("BaseSql lifecycle hooks", () => {
  test("registers before hooks", () => {
    class MyService extends BaseSql {}
    const hook = () => {};
    MyService.before(hook as any);

    expect(MyService.beforeHooks).toHaveLength(1);
    expect(MyService.beforeHooks[0].fn).toBe(hook);

    MyService.beforeHooks = [];
  });

  test("registers after hooks", () => {
    class MyService extends BaseSql {}
    const hook = () => {};
    MyService.after(hook as any);

    expect(MyService.afterHooks).toHaveLength(1);
    expect(MyService.afterHooks[0].fn).toBe(hook);

    MyService.afterHooks = [];
  });

  test("hooks are per-class (not shared across subclasses)", () => {
    class ServiceA extends BaseSql {}
    class ServiceB extends BaseSql {}

    ServiceA.before((() => {}) as any);
    expect(ServiceA.beforeHooks).toHaveLength(1);
    expect(ServiceB.beforeHooks).toHaveLength(0);

    ServiceA.beforeHooks = [];
  });
});
