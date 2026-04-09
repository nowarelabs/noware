export type Dialect = "sqlite" | "postgres" | "mysql";

export interface DialectStrategy {
  dialect: Dialect;
  quoteIdentifier(name: string): string;
  quoteLiteral(value: any): string;
  mapType(type: string): string;
}

export abstract class BaseDialectStrategy implements DialectStrategy {
  abstract dialect: Dialect;

  protected typeMap: Map<string, string> = new Map();

  constructor() {
    this.registerDefaultTypes();
  }

  quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  quoteLiteral(value: any): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === "boolean") return value ? "1" : "0";
    return String(value);
  }

  mapType(type: string): string {
    return this.typeMap.get(type) || type.toUpperCase();
  }

  protected registerDefaultTypes() {
    const defaults: Record<string, string> = {
      string: "TEXT",
      text: "TEXT",
      integer: "INTEGER",
      bigint: "BIGINT",
      decimal: "DECIMAL",
      boolean: "INTEGER",
      uuid: "TEXT",
      timestamp: "TEXT",
      datetime: "TEXT",
      json: "TEXT",
      jsonb: "TEXT",
    };

    for (const [type, dbType] of Object.entries(defaults)) {
      this.typeMap.set(type, dbType);
    }
  }

  registerType(type: string, dbType: string) {
    this.typeMap.set(type, dbType);
  }
}

export class SqliteStrategy extends BaseDialectStrategy {
  dialect: Dialect = "sqlite";
}

export class PostgresStrategy extends BaseDialectStrategy {
  dialect: Dialect = "postgres";

  registerDefaultTypes() {
    super.registerDefaultTypes();
    this.registerType("boolean", "BOOLEAN");
    this.registerType("json", "JSON");
    this.registerType("jsonb", "JSONB");
    this.registerType("uuid", "UUID");
    this.registerType("timestamp", "TIMESTAMP");
    this.registerType("datetime", "TIMESTAMP");
  }
}

export class MysqlStrategy extends BaseDialectStrategy {
  dialect: Dialect = "mysql";

  quoteIdentifier(name: string): string {
    return `\`${name.replace(/`/g, "``")}\``;
  }

  registerDefaultTypes() {
    super.registerDefaultTypes();
    this.registerType("boolean", "TINYINT(1)");
    this.registerType("text", "LONGTEXT");
    this.registerType("json", "JSON");
  }
}

export function getDialectStrategy(dialect: Dialect): DialectStrategy {
  switch (dialect) {
    case "postgres":
      return new PostgresStrategy();
    case "mysql":
      return new MysqlStrategy();
    default:
      return new SqliteStrategy();
  }
}
