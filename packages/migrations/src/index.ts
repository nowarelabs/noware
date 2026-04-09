/**
 * Interface for raw SQL expressions
 */
export interface SqlExpression {
  sql: string;
  __isSql: true;
}

/**
 * Simple SQL tag for raw expressions in migrations
 */
export const sql = (strings: TemplateStringsArray, ...values: unknown[]): SqlExpression => {
  return {
    sql: strings.reduce((acc, str, i) => {
      const val = values[i];
      const valStr = val !== undefined && val !== null ? String(val) : "";
      return acc + str + valStr;
    }, ""),
    __isSql: true,
  };
};

sql.raw = (str: string): SqlExpression => ({ sql: str, __isSql: true });

/**
 * Migration direction
 */
export type Direction = "up" | "down";

/**
 * Options for column definitions
 */
export interface ColumnOptions {
  primaryKey?: boolean;
  autoincrement?: boolean;
  notNull?: boolean;
  unique?: boolean;
  index?: boolean;
  default?: unknown;
  check?: string | SqlExpression;
  length?: number;
  precision?: number;
  scale?: number;
  comment?: string;
  references?: string; // "table.column"
  onDelete?: "cascade" | "restrict" | "set null" | "no action";
  name?: string;
  generated?: { as: string | SqlExpression; stored?: boolean };
}

/**
 * Options for table definitions
 */
export interface TableOptions {
  id?: boolean;
  primaryKey?: string | string[];
  location?: "d1" | "do";
  durableObject?: string;
  unique?: (string | string[])[];
  check?: (string | SqlExpression)[];
  strict?: boolean;
  withoutRowid?: boolean;
}

/**
 * Options for model relationships
 */
export interface RelationshipOptions {
  model?: string;
  foreignKey?: string;
  through?: string;
  sourceKey?: string;
}

export interface DurableObjectOptions {
  type?: "view" | "queue" | "search" | "lock" | "logic" | "cache" | "session" | "state";
  populateFrom?: string[];
  doModel?: string;
  rpcPath?: string;
}

/**
 * Metadata for a relationship
 */
export interface Relationship {
  type: "hasMany" | "hasOne" | "belongsTo" | "belongsToPolymorphic";
  name: string;
  targetTable: string;
  options: RelationshipOptions;
}

/**
 * Composable classes for schema representation
 */
export class Column {
  constructor(
    public name: string,
    public type: string,
    public options: ColumnOptions = {},
  ) {}
}

export class Index {
  public name?: string;
  public unique?: boolean;
  constructor(
    public columns: string[],
    public options: { name?: string; unique?: boolean } = {},
  ) {
    this.name = options.name;
    this.unique = options.unique;
  }
}

export class ForeignKey {
  constructor(
    public column: string,
    public toTable: string,
    public toColumn: string,
    public options: {
      onDelete?: string;
      onUpdate?: string;
      name?: string;
    } = {},
  ) {}
}

export class Constraint {
  constructor(
    public name: string | undefined,
    public type: "unique" | "check",
    public definition: string | string[] | SqlExpression,
  ) {}
}

/**
 * Table builder DSL
 */
export class TableBuilder {
  public columns: Column[] = [];
  public indexes: Index[] = [];
  public foreignKeys: ForeignKey[] = [];
  public constraints: Constraint[] = [];
  public relationships: Relationship[] = [];
  public location: "d1" | "do" = "d1";
  public durableObject?: string;
  public primaryKey?: string | string[];
  public strict: boolean = false;
  public withoutRowid: boolean = false;
  public scaffoldDoType?: string;
  public scaffoldPopulateFrom: string[] = [];
  public scaffoldDoModel?: string;
  public scaffoldRpcPath?: string;

  constructor(
    public tableName: string,
    options: TableOptions = {},
  ) {
    this.location = options.location || "d1";
    this.durableObject = options.durableObject;
    this.primaryKey = options.primaryKey;
    this.strict = options.strict || false;
    this.withoutRowid = options.withoutRowid || false;

    if (options.unique) {
      options.unique.forEach((u) => this.unique(u));
    }
    if (options.check) {
      options.check.forEach((c) => this.check(c));
    }

    if (options.id !== false && !this.primaryKey) {
      this.id();
    }
  }

  id(options: ColumnOptions = {}) {
    const existing = this.columns.find((c) => c.name === "id");
    if (existing) {
      existing.options = { ...existing.options, ...options };
      return this;
    }
    this.columns.push(
      new Column("id", "integer", {
        primaryKey: true,
        notNull: true,
        ...options,
      }),
    );
    return this;
  }

  string(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "string", options));
    if (options.index) this.index(name, { unique: options.unique });
    return this;
  }

  text(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "text", options));
    return this;
  }

  integer(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "integer", options));
    if (options.index) this.index(name, { unique: options.unique });
    return this;
  }

  bigint(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "bigint", options));
    if (options.index) this.index(name, { unique: options.unique });
    return this;
  }

  decimal(name: string, options: ColumnOptions & { precision?: number; scale?: number } = {}) {
    this.columns.push(new Column(name, "decimal", options));
    if (options.index) this.index(name, { unique: options.unique });
    return this;
  }

  boolean(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "boolean", options));
    return this;
  }

  uuid(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "uuid", options));
    return this;
  }

  timestamp(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "timestamp", options));
    return this;
  }

  datetime(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "datetime", options));
    return this;
  }

  json(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "json", options));
    return this;
  }

  jsonb(name: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, "jsonb", options));
    return this;
  }

  timestamps() {
    this.timestamp("created_at", {
      notNull: true,
      default: sqlBuilder.currentTimestamp(),
    });
    this.timestamp("updated_at", {
      notNull: true,
      default: sqlBuilder.currentTimestamp(),
    });
    return this;
  }

  lifecycle() {
    this.timestamp("trashed_at");
    this.timestamp("hidden_at");
    this.timestamp("flagged_at");
    this.timestamp("retired_at");
    return this;
  }

  foreignKey(
    columnName: string,
    toTable: string,
    toColumn: string = "id",
    options: {
      onDelete?: "cascade" | "restrict" | "set null" | "no action";
      onUpdate?: "cascade" | "restrict" | "set null" | "no action";
      name?: string;
    } = {},
  ) {
    this.foreignKeys.push(new ForeignKey(columnName, toTable, toColumn, options));
    return this;
  }

  references(
    tableName: string,
    options: ColumnOptions & {
      columnName?: string;
      polymorphic?: boolean;
      foreignKey?: boolean | string;
      type?: string;
    } = {},
  ) {
    const baseName = tableName.replace(/s$/, "");
    if (options.polymorphic) {
      this.column(`${baseName}_id`, options.type || "integer", options);
      this.string(`${baseName}_type`, options);
    } else {
      const columnName = options.columnName || `${baseName}_id`;
      this.column(columnName, options.type || "integer", options);
      if (options.foreignKey) {
        const toTable = typeof options.foreignKey === "string" ? options.foreignKey : tableName;
        this.foreignKey(columnName, toTable, "id", {
          onDelete: options.onDelete,
        });
      }
    }
    return this;
  }

  column(name: string, type: string, options: ColumnOptions = {}) {
    this.columns.push(new Column(name, type, options));
    if (options.index) this.index(name, { unique: options.unique });
    return this;
  }

  index(columns: string | string[], options: { name?: string; unique?: boolean } = {}) {
    this.indexes.push(new Index(Array.isArray(columns) ? columns : [columns], options));
    return this;
  }

  unique(columns: string | string[], options: { name?: string } = {}) {
    this.constraints.push(
      new Constraint(options.name, "unique", Array.isArray(columns) ? columns : [columns]),
    );
    return this;
  }

  check(definition: string | SqlExpression, options: { name?: string } = {}) {
    this.constraints.push(new Constraint(options.name, "check", definition));
    return this;
  }

  hasMany(targetTable: string, options: RelationshipOptions & { name?: string } = {}) {
    this.relationships.push({
      type: "hasMany",
      targetTable,
      name: options.name || targetTable,
      options,
    });
    return this;
  }

  hasOne(targetTable: string, options: RelationshipOptions & { name?: string } = {}) {
    this.relationships.push({
      type: "hasOne",
      targetTable,
      name: options.name || targetTable,
      options,
    });
    return this;
  }

  belongsTo(targetTable: string, options: RelationshipOptions & { name?: string } = {}) {
    this.relationships.push({
      type: "belongsTo",
      targetTable,
      name: options.name || targetTable.replace(/s$/, ""),
      options,
    });
    return this;
  }

  doType(type: "view" | "queue" | "search" | "lock" | "logic" | "cache" | "session" | "state") {
    this.scaffoldDoType = type;
    return this;
  }

  populateFrom(...tables: string[]) {
    this.scaffoldPopulateFrom = tables;
    return this;
  }

  doModel(model: string) {
    this.scaffoldDoModel = model;
    return this;
  }

  rpcPath(path: string) {
    this.scaffoldRpcPath = path;
    return this;
  }
}

/**
 * Virtual Table builder (e.g. for FTS5)
 */
export class VirtualTableBuilder {
  public moduleName: string;
  public arguments: string[] = [];

  constructor(
    public tableName: string,
    moduleName: string = "fts5",
  ) {
    this.moduleName = moduleName;
  }

  arg(value: string) {
    this.arguments.push(value);
    return this;
  }
}

/**
 * Migration Command Pattern
 */
export interface MigrationCommand {
  up: string | object;
  down: string | object;
}

import { type Result, ok, safeAsync } from "nomo/result";
import { sql as sqlBuilder, Dialect } from "nomo/sql";

/**
 * Interface for migrations that can be altered
 */
export interface TableAltererMigration {
  addColumn(
    tableName: string,
    name: string,
    type: string,
    options?: ColumnOptions,
  ): Promise<Result<void>>;
  removeColumn(
    tableName: string,
    name: string,
    type?: string,
    options?: ColumnOptions,
  ): Promise<Result<void>>;
  renameColumn(tableName: string, oldName: string, newName: string): Promise<Result<void>>;
  addIndex(
    tableName: string,
    columns: string | string[],
    options?: { name?: string; unique?: boolean },
  ): Promise<Result<void>>;
  removeIndex(
    tableName: string,
    columns: string | string[],
    options?: { name?: string; unique?: boolean },
  ): Promise<Result<void>>;
  addForeignKey(
    tableName: string,
    toTable: string,
    options: {
      column: string;
      onDelete?: string;
      onUpdate?: string;
      name?: string;
    },
  ): Promise<Result<void>>;
  removeForeignKey(
    tableName: string,
    options: { column?: string; name?: string },
  ): Promise<Result<void>>;
  changeColumn(
    tableName: string,
    name: string,
    type: string,
    options?: ColumnOptions,
  ): Promise<Result<void>>;
  changeColumnDefault(tableName: string, name: string, val: unknown): Promise<Result<void>>;
  changeColumnNull(tableName: string, name: string, nullable: boolean): Promise<Result<void>>;
  recreateTable(tableName: string, callback: (t: TableBuilder) => void): Promise<Result<void>>;
  changeTable(
    tableName: string,
    callback: (t: TableAlterer) => Promise<Result<void>> | Promise<void> | void,
  ): Promise<Result<void>>;
}

/**
 * Helper class for modifying existing tables
 */
export class TableAlterer {
  constructor(
    private tableName: string,
    private migration: TableAltererMigration,
  ) {}

  addColumn(name: string, type: string, options: ColumnOptions = {}): Promise<Result<void>> {
    return this.migration.addColumn(this.tableName, name, type, options);
  }

  removeColumn(name: string, type?: string, options: ColumnOptions = {}): Promise<Result<void>> {
    return this.migration.removeColumn(this.tableName, name, type, options);
  }

  renameColumn(oldName: string, newName: string): Promise<Result<void>> {
    return this.migration.renameColumn(this.tableName, oldName, newName);
  }

  addIndex(
    columns: string | string[],
    options: { name?: string; unique?: boolean } = {},
  ): Promise<Result<void>> {
    return this.migration.addIndex(this.tableName, columns, options);
  }

  removeIndex(
    columns: string | string[],
    options: { name?: string; unique?: boolean } = {},
  ): Promise<Result<void>> {
    return this.migration.removeIndex(this.tableName, columns, options);
  }

  addForeignKey(
    toTable: string,
    options: {
      column: string;
      toColumn?: string;
      onDelete?: string;
      name?: string;
    },
  ): Promise<Result<void>> {
    return this.migration.addForeignKey(this.tableName, toTable, options);
  }

  removeForeignKey(options: { name?: string; column?: string }): Promise<Result<void>> {
    return this.migration.removeForeignKey(this.tableName, options);
  }

  changeColumn(name: string, type: string, options: ColumnOptions = {}): Promise<Result<void>> {
    return this.migration.changeColumn(this.tableName, name, type, options);
  }

  changeColumnDefault(name: string, value: unknown): Promise<Result<void>> {
    return this.migration.changeColumnDefault(this.tableName, name, value);
  }

  changeColumnNull(name: string, nullable: boolean): Promise<Result<void>> {
    return this.migration.changeColumnNull(this.tableName, name, nullable);
  }

  recreateTable(callback: (t: TableBuilder) => void): Promise<Result<void>> {
    return this.migration.recreateTable(this.tableName, callback);
  }
}

import { SqlGenerator } from "./sql";
import { HandlerFunc } from "./handlers";

/**
 * Minimal database interface required by the runner
 */
export interface Database {
  run(sql: SqlExpression): Promise<Result<unknown>>;
  all(sql: SqlExpression): Promise<Result<unknown[]>>;
  batch?(statements: SqlExpression[]): Promise<Result<unknown[]>>;
}

/**
 * Options for join table creation
 */
export interface JoinTableOptions {
  tableName?: string;
  columnNames?: [string, string];
  columnOptions?: ColumnOptions;
  indexes?: boolean;
}

/**
 * Base Migration class
 */
export abstract class Migration implements TableAltererMigration {
  public abstract readonly version: string;
  public readonly durableObjectClass?: string;
  public change(): void | Promise<void> | Promise<Result<void>> {}

  protected _isUp = true;
  protected _commands: MigrationCommand[] = [];
  protected _sql: SqlGenerator;
  protected _inChange: boolean = false;

  constructor(
    protected db: Database,
    protected dialect: Dialect = "sqlite",
  ) {
    this._sql = new SqlGenerator(dialect);
  }

  /**
   * Register a custom command handler for this migration.
   */
  registerHandler(type: string, handler: HandlerFunc) {
    this._sql.registerHandler(type, handler);
  }

  /**
   * Register a custom type mapping for this migration.
   */
  registerType(type: string, dbType: string) {
    this._sql.registerType(type, dbType);
  }

  async up(): Promise<Result<void>> {
    this._isUp = true;
    this._inChange = true;
    const res = await safeAsync(async () => await this.change());
    this._inChange = false;
    if (!res.success) return res as Result<never>;
    return await this.executeCommands();
  }

  async down(): Promise<Result<void>> {
    this._isUp = false;
    this._inChange = true;
    const res = await safeAsync(async () => await this.change());
    this._inChange = false;
    if (!res.success) return res as Result<never>;
    return await this.executeCommands();
  }

  protected async transaction(callback: () => Promise<void> | void): Promise<Result<void>> {
    this._commands.push({ up: "BEGIN TRANSACTION;", down: "" });
    const res = await safeAsync(async () => await callback());
    if (!res.success) {
      this._commands.push({ up: "ROLLBACK;", down: "" });
      return res as Result<never>;
    }
    this._commands.push({ up: "COMMIT;", down: "" });
    return ok(undefined);
  }

  protected async reversible(callbacks: {
    up?: () => Promise<void> | void;
    down?: () => Promise<void> | void;
  }) {
    if (this._isUp && callbacks.up) {
      await callbacks.up();
    } else if (!this._isUp && callbacks.down) {
      await callbacks.down();
    }
  }

  public async createTable(
    name: string,
    options: TableOptions,
    callback: (t: TableBuilder) => void,
  ): Promise<Result<void>>;
  public async createTable(
    name: string,
    callback: (t: TableBuilder) => void,
  ): Promise<Result<void>>;
  public async createTable(
    name: string,
    arg2: TableOptions | ((t: TableBuilder) => void),
    arg3?: (t: TableBuilder) => void,
  ): Promise<Result<void>> {
    const options: TableOptions = typeof arg2 === "function" ? {} : arg2;
    const callback = typeof arg2 === "function" ? arg2 : (arg3 as (t: TableBuilder) => void);

    const t = new TableBuilder(name, options);
    callback(t);

    this._commands.push({
      up: { type: "createTable", name, table: t },
      down: { type: "dropTable", name },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async createVirtualTable(
    name: string,
    moduleName: string,
    callback: (t: VirtualTableBuilder) => void,
  ): Promise<Result<void>> {
    const t = new VirtualTableBuilder(name, moduleName);
    callback(t);

    this._commands.push({
      up: { type: "createVirtualTable", name, builder: t },
      down: { type: "dropTable", name },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async createView(name: string, definition: string | SqlExpression): Promise<Result<void>> {
    this._commands.push({
      up: { type: "createView", name, definition },
      down: { type: "dropView", name },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async dropView(name: string, definition?: string | SqlExpression): Promise<Result<void>> {
    this._commands.push({
      up: { type: "dropView", name },
      down: { type: "createView", name, definition },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async dropTable(
    name: string,
    callback?: (t: TableBuilder) => void,
  ): Promise<Result<void>> {
    let t: TableBuilder | undefined;
    if (callback) {
      t = new TableBuilder(name, { id: false });
      callback(t);
    }

    this._commands.push({
      up: { type: "dropTable", name },
      down: { type: "createTable", name, table: t },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async addColumn(
    tableName: string,
    name: string,
    type: string,
    options: ColumnOptions = {},
  ): Promise<Result<void>> {
    this._commands.push({
      up: { type: "addColumn", tableName, name, columnType: type, options },
      down: { type: "removeColumn", tableName, name },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async removeColumn(
    tableName: string,
    name: string,
    type?: string,
    options: ColumnOptions = {},
  ): Promise<Result<void>> {
    this._commands.push({
      up: { type: "removeColumn", tableName, name },
      down: { type: "addColumn", tableName, name, columnType: type, options },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async renameColumn(
    tableName: string,
    oldName: string,
    newName: string,
  ): Promise<Result<void>> {
    this._commands.push({
      up: { type: "renameColumn", tableName, from: oldName, to: newName },
      down: { type: "renameColumn", tableName, from: newName, to: oldName },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async renameTable(oldName: string, newName: string): Promise<Result<void>> {
    this._commands.push({
      up: { type: "renameTable", from: oldName, to: newName },
      down: { type: "renameTable", from: newName, to: oldName },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async changeColumn(
    tableName: string,
    name: string,
    type: string,
    options: ColumnOptions = {},
  ): Promise<Result<void>> {
    if (this.dialect === "sqlite") {
      const pragma = `PRAGMA table_info(${this._sql.strategy.quoteIdentifier(tableName)})`;
      const infoRes = await this.db.all(sql.raw(pragma));
      if (!infoRes.success) return infoRes as Result<never>;
      const info = infoRes.data as any[];

      await this.recreateTable(tableName, (t) => {
        for (const col of info) {
          if (col.name === name) {
            t.column(name, type, options);
          } else {
            t.column(col.name, col.type, {
              notNull: col.notnull === 1,
              primaryKey: col.pk === 1,
              default: col.dflt_value,
            });
          }
        }
      });
      return ok(undefined);
    } else {
      this._commands.push({
        up: {
          type: "changeColumn",
          tableName,
          name,
          columnType: type,
          options,
        },
        down: { type: "changeColumn", tableName, name },
      });
      if (!this._inChange) return await this.executeCommands();
      return ok(undefined);
    }
  }

  public async changeColumnDefault(
    tableName: string,
    name: string,
    val: unknown,
  ): Promise<Result<void>> {
    if (this.dialect === "sqlite") {
      const pragma = `PRAGMA table_info(${this._sql.strategy.quoteIdentifier(tableName)})`;
      const infoRes = await this.db.all(sql.raw(pragma));
      if (!infoRes.success) return infoRes as Result<never>;
      const info = infoRes.data as any[];

      await this.recreateTable(tableName, (t) => {
        for (const col of info) {
          if (col.name === name) {
            t.column(name, col.type, {
              notNull: col.notnull === 1,
              primaryKey: col.pk === 1,
              default: val,
            });
          } else {
            t.column(col.name, col.type, {
              notNull: col.notnull === 1,
              primaryKey: col.pk === 1,
              default: col.dflt_value,
            });
          }
        }
      });
      return ok(undefined);
    } else {
      this._commands.push({
        up: { type: "changeColumnDefault", tableName, name, value: val },
        down: { type: "changeColumnDefault", tableName, name },
      });
      if (!this._inChange) return await this.executeCommands();
      return ok(undefined);
    }
  }

  public async changeColumnNull(
    tableName: string,
    name: string,
    nullable: boolean,
  ): Promise<Result<void>> {
    if (this.dialect === "sqlite") {
      const pragma = `PRAGMA table_info(${this._sql.strategy.quoteIdentifier(tableName)})`;
      const infoRes = await this.db.all(sql.raw(pragma));
      if (!infoRes.success) return infoRes as Result<never>;
      const info = infoRes.data as any[];

      await this.recreateTable(tableName, (t) => {
        for (const col of info) {
          if (col.name === name) {
            t.column(name, col.type, {
              notNull: !nullable,
              primaryKey: col.pk === 1,
              default: col.dflt_value,
            });
          } else {
            t.column(col.name, col.type, {
              notNull: col.notnull === 1,
              primaryKey: col.pk === 1,
              default: col.dflt_value,
            });
          }
        }
      });
      return ok(undefined);
    } else {
      this._commands.push({
        up: { type: "changeColumnNull", tableName, name, nullable },
        down: { type: "changeColumnNull", tableName, name },
      });
      if (!this._inChange) return await this.executeCommands();
      return ok(undefined);
    }
  }

  public async addIndex(
    tableName: string,
    columns: string | string[],
    options: { name?: string; unique?: boolean } = {},
  ): Promise<Result<void>> {
    const cols = Array.isArray(columns) ? columns : [columns];
    this._commands.push({
      up: { type: "addIndex", tableName, columns: cols, options },
      down: { type: "removeIndex", tableName, columns: cols, options },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async removeIndex(
    tableName: string,
    columns: string | string[],
    options: { name?: string; unique?: boolean } = {},
  ): Promise<Result<void>> {
    const cols = Array.isArray(columns) ? columns : [columns];
    this._commands.push({
      up: { type: "removeIndex", tableName, columns: cols, options },
      down: { type: "addIndex", tableName, columns: cols, options },
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  public async addForeignKey(
    tableName: string,
    toTable: string,
    options: {
      column: string;
      onDelete?: string;
      onUpdate?: string;
      name?: string;
    },
  ): Promise<Result<void>> {
    if (this.dialect === "sqlite") {
      const pragma = `PRAGMA table_info(${this._sql.strategy.quoteIdentifier(tableName)})`;
      const infoRes = await this.db.all(sql.raw(pragma));
      if (!infoRes.success) return infoRes as Result<never>;
      const info = infoRes.data as any[];

      await this.recreateTable(tableName, (t) => {
        for (const col of info) {
          t.column(col.name, col.type, {
            notNull: col.notnull === 1,
            primaryKey: col.pk === 1,
            default: col.dflt_value,
          });
          if (col.name === options.column) {
            t.foreignKeys.push(
              new ForeignKey(options.column, toTable, "id", {
                onDelete: options.onDelete,
                onUpdate: options.onUpdate,
                name: options.name,
              }),
            );
          }
        }
      });
      return ok(undefined);
    } else {
      this._commands.push({
        up: { type: "addForeignKey", tableName, toTable, options },
        down: { type: "removeForeignKey", tableName, options },
      });
      if (!this._inChange) return await this.executeCommands();
      return ok(undefined);
    }
  }

  public async removeForeignKey(
    tableName: string,
    options: { column?: string; name?: string },
  ): Promise<Result<void>> {
    if (this.dialect === "sqlite") {
      const pragma = `PRAGMA table_info(${this._sql.strategy.quoteIdentifier(tableName)})`;
      const infoRes = await this.db.all(sql.raw(pragma));
      if (!infoRes.success) return infoRes as Result<never>;
      const info = infoRes.data as any[];

      await this.recreateTable(tableName, (t) => {
        for (const col of info) {
          // We just don't add the FK back.
          // Note: This logic is simple and assumes TableBuilder starts fresh.
          t.column(col.name, col.type, {
            notNull: col.notnull === 1,
            primaryKey: col.pk === 1,
            default: col.dflt_value,
          });
        }
      });
      return ok(undefined);
    } else {
      this._commands.push({
        up: { type: "removeForeignKey", tableName, options },
        down: {
          type: "addForeignKey",
          tableName,
          options: { ...options, toTable: "" },
        },
      });
      if (!this._inChange) return await this.executeCommands();
      return ok(undefined);
    }
  }

  protected createJoinTable(table1: string, table2: string, options: JoinTableOptions = {}) {
    const name = options.tableName || `${table1}_${table2}`.split("_").sort().join("_");
    this.createTable(name, { id: false }, (t) => {
      const col1 = options.columnNames?.[0] || `${table1.replace(/s$/, "")}_id`;
      const col2 = options.columnNames?.[1] || `${table2.replace(/s$/, "")}_id`;
      t.integer(col1, options.columnOptions);
      t.integer(col2, options.columnOptions);
      if (options.indexes !== false) {
        t.index([col1, col2]);
      }
    });
  }

  public async recreateTable(
    name: string,
    callback: (t: TableBuilder) => void,
  ): Promise<Result<void>> {
    const t = new TableBuilder(name, { id: false });
    callback(t);

    this._commands.push({
      up: { type: "recreateTable", name, table: t },
      down: { type: "recreateTable", name, table: null as any }, // Down needs the previous state, which we don't know here
    });
    if (!this._inChange) return await this.executeCommands();
    return ok(undefined);
  }

  protected async execute(sqlStr: string) {
    if (this._isUp) {
      this._commands.push({ up: sqlStr, down: "" });
    } else {
      this._commands.push({ up: "", down: sqlStr });
    }
  }

  public async changeTable(
    name: string,
    callback: (t: TableAlterer) => Promise<Result<void>> | Promise<void> | void,
  ): Promise<Result<void>> {
    const alterer = new TableAlterer(name, this);
    const res = await safeAsync(async () => await callback(alterer));
    if (!res.success) return res as Result<never>;
    return ok(undefined);
  }

  /**
   * Get the SQL statements for this migration without executing them
   */
  async toSql(direction: Direction = "up"): Promise<Result<string[]>> {
    this._isUp = direction === "up";
    this._inChange = true;
    const res = await safeAsync(async () => await this.change());
    this._inChange = false;
    if (!res.success) return res as Result<never>;

    const statementsRes = this.getSqlStatements();
    if (!statementsRes.success) return statementsRes;

    return ok(statementsRes.data);
  }

  protected getSqlStatements(): Result<string[]> {
    const statements: string[] = [];
    const commands = this._isUp ? this._commands : [...this._commands].reverse();

    for (const cmd of commands) {
      const action = this._isUp ? cmd.up : cmd.down;
      if (typeof action === "string" && action) {
        statements.push(action);
      } else if (typeof action === "object" && action !== null) {
        const res = this._sql.generate(action);
        if (!res.success) return res as Result<never>;
        if (res.data) {
          statements.push(res.data);
        }
      }
    }
    return ok(statements);
  }

  protected async executeCommands(): Promise<Result<void>> {
    const statementsRes = this.getSqlStatements();
    if (!statementsRes.success) return statementsRes as Result<never>;

    for (const statement of statementsRes.data) {
      const res = await this.db.run({ sql: statement, __isSql: true });
      if (!res.success) return res as Result<never>;
    }
    this._commands = [];
    return ok(undefined);
  }

  /**
   * Get relationship metadata for all tables defined/altered in this migration
   */
  public getMetadata(): Record<string, Relationship[]> {
    const metadata: Record<string, Relationship[]> = {};
    for (const cmd of this._commands) {
      const action = cmd.up;
      if (typeof action === "object" && action !== null) {
        if ("table" in action && action.table instanceof TableBuilder) {
          const t = action.table as TableBuilder;
          if (t.relationships.length > 0) {
            metadata[t.tableName] = [...(metadata[t.tableName] || []), ...t.relationships];
          }
        }
      }
    }
    return metadata;
  }
}

export { MigrationRunner } from "./runner";
export { migrateDO, type DOMigration, type SqlStorage } from "./durable";
export { STANDARD_HANDLERS, type HandlerFunc } from "./handlers";
export {
  Statement,
  Composite,
  SqlPart,
  Identifier,
  Literal,
  Keyword,
  Raw,
  sql as sqlBuilder,
} from "nomo/sql";
