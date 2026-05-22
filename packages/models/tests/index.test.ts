import { describe, expect, test } from "vite-plus/test";
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

  test("compiles string value with quotes", () => {
    const stmt = new Statement([sql.val("test")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("'test'");
  });

  test("escapes single quotes in value", () => {
    const stmt = new Statement([sql.val("it's")]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("'it''s'");
  });

  test("compiles number value", () => {
    const stmt = new Statement([sql.val(42)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("42");
  });

  test("compiles boolean true", () => {
    const stmt = new Statement([sql.val(true)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("true");
  });

  test("compiles boolean false", () => {
    const stmt = new Statement([sql.val(false)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("false");
  });

  test("compiles null value", () => {
    const stmt = new Statement([sql.val(null)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("NULL");
  });

  test("compiles undefined value", () => {
    const stmt = new Statement([sql.val(undefined)]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("NULL");
  });

  test("compiles array value", () => {
    const stmt = new Statement([sql.val([1, 2, 3])]);
    const result = stmt.toSql();
    expect(result.data.value).toBe("(1, 2, 3)");
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
    expect(sqlStr).toContain("1");
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

  test("returns mysql when specified", () => {
    const strategy = getDialectStrategy("mysql");
    expect(strategy.dialect).toBe("mysql");
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

    const model = new TestModel(mockRequest, mockEnv, mockCtx);

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

    const model = new TestModel(mockRequest, mockEnv, mockCtx);

    expect((model as unknown as { getPersistence: () => object }).getPersistence()).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseModel.beforeHooks).toBeDefined();
    expect(BaseModel.afterHooks).toBeDefined();
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

    const model = new TestModel(mockRequest, mockEnv, mockCtx);
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

    const model = new TestModel(mockRequest, mockEnv, mockCtx);
    expect(model.columnNames).toEqual([]);
  });

  test("relationships is initialized as empty object", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel(mockRequest, mockEnv, mockCtx);
    expect(model.relationships).toEqual({});
  });

  test("getRelations returns empty array when no relationships", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const model = new TestModel(mockRequest, mockEnv, mockCtx);
    expect(model.getRelations()).toEqual([]);
  });
});

describe("BaseModel with mock database", () => {
  class MockDbModel extends BaseModel {
    protected persistence: any;

    constructor(db: any) {
      super(db, "test_table");
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
      super(db, "test_table");
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
