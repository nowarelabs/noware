import { describe, expect, test, beforeAll } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import {
  BaseModel,
  SqlPart,
  Statement,
  sql,
  FluentQuery,
  Logger,
  ConflictError,
  ConstraintError,
  BadRequestError,
  CallbackAbortError,
  ABORT,
  getDialectStrategy,
  defineModel,
} from "../src/index.ts";

describe("SqlPart", () => {
  test("creates a SqlPart with type and value", () => {
    const part = new SqlPart("raw", "SELECT");
    expect(part.type).toBe("raw");
    expect(part.value).toBe("SELECT");
  });
});

describe("Statement", () => {
  test("creates an empty statement", () => {
    const stmt = new Statement();
    expect(stmt.parts).toEqual([]);
  });

  test("creates a statement with initial parts", () => {
    const parts = [new SqlPart("raw", "SELECT")];
    const stmt = new Statement(parts);
    expect(stmt.parts.length).toBe(1);
  });

  test("appends SqlPart to statement", () => {
    const stmt = new Statement();
    stmt.append(sql.raw("SELECT"));
    expect(stmt.parts.length).toBe(1);
  });

  test("appends Statement to statement", () => {
    const stmt1 = new Statement([sql.raw("SELECT")]);
    const stmt2 = new Statement([sql.raw(" *")]);
    stmt1.append(stmt2);
    expect(stmt1.parts.length).toBe(2);
  });

  test("toSql returns success with valid parts", () => {
    const stmt = new Statement([sql.raw("SELECT *")]);
    const result = stmt.toSql();
    expect(result.success).toBe(true);
    expect(result.data.value).toBe("SELECT *");
  });

  test("toSql returns success with compiled SQL", () => {
    const stmt = new Statement([sql.key("SELECT "), sql.id("users")]);
    const result = stmt.toSql();
    expect(result.success).toBe(true);
    expect(result.data.value).toBe('SELECT "users"');
  });
});

describe("sql helper", () => {
  test("sql.statement creates a Statement", () => {
    const stmt = sql.statement();
    expect(stmt).toBeInstanceOf(Statement);
  });

  test("sql.raw creates a raw SqlPart", () => {
    const part = sql.raw("SELECT");
    expect(part.type).toBe("raw");
    expect(part.value).toBe("SELECT");
  });

  test("sql.id creates an id SqlPart", () => {
    const part = sql.id("users");
    expect(part.type).toBe("id");
    expect(part.value).toBe("users");
  });

  test("sql.val creates a val SqlPart", () => {
    const part = sql.val("test");
    expect(part.type).toBe("val");
    expect(part.value).toBe("test");
  });

  test("sql.op creates an op SqlPart", () => {
    const part = sql.op(" = ");
    expect(part.type).toBe("op");
    expect(part.value).toBe(" = ");
  });

  test("sql.key creates a key SqlPart", () => {
    const part = sql.key("SELECT");
    expect(part.type).toBe("key");
    expect(part.value).toBe("SELECT");
  });

  test("sql.composite creates a composite SqlPart", () => {
    const parts = [sql.raw("SELECT"), sql.raw(" *")];
    const part = sql.composite(...parts);
    expect(part.type).toBe("composite");
    expect(part.value).toEqual(parts);
  });

  test("sql.join creates a join SqlPart", () => {
    const parts = [sql.raw("a"), sql.raw("b")];
    const sep = sql.raw(", ");
    const part = sql.join(parts, sep);
    expect(part.type).toBe("join");
    expect(part.value.parts).toEqual(parts);
    expect(part.value.sep).toBe(sep);
  });

  test("sql.nl creates a newline SqlPart", () => {
    const part = sql.nl();
    expect(part.type).toBe("nl");
    expect(part.value).toBe(null);
  });
});

describe("SQL compilation", () => {
  test("compiles raw SQL", () => {
    const stmt = new Statement([sql.raw("SELECT * FROM users")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("SELECT * FROM users");
  });

  test("compiles id with quotes", () => {
    const stmt = new Statement([sql.id("users")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe('"users"');
  });

  test("compiles id with dots", () => {
    const stmt = new Statement([sql.id("users.name")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe('"users"."name"');
  });

  test("compiles wildcard id", () => {
    const stmt = new Statement([sql.id("*")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("*");
  });

  test("compiles wildcard with table prefix", () => {
    const stmt = new Statement([sql.id("users.*")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe('"users".*');
  });

  test("escapes double quotes in id", () => {
    const stmt = new Statement([sql.id('user"s')]);
    const result = stmt.toSql();
    expect(result.data.value).toBe('"user""s"');
  });

  test("compiles string value with placeholders", () => {
    const stmt = new Statement([sql.val("test")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual(["test"]);
  });

  test("escapes single quotes in value", () => {
    const stmt = new Statement([sql.val("it's")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual(["it's"]);
  });

  test("compiles number value", () => {
    const stmt = new Statement([sql.val(42)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual([42]);
  });

  test("compiles boolean true", () => {
    const stmt = new Statement([sql.val(true)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual([true]);
  });

  test("compiles boolean false", () => {
    const stmt = new Statement([sql.val(false)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual([false]);
  });

  test("compiles null value", () => {
    const stmt = new Statement([sql.val(null)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual([null]);
  });

  test("compiles undefined value", () => {
    const stmt = new Statement([sql.val(undefined)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual([undefined]);
  });

  test("compiles array value", () => {
    const stmt = new Statement([sql.val([1, 2, 3])]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("__PH_0__");
    expect(result.params).toEqual([[1, 2, 3]]);
  });

  test("compiles composite SQL", () => {
    const stmt = new Statement([sql.composite(sql.key("SELECT "), sql.raw("*"))]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("SELECT *");
  });

  test("compiles join SQL", () => {
    const stmt = new Statement([
      sql.join([sql.raw("a"), sql.raw("b"), sql.raw("c")], sql.raw(", ")),
    ]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("a, b, c");
  });

  test("compiles newline", () => {
    const stmt = new Statement([sql.raw("SELECT"), sql.nl(), sql.raw("*")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("SELECT\n*");
  });
});

describe("value interpolation (escapeVal coverage)", () => {
  function getInterpolatedSql(fn: (captured: string) => void) {
    const mockDb = {
      execSql: async (sql: string) => {
        fn(sql);
        return [];
      },
    };
    return mockDb;
  }

  test("escapes single quotes in strings", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const query = new FluentQuery(db, "users");
    query.where({ name: "O'Brien" });
    await query.all();
    expect(captured).toContain("'O''Brien'");
  });

  test("interpolates number values", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const query = new FluentQuery(db, "users");
    query.where({ age: 42 });
    await query.all();
    expect(captured).toContain("42");
  });

  test("interpolates boolean true", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const query = new FluentQuery(db, "users");
    query.where({ active: true });
    await query.all();
    expect(captured).toContain("true");
  });

  test("interpolates boolean false", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const query = new FluentQuery(db, "users");
    query.where({ active: false });
    await query.all();
    expect(captured).toContain("false");
  });

  test("interpolates null as NULL", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const query = new FluentQuery(db, "users");
    query.where({ deleted_at: null });
    await query.all();
    expect(captured).toContain("IS NULL");
    expect(captured).not.toContain("__PH_");
  });

  test("interpolates Date as ISO string", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const d = new Date("2025-01-15T10:30:00.000Z");
    const query = new FluentQuery(db, "users");
    query.where({ created_at: d });
    await query.all();
    expect(captured).toContain("2025-01-15T10:30:00.000Z");
  });

  test("interpolates IN clause with mixed types", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const query = new FluentQuery(db, "users");
    query.where({ id: { in: [1, "two", null] } });
    await query.all();
    expect(captured).toContain("IN");
    expect(captured).toContain("1");
    expect(captured).toContain("'two'");
    expect(captured).toContain("NULL");
    expect(captured).not.toContain("__PH_");
  });

  test("raw SQL fragments with literal ? are not consumed as placeholders", async () => {
    let captured = "";
    const db = getInterpolatedSql((s) => (captured = s));
    const query = new FluentQuery(db, "users");
    query.where(sql.raw("json_extract(data, '$.key') = 'test'"));
    await query.all();
    expect(captured).toContain("json_extract(data, '$.key') = 'test'");
  });
});

describe("FluentQuery", () => {
  const mockDb = {
    execSql: async (_sql: string) => [],
  };

  test("creates a FluentQuery instance", () => {
    const query = new FluentQuery(mockDb, "users");
    expect(query).toBeInstanceOf(FluentQuery);
  });

  test("select builds correct SQL", () => {
    const query = new FluentQuery(mockDb, "users");
    query.select("id", "name");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("SELECT");
    expect(sqlStr).toContain('"id"');
    expect(sqlStr).toContain('"name"');
  });

  test("select * builds correct SQL", () => {
    const query = new FluentQuery(mockDb, "users");
    query.select("*");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("SELECT *");
  });

  test("where with simple conditions", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ id: 1 });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("WHERE");
    expect(sqlStr).toContain('"id"');
    expect(sqlStr).toContain(" = ");
    expect(sqlStr).toContain("__PH_");
  });

  test("where with null condition", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ deleted_at: null });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("IS NULL");
  });

  test("where with neq operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ status: { neq: "deleted" } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("IS NOT");
  });

  test("where with gt operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ age: { gt: 18 } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain(" > ");
  });

  test("where with gte operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ age: { gte: 18 } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain(" >= ");
  });

  test("where with lt operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ age: { lt: 65 } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain(" < ");
  });

  test("where with lte operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ age: { lte: 65 } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain(" <= ");
  });

  test("where with like operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ name: { like: "%John%" } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("LIKE");
  });

  test("where with in operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ id: { in: [1, 2, 3] } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("IN");
  });

  test("where with nin operator", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ id: { nin: [1, 2, 3] } });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("NOT IN");
  });

  test("orWhere adds OR condition", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ id: 1 });
    query.orWhere({ name: "test" });
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("OR");
  });

  test("orderBy builds correct SQL", () => {
    const query = new FluentQuery(mockDb, "users");
    query.orderBy("name", "DESC");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("ORDER BY");
    expect(sqlStr).toContain('"name"');
    expect(sqlStr).toContain("DESC");
  });

  test("limit builds correct SQL", () => {
    const query = new FluentQuery(mockDb, "users");
    query.limit(10);
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("LIMIT");
    expect(sqlStr).toContain("10");
  });

  test("offset builds correct SQL", () => {
    const query = new FluentQuery(mockDb, "users");
    query.offset(20);
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("OFFSET");
    expect(sqlStr).toContain("20");
  });

  test("clone creates independent copy", () => {
    const query = new FluentQuery(mockDb, "users");
    query.where({ id: 1 }).limit(10);
    const cloned = query.clone();
    const originalSql = query.toSql();
    cloned.offset(5);
    const clonedSql = cloned.toSql();
    expect(originalSql).not.toBe(clonedSql);
    expect(clonedSql).toContain("OFFSET");
  });

  test("with sets eager loading", () => {
    const query = new FluentQuery(mockDb, "users");
    query.with("posts");
    expect(query).toBeDefined();
  });

  test("withJoins sets join strategy", () => {
    const query = new FluentQuery(mockDb, "users");
    query.withJoins("posts");
    expect(query).toBeDefined();
  });

  test("withSeparateQueries sets separate query strategy", () => {
    const query = new FluentQuery(mockDb, "users");
    query.withSeparateQueries("posts");
    expect(query).toBeDefined();
  });

  test("join adds JOIN clause", () => {
    const query = new FluentQuery(mockDb, "users");
    query.join("posts", "users.id = posts.user_id");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("JOIN");
  });

  test("setRelationships stores relationships", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    expect(query).toBeDefined();
  });

  test("withJoins + has_many + limit throws error", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts").limit(10);
    expect(() => query.toSql()).toThrow("withJoins");
  });

  test("full query with select, where, orderBy, limit, offset", () => {
    const query = new FluentQuery(mockDb, "users");
    query
      .select("id", "name")
      .where({ status: "active" })
      .orderBy("created_at", "DESC")
      .limit(10)
      .offset(20);
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("SELECT");
    expect(sqlStr).toContain("FROM");
    expect(sqlStr).toContain("WHERE");
    expect(sqlStr).toContain("ORDER BY");
    expect(sqlStr).toContain("LIMIT");
    expect(sqlStr).toContain("OFFSET");
  });
});

describe("withJoins eager loading", () => {
  const mockDb = { execSql: async (_sql: string) => [] };

  class PostModel extends BaseModel {
    static columnTypes = { id: "integer", title: "text", user_id: "integer" };
    protected persistence = {};
    protected getPersistence() {
      return this.persistence;
    }
  }

  class AuthorModel extends BaseModel {
    static columnTypes = { id: "integer", name: "text" };
    protected persistence = {};
    protected getPersistence() {
      return this.persistence;
    }
  }

  class ProfileModel extends BaseModel {
    static columnTypes = { id: "integer", bio: "text", user_id: "integer" };
    protected persistence = {};
    protected getPersistence() {
      return this.persistence;
    }
  }

  beforeAll(() => {
    BaseModel.register("posts", PostModel);
    BaseModel.register("users", AuthorModel);
    BaseModel.register("profiles", ProfileModel);
  });

  test("produces relName__col aliases in SELECT for joined tables", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain('"posts"."id" AS "posts__id"');
    expect(sqlStr).toContain('"posts"."title" AS "posts__title"');
    expect(sqlStr).toContain('"posts"."user_id" AS "posts__user_id"');
  });

  test("main table uses unaliased .*", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain('"users".*');
  });

  test("JOIN clause aliases table by relation name", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain('LEFT JOIN "posts" AS "posts"');
  });

  test("has_many: JOIN ON uses tableName.id = relName.fk", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain('"users"."id" = "posts"."user_id"');
  });

  test("belongs_to: JOIN ON uses tableName.fk = relName.id", () => {
    const query = new FluentQuery(mockDb, "posts");
    query.setRelationships({
      author: { type: "belongs_to", model: "users", foreignKey: "author_id" },
    });
    query.withJoins("author");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain('"posts"."author_id" = "author"."id"');
  });

  test("has_one: JOIN ON uses tableName.id = relName.fk", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      profile: { type: "has_one", model: "profiles", foreignKey: "user_id" },
    });
    query.withJoins("profile");
    const sqlStr = query.toSql();
    expect(sqlStr).toContain('"users"."id" = "profile"."user_id"');
  });

  test("has_many + limit throws", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts").limit(10);
    expect(() => query.toSql()).toThrow("has_many");
  });

  test("has_many + offset throws", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts").offset(5);
    expect(() => query.toSql()).toThrow("has_many");
  });

  test("has_one + limit does NOT throw (no fan-out risk)", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      profile: { type: "has_one", model: "profiles", foreignKey: "user_id" },
    });
    query.withJoins("profile").limit(10);
    expect(() => query.toSql()).not.toThrow();
  });

  test("belongs_to + limit does NOT throw", () => {
    const query = new FluentQuery(mockDb, "posts");
    query.setRelationships({
      author: { type: "belongs_to", model: "users", foreignKey: "author_id" },
    });
    query.withJoins("author").limit(10);
    expect(() => query.toSql()).not.toThrow();
  });

  test("throws for unregistered model", () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      comments: { type: "has_many", model: "nonexistent_model" },
    });
    query.withJoins("comments");
    expect(() => query.toSql()).toThrow("registered");
  });

  test("throws for model with no columnTypes", () => {
    class EmptyModel extends BaseModel {
      protected persistence = {};
      protected getPersistence() {
        return this.persistence;
      }
    }
    BaseModel.register("empty_model", EmptyModel);

    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      things: { type: "has_many", model: "empty_model" },
    });
    query.withJoins("things");
    expect(() => query.toSql()).toThrow("columnTypes");
  });
});

describe("loadJoinedRelations dedup", () => {
  const mockDb = { execSql: async (_sql: string) => [] };

  class PostModel extends BaseModel {
    static columnTypes = { id: "integer", title: "text", user_id: "integer" };
    protected persistence = {};
    protected getPersistence() {
      return this.persistence;
    }
  }

  beforeAll(() => {
    BaseModel.register("posts", PostModel);
  });

  test("collapses multiple joined rows into one parent with array of related", async () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts");

    const rows = [
      { id: 1, name: "Alice", posts__id: 10, posts__title: "Post A", posts__user_id: 1 },
      { id: 1, name: "Alice", posts__id: 20, posts__title: "Post B", posts__user_id: 1 },
      { id: 2, name: "Bob", posts__id: null, posts__title: null, posts__user_id: null },
    ];

    const result = await (query as any).loadJoinedRelations(rows);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[0].name).toBe("Alice");
    expect(result[0].posts).toHaveLength(2);
    expect(result[0].posts[0]).toEqual({ id: 10, title: "Post A", user_id: 1 });
    expect(result[0].posts[1]).toEqual({ id: 20, title: "Post B", user_id: 1 });
  });

  test("parent with no related data gets empty array", async () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts");

    const rows = [
      { id: 3, name: "Charlie", posts__id: null, posts__title: null, posts__user_id: null },
    ];

    const result = await (query as any).loadJoinedRelations(rows);
    expect(result).toHaveLength(1);
    expect(result[0].posts).toEqual([]);
  });

  test("strips relation prefix keys from main record", async () => {
    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
    });
    query.withJoins("posts");

    const rows = [
      { id: 1, name: "Alice", posts__id: 10, posts__title: "Post A", posts__user_id: 1 },
    ];

    const result = await (query as any).loadJoinedRelations(rows);
    const mainKeys = Object.keys(result[0]).filter((k) => !k.startsWith("posts"));
    expect(mainKeys).not.toContain("posts__id");
    expect(mainKeys).not.toContain("posts__title");
  });

  test("multiple relations are grouped independently", async () => {
    class CommentModel extends BaseModel {
      static columnTypes = { id: "integer", body: "text", user_id: "integer" };
      protected persistence = {};
      protected getPersistence() {
        return this.persistence;
      }
    }
    BaseModel.register("comments", CommentModel);

    const query = new FluentQuery(mockDb, "users");
    query.setRelationships({
      posts: { type: "has_many", model: "posts", foreignKey: "user_id" },
      comments: { type: "has_many", model: "comments", foreignKey: "user_id" },
    });
    query.withJoins("posts", "comments");

    const rows = [
      {
        id: 1,
        name: "Alice",
        posts__id: 10,
        posts__title: "Post A",
        posts__user_id: 1,
        comments__id: 100,
        comments__body: "Great!",
        comments__user_id: 1,
      },
      {
        id: 1,
        name: "Alice",
        posts__id: 20,
        posts__title: "Post B",
        posts__user_id: 1,
        comments__id: 100,
        comments__body: "Great!",
        comments__user_id: 1,
      },
    ];

    const result = await (query as any).loadJoinedRelations(rows);
    expect(result).toHaveLength(1);
    expect(result[0].posts).toHaveLength(2);
    expect(result[0].comments).toHaveLength(2);
  });
});

describe("transaction SQL and callbacks", () => {
  class TxModel extends BaseModel {
    static columnTypes = { id: "integer", name: "text" };
    protected persistence: any;
    protected getPersistence() {
      return this.persistence;
    }
  }

  function makeMockDb(capture: string[], returnRow: any = { id: 1, name: "Alice" }) {
    return {
      prepare: (sql: string) => ({
        bind: (..._params: any[]) => ({
          all: async () => {
            capture.push(sql);
            return { results: [returnRow] };
          },
        }),
      }),
      execSql: async (sql: string) => {
        capture.push(sql);
        return [returnRow];
      },
    };
  }

  function registerAllCallbacks(model: TxModel, handlers: Record<string, (data: any) => void>) {
    for (const [event, fn] of Object.entries(handlers)) {
      (model as any).callbacks[event].push({ fn: fn.bind(model), options: undefined });
    }
  }

  test("transaction issues BEGIN and COMMIT", async () => {
    const captured: string[] = [];
    const db = makeMockDb(captured);
    const model = new TxModel({ db, table: "users" });

    await model.transaction(async (m) => {
      await m.create({ name: "Alice" });
    });

    expect(captured.some((s) => s.includes("BEGIN"))).toBe(true);
    expect(captured.some((s) => s.includes("COMMIT"))).toBe(true);
  });

  test("transaction issues ROLLBACK on error", async () => {
    const captured: string[] = [];
    const db = makeMockDb(captured);
    const model = new TxModel({ db, table: "users" });

    try {
      await model.transaction(async () => {
        throw new Error("boom");
      });
    } catch {
      // expected
    }

    expect(captured.some((s) => s.includes("BEGIN"))).toBe(true);
    expect(captured.some((s) => s.includes("ROLLBACK"))).toBe(true);
    expect(captured.some((s) => s.includes("COMMIT"))).toBe(false);
  });

  test("transaction fires only create callbacks when only create is called", async () => {
    const db = makeMockDb([]);
    const fired: string[] = [];
    const model = new TxModel({ db, table: "users" });

    registerAllCallbacks(model, {
      afterCreateCommit: (data: any) => fired.push(`afterCreateCommit:${data?.name}`),
      afterUpdateCommit: () => fired.push("afterUpdateCommit"),
      afterSaveCommit: (data: any) => fired.push(`afterSaveCommit:${data?.name}`),
    });

    await model.transaction(async (m) => {
      await m.create({ name: "Alice" });
    });

    expect(fired).toContain("afterCreateCommit:Alice");
    expect(fired).toContain("afterSaveCommit:Alice");
    expect(fired).not.toContain("afterUpdateCommit");
  });

  test("transaction fires only update callbacks when only update is called", async () => {
    const captured: string[] = [];
    const db = makeMockDb(captured, { id: 1, name: "Bob" });
    const fired: string[] = [];
    const model = new TxModel({ db, table: "users" });

    registerAllCallbacks(model, {
      afterCreateCommit: () => fired.push("afterCreateCommit"),
      afterUpdateCommit: (data: any) => fired.push(`afterUpdateCommit:${data?.name}`),
    });

    await model.transaction(async (m) => {
      await m.update(1, { name: "Bob" });
    });

    expect(fired).toContainEqual(expect.stringMatching(/^afterUpdateCommit:/));
    expect(fired).not.toContain("afterCreateCommit");
  });

  test("transaction fires afterRollback on error", async () => {
    const db = makeMockDb([]);
    const model = new TxModel({ db, table: "users" });
    let rollbackFired = false;

    registerAllCallbacks(model, {
      afterRollback: () => {
        rollbackFired = true;
      },
    });

    try {
      await model.transaction(async () => {
        throw new Error("boom");
      });
    } catch {
      // expected
    }

    expect(rollbackFired).toBe(true);
  });

  test("afterRollback fires once per operation with correct context and record data", async () => {
    const db = makeMockDb([]);
    const model = new TxModel({ db, table: "users" });
    const rollbackCalls: Array<{ context: string; data: any }> = [];

    registerAllCallbacks(model, {
      afterRollback: (data: any, ctx?: string) => {
        rollbackCalls.push({ context: ctx ?? "unknown", data });
      },
    });

    try {
      await model.transaction(async (m) => {
        await m.create({ name: "Alice" });
        await m.update(1, { name: "Bob" });
        throw new Error("boom");
      });
    } catch {
      // expected
    }

    // Once per operation, not 2-3x per commit-callback type
    expect(rollbackCalls).toHaveLength(2);
    expect(rollbackCalls[0].context).toBe("create");
    expect(rollbackCalls[0].data.error).toBe("boom");
    expect(rollbackCalls[1].context).toBe("update");
    expect(rollbackCalls[1].data.error).toBe("boom");
  });

  test("afterRollback fires with destroy context when only delete was attempted", async () => {
    const db = makeMockDb([]);
    const model = new TxModel({ db, table: "users" });
    const rollbackCalls: Array<{ context: string; data: any }> = [];

    registerAllCallbacks(model, {
      afterRollback: (data: any, ctx?: string) => {
        rollbackCalls.push({ context: ctx ?? "unknown", data });
      },
    });

    try {
      await model.transaction(async (m) => {
        await m.delete(1);
        throw new Error("boom after delete");
      });
    } catch {
      // expected
    }

    expect(rollbackCalls).toHaveLength(1);
    expect(rollbackCalls[0].context).toBe("destroy");
    expect(rollbackCalls[0].data.id).toBe(1);
    expect(rollbackCalls[0].data.error).toBe("boom after delete");
  });

  test("callback failure after COMMIT does not trigger ROLLBACK", async () => {
    const captured: string[] = [];
    const db = makeMockDb(captured);
    const model = new TxModel({ db, table: "users" });

    registerAllCallbacks(model, {
      afterCommit: () => {
        throw new Error("callback exploded");
      },
    });

    try {
      await model.transaction(async (m) => {
        await m.create({ name: "Alice" });
      });
    } catch {
      // expected — the callback error propagates
    }

    // COMMIT was issued but ROLLBACK should NOT be
    expect(captured.some((s) => s.includes("COMMIT"))).toBe(true);
    expect(captured.some((s) => s.includes("ROLLBACK"))).toBe(false);
  });

  test("outside transaction, callbacks fire immediately (no queue)", async () => {
    const db = makeMockDb([]);
    const fired: string[] = [];
    const model = new TxModel({ db, table: "users" });

    registerAllCallbacks(model, {
      afterCreateCommit: (data: any) => fired.push(`afterCreateCommit:${data?.name}`),
      afterUpdateCommit: () => fired.push("afterUpdateCommit"),
    });

    await model.create({ name: "Alice" });

    expect(fired).toContain("afterCreateCommit:Alice");
    expect(fired).not.toContain("afterUpdateCommit");
  });
});

describe("Logger", () => {
  test("creates a Logger instance", () => {
    const logger = new Logger({ service: "test" });
    expect(logger.service).toBe("test");
  });

  test("logger has info method", () => {
    const logger = new Logger();
    expect(typeof logger.info).toBe("function");
  });

  test("logger has debug method", () => {
    const logger = new Logger();
    expect(typeof logger.debug).toBe("function");
  });

  test("logger has error method", () => {
    const logger = new Logger();
    expect(typeof logger.error).toBe("function");
  });

  test("logger has warn method", () => {
    const logger = new Logger();
    expect(typeof logger.warn).toBe("function");
  });
});

describe("Error classes", () => {
  test("ConflictError is an Error", () => {
    const err = new ConflictError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ConflictError");
  });

  test("ConstraintError has type and details", () => {
    const err = new ConstraintError("test", "FOREIGN_KEY", { foo: "bar" });
    expect(err.type).toBe("FOREIGN_KEY");
    expect(err.details).toEqual({ foo: "bar" });
  });

  test("BadRequestError is an Error", () => {
    const err = new BadRequestError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("BadRequestError");
  });

  test("CallbackAbortError is an Error", () => {
    const err = new CallbackAbortError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("CallbackAbortError");
  });

  test("ABORT is a symbol", () => {
    expect(typeof ABORT).toBe("symbol");
  });
});

describe("getDialectStrategy", () => {
  test("returns sqlite by default", () => {
    const strategy = getDialectStrategy();
    expect(strategy.dialect).toBe("sqlite");
  });

  test("returns postgres when specified", () => {
    const strategy = getDialectStrategy("postgres");
    expect(strategy.dialect).toBe("postgres");
  });
});

describe("BaseModel", () => {
  class TestModel extends BaseModel {
    protected persistence = {};

    protected getPersistence() {
      return this.persistence;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel({ request: mockRequest, env: mockEnv, ctx: mockCtx });

    expect(model).toBeDefined();
    expect((model as unknown as { request: Request }).request).toBe(mockRequest);
    expect((model as unknown as { env: Record<string, unknown> }).env).toBe(mockEnv);
    expect((model as unknown as { ctx: ContextLike }).ctx).toBe(mockCtx);
  });

  test("getPersistence returns the persistence", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel({ request: mockRequest, env: mockEnv, ctx: mockCtx });

    expect((model as unknown as { getPersistence: () => object }).getPersistence()).toEqual({});
  });

  test("registry stores and retrieves models", () => {
    class AnotherModel extends BaseModel {
      protected persistence = {};
      protected getPersistence() {
        return this.persistence;
      }
    }

    BaseModel.register("AnotherModel", AnotherModel);
    expect(BaseModel.registry["AnotherModel"]).toBe(AnotherModel);
  });

  test("query returns FluentQuery instance", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel({ request: mockRequest, env: mockEnv, ctx: mockCtx });
    const query = model.query();
    expect(query).toBeInstanceOf(FluentQuery);
  });

  test("columnNames returns empty array when no table defined", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel({ request: mockRequest, env: mockEnv, ctx: mockCtx });
    expect(model.columnNames).toEqual([]);
  });

  test("relationships is initialized as empty object", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel({ request: mockRequest, env: mockEnv, ctx: mockCtx });
    expect(model.relationships).toEqual({});
  });

  test("getRelations returns empty array when no relationships", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel({ request: mockRequest, env: mockEnv, ctx: mockCtx });
    expect(model.getRelations()).toEqual([]);
  });
});

describe("BaseModel with mock database", () => {
  class MockDbModel extends BaseModel {
    protected persistence: any;

    constructor(db: any) {
      super({ db, table: "test_table" });
      this.persistence = { db };
    }

    protected getPersistence() {
      return this.persistence;
    }
  }

  test("db getter returns database instance", () => {
    const mockDb = { execSql: async () => [] };
    const model = new MockDbModel(mockDb);
    expect(model.db).toBe(mockDb);
  });

  test("where returns FluentQuery", () => {
    const mockDb = { execSql: async () => [] };
    const model = new MockDbModel(mockDb);
    const query = model.where({ id: 1 });
    expect(query).toBeInstanceOf(FluentQuery);
  });

  test("select returns FluentQuery", () => {
    const mockDb = { execSql: async () => [] };
    const model = new MockDbModel(mockDb);
    const query = model.select("id", "name");
    expect(query).toBeInstanceOf(FluentQuery);
  });

  test("orderBy returns FluentQuery", () => {
    const mockDb = { execSql: async () => [] };
    const model = new MockDbModel(mockDb);
    const query = model.orderBy("name");
    expect(query).toBeInstanceOf(FluentQuery);
  });

  test("limit returns FluentQuery", () => {
    const mockDb = { execSql: async () => [] };
    const model = new MockDbModel(mockDb);
    const query = model.limit(10);
    expect(query).toBeInstanceOf(FluentQuery);
  });

  test("offset returns FluentQuery", () => {
    const mockDb = { execSql: async () => [] };
    const model = new MockDbModel(mockDb);
    const query = model.offset(20);
    expect(query).toBeInstanceOf(FluentQuery);
  });

  test("with returns FluentQuery", () => {
    const mockDb = { execSql: async () => [] };
    const model = new MockDbModel(mockDb);
    const query = model.with("relation");
    expect(query).toBeInstanceOf(FluentQuery);
  });
});

describe("BaseModel lifecycle queries", () => {
  class LifecycleModel extends BaseModel {
    protected persistence: any;

    constructor(db: any) {
      super({ db, table: "test_table" });
      this.persistence = { db };
    }

    protected getPersistence() {
      return this.persistence;
    }
  }

  test("trashed returns FluentQuery with trashed_at condition", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.trashed();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("trashed_at");
    expect(sqlStr).toContain("IS NOT");
  });

  test("notTrashed returns FluentQuery with trashed_at IS NULL", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.notTrashed();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("trashed_at");
    expect(sqlStr).toContain("IS NULL");
  });

  test("hidden returns FluentQuery with hidden_at condition", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.hidden();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("hidden_at");
  });

  test("notHidden returns FluentQuery with hidden_at IS NULL", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.notHidden();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("hidden_at");
    expect(sqlStr).toContain("IS NULL");
  });

  test("flagged returns FluentQuery with flagged_at condition", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.flagged();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("flagged_at");
  });

  test("notFlagged returns FluentQuery with flagged_at IS NULL", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.notFlagged();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("flagged_at");
    expect(sqlStr).toContain("IS NULL");
  });

  test("retired returns FluentQuery with retired_at condition", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.retired();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("retired_at");
  });

  test("notRetired returns FluentQuery with retired_at IS NULL", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.notRetired();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("retired_at");
    expect(sqlStr).toContain("IS NULL");
  });

  test("active returns FluentQuery with multiple null conditions", () => {
    const mockDb = { execSql: async () => [] };
    const model = new LifecycleModel(mockDb);
    const query = model.active();
    const sqlStr = query.toSql();
    expect(sqlStr).toContain("trashed_at");
    expect(sqlStr).toContain("hidden_at");
    expect(sqlStr).toContain("retired_at");
  });
});

describe("defineModel", () => {
  test("returns object with tableName and columns", () => {
    const model = defineModel("users", {
      id: "integer",
      name: "text",
    });
    expect(model.tableName).toBe("users");
    expect(model.columns).toEqual({ id: "integer", name: "text" });
  });
});
