import { type Result, ok, safe, all, tagged } from "nomo/result";
import { DialectStrategy } from "./dialects";

/**
 * Tagged output for SQL generation
 */
export type SqlOutput = { value: string };

export abstract class SqlPart {
  abstract toSql(strategy: DialectStrategy): Result<SqlOutput>;
}

export class Identifier extends SqlPart {
  constructor(public name: string) {
    super();
  }

  toSql(strategy: DialectStrategy): Result<SqlOutput> {
    return safe(() => ok(tagged("sql")({ value: strategy.quoteIdentifier(this.name) })));
  }
}

export class Literal extends SqlPart {
  constructor(public value: unknown) {
    super();
  }

  toSql(strategy: DialectStrategy): Result<SqlOutput> {
    return safe(() => ok(tagged("sql")({ value: strategy.quoteLiteral(this.value) })));
  }
}

export class Keyword extends SqlPart {
  constructor(public text: string) {
    super();
  }

  toSql(): Result<SqlOutput> {
    return safe(() => ok(tagged("sql")({ value: this.text.toUpperCase() })));
  }
}

export class Raw extends SqlPart {
  constructor(public sql: string) {
    super();
  }

  toSql(): Result<SqlOutput> {
    return safe(() => ok(tagged("sql")({ value: this.sql })));
  }
}

export class NewLine extends SqlPart {
  toSql(): Result<SqlOutput> {
    return ok(tagged("sql")({ value: "\n" }));
  }
}

export class Indent extends SqlPart {
  constructor(public level: number = 2) {
    super();
  }

  toSql(): Result<SqlOutput> {
    return ok(tagged("sql")({ value: " ".repeat(this.level) }));
  }
}

export class PrimaryKey extends Keyword {
  constructor() {
    super("PRIMARY KEY");
  }
}

export class CurrentTimestamp extends Keyword {
  constructor() {
    super("CURRENT_TIMESTAMP");
  }
}

export class Punctuation extends SqlPart {
  constructor(public text: string) {
    super();
  }

  toSql(): Result<SqlOutput> {
    return ok(tagged("sql")({ value: this.text }));
  }
}

export class Default extends SqlPart {
  constructor(public value: SqlPart) {
    super();
  }

  toSql(strategy: DialectStrategy): Result<SqlOutput> {
    return all([
      new Keyword("DEFAULT").toSql(),
      new Punctuation(" ").toSql(),
      this.value.toSql(strategy),
    ]).transform(
      (results) =>
        ({
          value: results.map((r) => r.value).join(""),
        }) as SqlOutput,
    );
  }
}

export class DataType extends SqlPart {
  constructor(public typeName: string) {
    super();
  }

  toSql(): Result<SqlOutput> {
    return ok(tagged("sql")({ value: this.typeName.toUpperCase() }));
  }
}

export class Composite extends SqlPart {
  constructor(public parts: SqlPart[]) {
    super();
  }

  /**
   * Fluent API to append parts.
   */
  append(...parts: SqlPart[]): this {
    this.parts.push(...parts);
    return this;
  }

  toSql(strategy: DialectStrategy): Result<SqlOutput> {
    return all(this.parts.map((part) => part.toSql(strategy))).transform((results) => {
      const sql = results.map((r) => r.value).join("");
      return tagged("sql")({ value: sql });
    });
  }
}

/**
 * Represents a complete SQL statement.
 * Provides a fluent API for building SQL that reads like SQL.
 */
export class Statement extends Composite {
  constructor(parts: SqlPart[] = []) {
    super(parts);
  }
}

/**
 * Simple syntax sugar for building parts
 */
export const sql = {
  id: (name: string) => new Identifier(name),
  val: (value: unknown) => new Literal(value),
  key: (text: string) => new Keyword(text),
  raw: (text: string) => new Raw(text),
  statement: (parts: SqlPart[] = []) => new Statement(parts),
  composite: (...parts: SqlPart[]) => new Composite(parts),
  nl: () => new NewLine(),
  indent: (level?: number) => new Indent(level),
  primaryKey: () => new PrimaryKey(),
  currentTimestamp: () => new CurrentTimestamp(),
  default: (value: SqlPart) => new Default(value),
  type: (name: string) => new DataType(name),
  op: (text: string) => new Punctuation(text),
  strict: () => new Keyword("STRICT"),
  withoutRowid: () => new Keyword("WITHOUT ROWID"),
  generated: (expr: string | SqlPart, stored: boolean = false) => {
    const parts: SqlPart[] = [new Keyword("GENERATED ALWAYS AS "), sql.op("(")];
    parts.push(typeof expr === "string" ? sql.raw(expr) : expr);
    parts.push(sql.op(")"));
    if (stored) parts.push(new Keyword(" STORED"));
    else parts.push(new Keyword(" VIRTUAL"));
    return new Composite(parts);
  },
  json: {
    extract: (json: string | SqlPart, path: string) =>
      new Composite([
        new Keyword("JSON_EXTRACT("),
        typeof json === "string" ? sql.id(json) : json,
        sql.op(", "),
        sql.val(path),
        sql.op(")"),
      ]),
    set: (json: string | SqlPart, path: string, value: any) =>
      new Composite([
        new Keyword("JSON_SET("),
        typeof json === "string" ? sql.id(json) : json,
        sql.op(", "),
        sql.val(path),
        sql.op(", "),
        sql.val(value),
        sql.op(")"),
      ]),
    valid: (json: string | SqlPart) =>
      new Composite([
        new Keyword("JSON_VALID("),
        typeof json === "string" ? sql.id(json) : json,
        sql.op(")"),
      ]),
  },
  with: (recursive: boolean = false) => {
    const start = recursive ? new Keyword("WITH RECURSIVE ") : new Keyword("WITH ");
    return {
      as: (name: string, query: string | SqlPart) =>
        new Composite([
          start,
          sql.id(name),
          sql.op(" AS ("),
          typeof query === "string" ? sql.raw(query) : query,
          sql.op(")"),
        ]),
    };
  },
  begin: () => new Keyword("BEGIN TRANSACTION"),
  commit: () => new Keyword("COMMIT"),
  rollback: () => new Keyword("ROLLBACK"),
  onConflict: (target: string | string[] | SqlPart) => {
    const parts: SqlPart[] = [new Keyword("ON CONFLICT ")];
    if (Array.isArray(target)) {
      parts.push(
        sql.op("("),
        sql.join(
          target.map((t) => sql.id(t)),
          sql.op(", "),
        ),
        sql.op(")"),
      );
    } else if (typeof target === "string") {
      parts.push(sql.id(target));
    } else {
      parts.push(target);
    }
    return {
      doNothing: () => new Composite([...parts, new Keyword(" DO NOTHING")]),
      doUpdate: (set: Record<string, any>) => {
        const updateParts: SqlPart[] = [...parts, new Keyword(" DO UPDATE SET ")];
        const entries = Object.entries(set).map(([k, v]) => {
          const valPart = v instanceof SqlPart ? v : sql.val(v);
          return sql.composite(sql.id(k), sql.op(" = "), valPart);
        });
        updateParts.push(sql.join(entries, sql.op(", ")));
        return new Composite(updateParts);
      },
    };
  },
  join: (parts: SqlPart[], separator: string | SqlPart) => {
    const joinedParts: SqlPart[] = [];
    const sep = typeof separator === "string" ? new Punctuation(separator) : separator;
    parts.forEach((part, i) => {
      joinedParts.push(part);
      if (i < parts.length - 1) joinedParts.push(sep);
    });
    return new Statement(joinedParts);
  },
};
