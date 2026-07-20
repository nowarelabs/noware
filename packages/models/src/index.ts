import type { EnvLike, ModelContext, RequestLike } from "@nowarelabs/shared";

export type DatabaseInstance = {
  prepare?: (sql: string) => {
    bind: (...params: any[]) => { all: () => Promise<{ results: any[] }> };
  };
  all?: (query: { sql: string; __isSql: true }) => Promise<{ success: boolean; data: any[] }>;
  exec?: (sql: string) => { toArray: () => any[] };
  execSql?: (sql: string) => Promise<any[]>;
};

export interface ModelDbInit {
  db: DatabaseInstance;
  table: any;
  request?: RequestLike;
  env?: EnvLike;
  ctx?: ModelContext;
}

export interface ModelRequestInit {
  request: RequestLike;
  env: EnvLike;
  ctx?: ModelContext;
}

export type ModelInit = ModelDbInit | ModelRequestInit;

export interface DialectStrategy {
  dialect: "sqlite" | "postgres";
}

export function getDialectStrategy(dialect: "sqlite" | "postgres" = "sqlite"): DialectStrategy {
  return { dialect };
}

// Minimal SQL builder and compiler mimicking @noblackbox/sql
export class SqlPart {
  constructor(
    public type: string,
    public value: any,
  ) {}
}

export class Statement {
  public parts: SqlPart[] = [];
  constructor(parts: SqlPart[] = []) {
    this.parts = [...parts];
  }
  append(...parts: (SqlPart | Statement)[]) {
    for (const part of parts) {
      if (part instanceof Statement) {
        this.parts.push(...part.parts);
      } else {
        this.parts.push(part);
      }
    }
    return this;
  }
  toSql(_strategy?: DialectStrategy): {
    success: boolean;
    data: { value: string };
    params: any[];
    message?: string;
  } {
    try {
      const { sql: sqlStr, params } = compileSqlParts(this.parts);
      return { success: true, data: { value: sqlStr }, params };
    } catch (e: any) {
      return { success: false, data: { value: "" }, params: [], message: e.message };
    }
  }
}

export const sql = {
  statement(parts?: SqlPart[]): Statement {
    return new Statement(parts);
  },
  raw(value: string): SqlPart {
    return new SqlPart("raw", value);
  },
  id(value: string): SqlPart {
    return new SqlPart("id", value);
  },
  composite(...parts: SqlPart[]): SqlPart {
    return new SqlPart("composite", parts);
  },
  key(value: string): SqlPart {
    return new SqlPart("key", value);
  },
  val(value: any): SqlPart {
    return new SqlPart("val", value);
  },
  op(value: string): SqlPart {
    return new SqlPart("op", value);
  },
  join(parts: SqlPart[], sep: SqlPart): SqlPart {
    return new SqlPart("join", { parts, sep });
  },
  nl(): SqlPart {
    return new SqlPart("nl", null);
  },
};

function compileSqlParts(parts: SqlPart[]): { sql: string; params: any[] } {
  const params: any[] = [];
  const sql = parts.map((part) => compileSqlPart(part, params)).join("");
  return { sql, params };
}

function compileSqlPart(part: SqlPart, params: any[]): string {
  switch (part.type) {
    case "raw":
    case "key":
    case "op":
      return String(part.value);
    case "nl":
      return "\n";
    case "id":
      return escapeId(String(part.value));
    case "val":
      params.push(part.value);
      return `__PH_${params.length - 1}__`;
    case "composite":
      return (part.value as SqlPart[]).map((p) => compileSqlPart(p, params)).join("");
    case "join": {
      const { parts, sep } = part.value as { parts: SqlPart[]; sep: SqlPart };
      return parts.map((p) => compileSqlPart(p, params)).join(compileSqlPart(sep, params));
    }
    default:
      return "";
  }
}

function interpolateSql(sql: string, params: any[]): string {
  return sql.replace(/__PH_(\d+)__/g, (_, index) => escapeVal(params[Number(index)]));
}

function toPositionalSql(sql: string, dialect: "sqlite" | "postgres" = "sqlite"): string {
  if (dialect === "postgres") {
    return sql.replace(/__PH_(\d+)__/g, (_, index) => `$${Number(index) + 1}`);
  }
  return sql.replace(/__PH_(\d+)__/g, "?");
}

function escapeId(id: string): string {
  if (id === "*") return "*";
  if (id.includes(".*")) {
    return id
      .split(".")
      .map((part) => (part === "*" ? "*" : `"${part.replace(/"/g, '""')}"`))
      .join(".");
  }
  return id
    .split(".")
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(".");
}

function escapeVal(val: any): string {
  if (val === null || val === undefined) {
    return "NULL";
  }
  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }
  if (typeof val === "number") {
    return String(val);
  }
  if (typeof val === "string") {
    return `'${val.replace(/'/g, "''")}'`;
  }
  if (val instanceof Date) {
    return `'${val.toISOString().replace(/'/g, "''")}'`;
  }
  if (Array.isArray(val)) {
    return `(${val.map((v) => escapeVal(v)).join(", ")})`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function getTableName(table: any): string {
  if (!table) return "";
  if (typeof table === "string") return table;
  if (table.tableName) return table.tableName;
  if (table.name) return table.name;
  if (typeof table.toString === "function") {
    const str = table.toString();
    if (str && str !== "[object Object]") return str;
  }
  return "";
}

// Only the db.prepare path uses real parameterized queries (via .bind()).
// The execSql/all/exec paths cannot accept bound params in their target runtimes
// (D1 raw exec, DO storage), so they fall back to interpolateSql which builds
// a string using escapeVal. The __PH_N__ placeholders in the compiled SQL are
// replaced with either bound params (prepare) or interpolated literals (others).
async function execRaw(
  db: DatabaseInstance,
  sqlText: string,
  params: any[] = [],
  dialect: "sqlite" | "postgres" = "sqlite",
): Promise<any[]> {
  if (db.prepare) {
    const positionalSql = toPositionalSql(sqlText, dialect);
    const stmt = db.prepare(positionalSql).bind(...params);
    const res = await stmt.all();
    return res.results || res;
  }
  const sql = params.length > 0 ? interpolateSql(sqlText, params) : sqlText;
  if (db.execSql) return db.execSql(sql);
  if (db.all) {
    const res = await db.all({ sql, __isSql: true });
    return (res as any).success ? (res as any).data : (res as any);
  }
  if (db.exec) return db.exec(sql).toArray();
  throw new Error("No execution driver available");
}

// Fallback Logger matching @noblackbox/logger
export class Logger {
  public service?: string;
  public context?: any;
  constructor(public options?: { service?: string; context?: any }) {
    this.service = options?.service;
    this.context = options?.context;
  }
  info(msg: string, ...args: any[]) {
    console.info(`[INFO] ${msg}`, ...args);
  }
  debug(msg: string, ...args: any[]) {
    console.debug(`[DEBUG] ${msg}`, ...args);
  }
  error(msg: string, ...args: any[]) {
    console.error(`[ERROR] ${msg}`, ...args);
  }
  warn(msg: string, ...args: any[]) {
    console.warn(`[WARN] ${msg}`, ...args);
  }
}

// Custom exception classes
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ConstraintError extends Error {
  constructor(
    message: string,
    public type: string,
    public details?: any,
  ) {
    super(message);
    this.name = "ConstraintError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export const ABORT = Symbol("abort");

export class CallbackAbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallbackAbortError";
  }
}

export type RelationshipType =
  | "belongs_to"
  | "has_one"
  | "has_many"
  | "has_many_through"
  | "has_one_through"
  | "has_and_belongs_to_many";

export interface RelationshipMetadata {
  type: RelationshipType;
  model: string;
  foreignKey?: string;
  through?: string;
  source?: string;
  on?: string;
}

export type CallbackEvent =
  | "beforeValidation"
  | "afterValidation"
  | "beforeSave"
  | "afterSave"
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDestroy"
  | "afterDestroy"
  | "afterCommit"
  | "afterCreateCommit"
  | "afterUpdateCommit"
  | "afterSaveCommit"
  | "afterDestroyCommit"
  | "afterRollback";

export interface CallbackOptions {
  on?: "create" | "update" | "destroy" | Array<"create" | "update" | "destroy">;
  if?: string | ((record: any) => boolean | Promise<boolean>);
  unless?: string | ((record: any) => boolean | Promise<boolean>);
}

interface CallbackEntry {
  fn: string | ((this: any, data: any) => void | Promise<void>);
  options?: CallbackOptions;
}

export class FluentQuery<TTable = any, TSelect = any> {
  private strategy: DialectStrategy;
  private selection: SqlPart[] = [];
  private whereClauses: any[] = [];
  private orderClauses: SqlPart[] = [];
  private joinClauses: SqlPart[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private loadWith: string[] = [];
  private loadStrategy: "separate_queries" | "joins" | "auto" = "auto";
  private relationships: Record<string, RelationshipMetadata> = {};

  constructor(
    private db: DatabaseInstance,
    private table: TTable,
    private logger?: Logger,
    dialect: "sqlite" | "postgres" = "sqlite",
  ) {
    this.strategy = getDialectStrategy(dialect);
  }

  setRelationships(rels: Record<string, RelationshipMetadata>): this {
    this.relationships = rels;
    return this;
  }

  select(...columns: (keyof TSelect | "*")[]): this {
    if (columns.includes("*")) {
      this.selection = [sql.raw("*")];
    } else {
      this.selection = columns.map((c) => sql.id(String(c)));
    }
    return this;
  }

  join(table: any, on: string): this {
    const tableName = getTableName(table);
    this.joinClauses.push(
      sql.composite(sql.key(" JOIN "), sql.id(tableName), sql.key(" ON "), sql.raw(on)),
    );
    return this;
  }

  where(
    conditions: Record<string, any> | SqlPart | ((q: FluentQuery<TTable, TSelect>) => any),
  ): this {
    return this.addWhereClause("AND", conditions);
  }

  orWhere(
    conditions: Record<string, any> | SqlPart | ((q: FluentQuery<TTable, TSelect>) => any),
  ): this {
    return this.addWhereClause("OR", conditions);
  }

  private addWhereClause(
    type: "AND" | "OR",
    conditions: Record<string, any> | SqlPart | ((q: FluentQuery<TTable, TSelect>) => any),
  ): this {
    if (typeof conditions === "function") {
      const subQuery = new FluentQuery<TTable, TSelect>(this.db, this.table, this.logger);
      conditions(subQuery);
      if (subQuery.whereClauses.length > 0) {
        const subParts: SqlPart[] = [];
        const first = subQuery.whereClauses[0];
        const firstPart = first instanceof SqlPart ? first : first.part;
        subParts.push(firstPart);
        for (let i = 1; i < subQuery.whereClauses.length; i++) {
          const item = subQuery.whereClauses[i];
          if (item instanceof SqlPart) {
            subParts.push(sql.op(" AND "), item);
          } else {
            subParts.push(sql.op(` ${item.type} `), item.part);
          }
        }
        this.whereClauses.push({
          type,
          part: sql.composite(sql.op("("), ...subParts, sql.op(")")),
        });
      }
    } else if (conditions instanceof SqlPart) {
      this.whereClauses.push({ type, part: conditions });
    } else {
      const parts = Object.entries(conditions).map(([k, v]) => {
        if (v !== null && typeof v === "object" && "neq" in v) {
          return sql.composite(sql.id(k), sql.op(" IS NOT "), sql.val(v.neq));
        }
        if (v !== null && typeof v === "object" && "eq" in v) {
          return sql.composite(sql.id(k), sql.op(" = "), sql.val(v.eq));
        }
        if (v !== null && typeof v === "object" && "gt" in v) {
          return sql.composite(sql.id(k), sql.op(" > "), sql.val(v.gt));
        }
        if (v !== null && typeof v === "object" && "gte" in v) {
          return sql.composite(sql.id(k), sql.op(" >= "), sql.val(v.gte));
        }
        if (v !== null && typeof v === "object" && "lt" in v) {
          return sql.composite(sql.id(k), sql.op(" < "), sql.val(v.lt));
        }
        if (v !== null && typeof v === "object" && "lte" in v) {
          return sql.composite(sql.id(k), sql.op(" <= "), sql.val(v.lte));
        }
        if (v !== null && typeof v === "object" && "like" in v) {
          return sql.composite(sql.id(k), sql.op(" LIKE "), sql.val(v.like));
        }
        if (v !== null && typeof v === "object" && "in" in v && Array.isArray(v.in)) {
          const valParts = v.in.map((val: any) => sql.val(val));
          return sql.composite(
            sql.id(k),
            sql.op(" IN ("),
            sql.join(valParts, sql.op(", ")),
            sql.op(")"),
          );
        }
        if (v !== null && typeof v === "object" && "nin" in v && Array.isArray(v.nin)) {
          const valParts = v.nin.map((val: any) => sql.val(val));
          return sql.composite(
            sql.id(k),
            sql.op(" NOT IN ("),
            sql.join(valParts, sql.op(", ")),
            sql.op(")"),
          );
        }
        if (v === null) {
          return sql.composite(sql.id(k), sql.op(" IS NULL"));
        }
        return sql.composite(sql.id(k), sql.op(" = "), sql.val(v));
      });

      if (parts.length > 0) {
        if (type === "OR") {
          const combined = sql.join(parts, sql.op(" AND "));
          this.whereClauses.push({ type: "OR", part: combined });
        } else {
          for (const part of parts) {
            this.whereClauses.push({ type: "AND", part });
          }
        }
      }
    }
    return this;
  }

  orderBy(column: keyof TSelect, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderClauses.push(sql.composite(sql.id(String(column)), sql.key(" "), sql.key(direction)));
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  offset(n: number): this {
    this.offsetCount = n;
    return this;
  }

  with(...relations: string[]): this {
    this.loadWith = relations;
    this.loadStrategy = "auto";
    return this;
  }

  withJoins(...relations: string[]): this {
    this.loadWith = relations;
    this.loadStrategy = "joins";
    return this;
  }

  withSeparateQueries(...relations: string[]): this {
    this.loadWith = relations;
    this.loadStrategy = "separate_queries";
    return this;
  }

  selectColumnValues<K extends keyof TSelect>(column: K): Promise<TSelect[K][]> {
    return this.pluck(column);
  }

  private appendWhere(s: Statement): void {
    if (this.whereClauses.length === 0) return;
    s.append(sql.nl(), sql.key("WHERE "));
    const first = this.whereClauses[0];
    const firstPart = first instanceof SqlPart ? first : first.part;
    s.append(firstPart);
    for (let i = 1; i < this.whereClauses.length; i++) {
      const item = this.whereClauses[i];
      if (item instanceof SqlPart) {
        s.append(sql.op(" AND "), item);
      } else {
        s.append(sql.op(` ${item.type} `), item.part);
      }
    }
  }

  private build(): Statement {
    const tableName = getTableName(this.table);
    const s = sql.statement();

    // Guard: withJoins + has_many + limit/offset breaks LIMIT semantics
    if (
      this.loadStrategy === "joins" &&
      (this.limitCount !== undefined || this.offsetCount !== undefined)
    ) {
      for (const relName of this.loadWith) {
        const rel = this.relationships[relName];
        if (
          rel &&
          (rel.type === "has_many" ||
            rel.type === "has_many_through" ||
            rel.type === "has_and_belongs_to_many")
        ) {
          throw new Error(
            `withJoins("${relName}") with ${rel.type} relation cannot be combined with limit/offset. ` +
              `Fan-out from joined rows breaks LIMIT semantics. Use withSeparateQueries instead.`,
          );
        }
      }
    }

    // SELECT
    s.append(sql.key("SELECT "));

    if (this.loadStrategy === "joins" && this.loadWith.length > 0) {
      // Main table: unaliased .*
      const selectParts: SqlPart[] = [sql.composite(sql.id(tableName), sql.op(".*"))];
      // Related tables: alias each column as relName__col
      for (const relName of this.loadWith) {
        const rel = this.relationships[relName];
        if (!rel) continue;
        const relColumns = this.getColumnsFor(rel.model);
        for (const col of relColumns) {
          selectParts.push(
            sql.composite(
              sql.id(`${relName}.${col}`),
              sql.key(" AS "),
              sql.id(`${relName}__${col}`),
            ),
          );
        }
      }
      s.append(sql.join(selectParts, sql.op(", ")));
    } else if (this.selection.length > 0) {
      s.append(sql.join(this.selection, sql.op(", ")));
    } else {
      s.append(sql.raw("*"));
    }

    // FROM
    s.append(sql.nl(), sql.key("FROM "), sql.id(tableName));

    // JOIN
    if (this.joinClauses.length > 0) {
      this.joinClauses.forEach((j) => s.append(sql.nl(), j));
    }

    // Auto-generate JOINs for eager loading
    if (this.loadStrategy === "joins" && this.loadWith.length > 0) {
      for (const relName of this.loadWith) {
        const rel = this.relationships[relName];
        if (!rel) continue;

        const relTableName = getTableName(BaseModel.registry[rel.model]?.tableName) || rel.model;
        const fk = rel.foreignKey || `${relName}_id`;
        const [leftCol, rightCol] =
          rel.type === "belongs_to"
            ? [fk, "id"] // fk lives on tableName; related's PK is "id"
            : ["id", fk]; // tableName's PK is "id"; fk lives on relName

        s.append(sql.nl());
        s.append(
          sql.composite(
            sql.key("LEFT JOIN "),
            sql.id(relTableName),
            sql.key(" AS "),
            sql.id(relName),
            sql.key(" ON "),
            sql.composite(
              sql.id(tableName),
              sql.op("."),
              sql.id(leftCol),
              sql.op(" = "),
              sql.id(relName),
              sql.op("."),
              sql.id(rightCol),
            ),
          ),
        );
      }
    }

    // WHERE
    this.appendWhere(s);

    // ORDER BY
    if (this.orderClauses.length > 0) {
      s.append(sql.nl(), sql.key("ORDER BY "));
      s.append(sql.join(this.orderClauses, sql.op(", ")));
    }

    // LIMIT
    if (this.limitCount !== undefined) {
      s.append(sql.nl(), sql.key("LIMIT "), sql.raw(String(this.limitCount)));
    }

    // OFFSET
    if (this.offsetCount !== undefined) {
      s.append(sql.nl(), sql.key("OFFSET "), sql.raw(String(this.offsetCount)));
    }

    return s;
  }

  async all(): Promise<TSelect[]> {
    if (!this.db) {
      throw new Error("No database instance configuration found");
    }
    const tableName = getTableName(this.table);
    const finalStmt = this.build();
    const sqlRes = finalStmt.toSql(this.strategy);
    if (!sqlRes.success) throw new Error(sqlRes.message);
    const sqlText = sqlRes.data.value;
    const params = sqlRes.params;
    const start = Date.now();
    this.logger?.debug(`[QUERY] ${sqlText}`);

    let results: TSelect[] = [];
    results = (await execRaw(this.db, sqlText, params, this.strategy.dialect)) as TSelect[];

    // Eager load relations
    if (this.loadWith.length > 0 && results.length > 0) {
      if (this.loadStrategy === "joins") {
        results = await this.loadJoinedRelations(results);
      } else {
        results = await this.loadRelations(results);
      }
    }

    this.logger?.debug(
      `[QUERY RESULT] ${tableName} count=${results.length} duration_ms=${Date.now() - start}`,
    );
    return results;
  }

  private getColumnsFor(modelName: string): string[] {
    const regClass = BaseModel.registry[modelName];
    if (!regClass) {
      throw new Error(
        `withJoins requires model "${modelName}" to be registered via BaseModel.register(). ` +
          `Use withSeparateQueries instead.`,
      );
    }
    const instance = new regClass({ db: this.db, table: regClass.tableName });
    const cols = instance.columnNames;
    if (cols.length === 0) {
      throw new Error(
        `withJoins requires model "${modelName}" to define static columnTypes or a table shape. ` +
          `The model is registered but has no enumerable columns. Use withSeparateQueries instead.`,
      );
    }
    return cols;
  }

  private async loadJoinedRelations(rows: any[]): Promise<TSelect[]> {
    const byId = new Map<any, any>();

    for (const row of rows) {
      const id = row.id;
      if (!byId.has(id)) {
        const main: any = {};
        for (const k of Object.keys(row)) {
          if (!this.loadWith.some((r) => k.startsWith(`${r}__`))) main[k] = row[k];
        }
        for (const relName of this.loadWith) main[relName] = [];
        byId.set(id, main);
      }
      const main = byId.get(id);

      for (const relName of this.loadWith) {
        const prefix = `${relName}__`;
        const relRow: any = {};
        let hasData = false;
        for (const k of Object.keys(row)) {
          if (k.startsWith(prefix)) {
            const col = k.slice(prefix.length);
            relRow[col] = row[k];
            if (row[k] !== null) hasData = true;
          }
        }
        if (hasData) main[relName].push(relRow);
      }
    }

    return [...byId.values()];
  }

  private async loadRelations(results: TSelect[]): Promise<TSelect[]> {
    for (const relationName of this.loadWith) {
      const rel = this.relationships[relationName];
      if (!rel) {
        this.logger?.debug(`[LOAD] Unknown relation: ${relationName}`);
        continue;
      }

      const foreignKey = rel.foreignKey || `${relationName}_id`;

      // Determine local key and query key based on relationship type.
      // has_many/has_one: FK lives on the related table, so collect current model's PK
      // belongs_to: FK lives on the current table, so collect the FK values
      const isInverse =
        rel.type === "has_many" || rel.type === "has_one" || rel.type === "has_many_through";
      const localKey = isInverse ? "id" : foreignKey;
      const queryKey = isInverse ? foreignKey : "id";

      // Collect key values from current results
      const localKeys = [...new Set(results.map((r) => (r as any)[localKey]).filter(Boolean))];
      if (localKeys.length === 0) continue;

      // Resolve the related model instance
      let relTable = (this.db as any)[rel.model] || (this.db as any).query?.[rel.model];
      if (!relTable) {
        const regClass = BaseModel.registry[rel.model];
        if (regClass) {
          relTable = new regClass({ db: this.db, table: regClass.tableName });
        }
      }

      if (!relTable) {
        this.logger?.warn(`[LOAD] Related model not found: ${rel.model}`);
        continue;
      }

      let relatedResults: any[] = [];
      const relQuery = relTable.where?.({ [queryKey]: { in: localKeys } });

      if (relQuery?.all) {
        relatedResults = await relQuery.all();
      } else if (relTable.all) {
        relatedResults = await relTable.all();
      }

      // Group by the query key so we can match back to local results
      const grouped = new Map<any, any[]>();
      for (const item of relatedResults) {
        const fk = item[queryKey];
        if (!grouped.has(fk)) grouped.set(fk, []);
        grouped.get(fk)!.push(item);
      }

      for (const item of results) {
        const localVal = (item as any)[localKey];
        (item as any)[relationName] = grouped.get(localVal) || [];
      }

      this.logger?.debug(`[LOAD PRELOAD] ${relationName} count=${relatedResults.length}`);
    }

    return results;
  }

  async first(): Promise<TSelect | null> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[FIRST] ${tableName}`);
    this.limit(1);
    const results = await this.all();
    const record = results[0] || null;
    if (record) {
      this.logger?.debug(`[FIRST FOUND] ${tableName}`);
    } else {
      this.logger?.debug(`[FIRST NOT FOUND] ${tableName}`);
    }
    return record;
  }

  async findBy(
    conditions: Record<string, any>,
    options?: {
      offset?: number;
    },
  ): Promise<TSelect | null> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[FIND BY] ${tableName}`, { conditions, options });

    let query = this.where(conditions);

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query.first();
  }

  async findAllBy(
    conditions: Record<string, any>,
    options?: {
      orderBy?: { column: keyof TSelect; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    },
  ): Promise<TSelect[]> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[FIND ALL BY] ${tableName}`, { conditions, options });

    let query = this.where(conditions);

    if (options?.orderBy) {
      query = query.orderBy(options.orderBy.column, options.orderBy.direction || "ASC");
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query.all();
  }

  async count(): Promise<number> {
    const tableName = getTableName(this.table);
    const s = sql.statement([sql.key("SELECT COUNT(*) as count FROM "), sql.id(tableName)]);

    this.appendWhere(s);

    const sqlRes = s.toSql(this.strategy);
    if (!sqlRes.success) throw new Error(sqlRes.message);
    const sqlText = sqlRes.data.value;
    const params = sqlRes.params;

    const res = await execRaw(this.db, sqlText, params, this.strategy.dialect);
    return (res?.[0]?.count || 0) as number;
  }

  async countBy(conditions: Record<string, any>): Promise<number> {
    return this.where(conditions).count();
  }

  async findByIds(ids: (string | number)[]): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return this.where({ id: { in: ids } }).all();
  }

  async firstBy(conditions: Record<string, any>): Promise<TSelect | null> {
    return this.where(conditions).first();
  }

  async pluck<K extends keyof TSelect>(column: K): Promise<TSelect[K][]> {
    const tableName = getTableName(this.table);
    const s = sql.statement([
      sql.key("SELECT "),
      sql.id(String(column)),
      sql.key(" FROM "),
      sql.id(tableName),
    ]);

    this.appendWhere(s);

    if (this.orderClauses.length > 0) {
      s.append(sql.nl(), sql.key("ORDER BY "));
      s.append(sql.join(this.orderClauses, sql.op(", ")));
    }

    if (this.limitCount !== undefined) {
      s.append(sql.nl(), sql.key("LIMIT "), sql.raw(String(this.limitCount)));
    }

    if (this.offsetCount !== undefined) {
      s.append(sql.nl(), sql.key("OFFSET "), sql.raw(String(this.offsetCount)));
    }

    const sqlRes = s.toSql(this.strategy);
    if (!sqlRes.success) throw new Error(sqlRes.message);
    const sqlText = sqlRes.data.value;
    const params = sqlRes.params;

    const res = await execRaw(this.db, sqlText, params, this.strategy.dialect);
    return res.map((row: any) => row[String(column)]) as TSelect[K][];
  }

  toSql(): string {
    const finalStmt = this.build();
    const res = finalStmt.toSql(this.strategy);
    return res.success ? res.data.value : "";
  }

  clone(): FluentQuery<TTable, TSelect> {
    const cloned = new FluentQuery<TTable, TSelect>(this.db, this.table, this.logger);
    cloned.selection = [...this.selection];
    cloned.whereClauses = [...this.whereClauses];
    cloned.orderClauses = [...this.orderClauses];
    cloned.joinClauses = [...this.joinClauses];
    cloned.limitCount = this.limitCount;
    cloned.offsetCount = this.offsetCount;
    cloned.loadWith = [...this.loadWith];
    cloned.loadStrategy = this.loadStrategy;
    cloned.relationships = { ...this.relationships };
    return cloned;
  }

  async paginate(params: { page?: number; perPage?: number } = {}): Promise<{
    items: TSelect[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  }> {
    const perPage = params.perPage ?? 10;
    const total = await this.clone().count();
    const maxPage = Math.max(1, Math.ceil(total / perPage));
    const requestedPage = params.page ?? 1;
    const page = Math.min(Math.max(1, requestedPage), maxPage);
    const offset = (page - 1) * perPage;
    const items = await this.limit(perPage).offset(offset).all();
    return { items, total, page, perPage, totalPages: maxPage };
  }
}

export abstract class BaseModel<
  Ctx extends ModelContext = ModelContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
  Persistence = any,
  TTable = any,
  TSelect = any,
  TInsert = any,
> {
  static registry: Record<string, any> = {};

  static register(name: string, modelClass: any) {
    this.registry[name] = modelClass;
  }

  static columnTypes: Record<string, string> = {};

  protected abstract persistence: Persistence;

  public relationships: Record<string, RelationshipMetadata> = {};
  public table: any;
  protected request!: RequestLike;
  protected env!: EnvLike;
  protected ctx!: Ctx;

  private _db?: DatabaseInstance;
  private _inTransaction = false;
  private _transactionCallbacks: Array<{
    event: CallbackEvent;
    context: "create" | "update" | "destroy";
    data: any;
  }> = [];
  private _transactionOps: Array<{
    context: "create" | "update" | "destroy";
    data: any;
  }> = [];

  private callbacks: Record<CallbackEvent, CallbackEntry[]> = {
    beforeValidation: [],
    afterValidation: [],
    beforeSave: [],
    afterSave: [],
    beforeCreate: [],
    afterCreate: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDestroy: [],
    afterDestroy: [],
    afterCommit: [],
    afterCreateCommit: [],
    afterUpdateCommit: [],
    afterSaveCommit: [],
    afterDestroyCommit: [],
    afterRollback: [],
  };

  constructor(init: ModelInit) {
    if ("db" in init) {
      this._db = init.db;
      this.table = init.table;
      this.request = init.request as RequestLike;
      this.env = init.env as EnvLike;
      this.ctx = init.ctx as Ctx;
    } else {
      this.request = init.request;
      this.env = init.env;
      this.ctx = init.ctx as Ctx;
      const ctor = this.constructor as any;
      this.table = ctor.tableName || ctor.name;
    }
  }

  public get db(): any {
    if (this._db) return this._db;
    const p = this.getPersistence() as any;
    if (p) {
      if (p.db) return p.db;
      return p;
    }
    return undefined;
  }

  public set db(val: any) {
    this._db = val;
  }

  protected abstract getPersistence(): Persistence;

  public getRelations(): RelationshipMetadata[] {
    return Object.values(this.relationships);
  }

  public get columnNames(): string[] {
    if (this.table && typeof this.table === "object" && !Array.isArray(this.table)) {
      const keys = Object.keys(this.table);
      if (keys.length > 0) return keys;
    }
    const ctor = this.constructor as any;
    if (ctor.columnTypes) {
      return Object.keys(ctor.columnTypes);
    }
    return [];
  }

  protected belongsTo(name: string, options: { model: string; foreignKey?: string }) {
    this.relationships[name] = { type: "belongs_to", ...options };
  }

  protected hasOne(
    name: string,
    options: {
      model: string;
      foreignKey?: string;
      through?: string;
      source?: string;
    },
  ) {
    this.relationships[name] = { type: "has_one", ...options };
  }

  protected hasMany(
    name: string,
    options: {
      model: string;
      foreignKey?: string;
      through?: string;
      source?: string;
    },
  ) {
    this.relationships[name] = { type: "has_many", ...options };
  }

  protected hasAndBelongsToMany(
    name: string,
    options: { model: string; through: string; foreignKey?: string },
  ) {
    this.relationships[name] = { type: "has_and_belongs_to_many", ...options };
  }

  protected beforeValidation(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("beforeValidation", fn, options);
  }

  protected afterValidation(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("afterValidation", fn, options);
  }

  protected beforeSave(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("beforeSave", fn, options);
  }

  protected afterSave(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("afterSave", fn, options);
  }

  protected beforeCreate(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("beforeCreate", fn, options);
  }

  protected afterCreate(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("afterCreate", fn, options);
  }

  protected beforeUpdate(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("beforeUpdate", fn, options);
  }

  protected afterUpdate(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("afterUpdate", fn, options);
  }

  protected beforeDestroy(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("beforeDestroy", fn, options);
  }

  protected afterDestroy(
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.registerCallback("afterDestroy", fn, options);
  }

  protected afterCreateCommit(fn: (this: any, data: any) => void | Promise<void>) {
    this.registerCallback("afterCreateCommit", fn);
  }

  protected afterUpdateCommit(fn: (this: any, data: any) => void | Promise<void>) {
    this.registerCallback("afterUpdateCommit", fn);
  }

  protected afterSaveCommit(fn: (this: any, data: any) => void | Promise<void>) {
    this.registerCallback("afterSaveCommit", fn);
  }

  protected afterDestroyCommit(fn: (this: any, data: any) => void | Promise<void>) {
    this.registerCallback("afterDestroyCommit", fn);
  }

  protected afterCommit(fn: (this: any, data: any) => void | Promise<void>) {
    this.registerCallback("afterCommit", fn);
  }

  protected afterRollback(
    fn: (this: any, data: any, context?: "create" | "update" | "destroy") => void | Promise<void>,
  ) {
    this.registerCallback("afterRollback", fn);
  }

  private registerCallback(
    event: CallbackEvent,
    fn: (this: any, data: any) => void | Promise<void>,
    options?: CallbackOptions,
  ) {
    this.callbacks[event].push({
      fn: fn.bind(this),
      options,
    });
  }

  private async runCallbacks(
    event: CallbackEvent,
    context: "create" | "update" | "destroy",
    data: any,
  ): Promise<void> {
    for (const { fn, options } of this.callbacks[event]) {
      if (options?.on) {
        const contexts = Array.isArray(options.on) ? options.on : [options.on];
        if (!contexts.includes(context)) continue;
      }

      if (options?.if) {
        const condition =
          typeof options.if === "string" ? (this as any)[options.if]?.bind(this) : options.if;
        if (condition && !(await condition.call(this, data))) continue;
      }

      if (options?.unless) {
        const condition =
          typeof options.unless === "string"
            ? (this as any)[options.unless]?.bind(this)
            : options.unless;
        if (condition && (await condition.call(this, data))) continue;
      }

      try {
        const callback = typeof fn === "string" ? (this as any)[fn] : fn;
        const result = await callback(data, context);

        if (result === ABORT) {
          throw new CallbackAbortError(`Callback aborted: ${event}`);
        }
      } catch (err: any) {
        if (err instanceof CallbackAbortError) {
          throw err;
        }
        this.logger?.error(`[CALLBACK ERROR] ${event}`, { error: err.message });
        throw err;
      }
    }
  }

  protected get logger(): Logger {
    return (
      (this.ctx as any)?.logger ||
      new Logger({
        service: "models",
        context: {
          table: getTableName(this.table),
        },
      })
    );
  }

  query(): FluentQuery<TTable, TSelect> {
    return new FluentQuery<TTable, TSelect>(this.db, this.table, this.logger).setRelationships(
      this.relationships,
    );
  }

  where(conditions: Record<string, any>): FluentQuery<TTable, TSelect> {
    return this.query().where(conditions);
  }

  select(...columns: (keyof TSelect | "*")[]): FluentQuery<TTable, TSelect> {
    return this.query().select(...columns);
  }

  with(...relations: string[]): FluentQuery<TTable, TSelect> {
    return this.query().with(...relations);
  }

  withJoins(...relations: string[]): FluentQuery<TTable, TSelect> {
    return this.query().withJoins(...relations);
  }

  withSeparateQueries(...relations: string[]): FluentQuery<TTable, TSelect> {
    return this.query().withSeparateQueries(...relations);
  }

  selectColumnValues(
    columns: keyof TSelect | keyof TSelect[],
    conditions?: Record<string, any>,
    options?: {
      orderBy?: { column: keyof TSelect; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    return this.pluck(columns, conditions, options);
  }

  orderBy(column: keyof TSelect, direction: "ASC" | "DESC" = "ASC"): FluentQuery<TTable, TSelect> {
    return this.query().orderBy(column, direction);
  }

  limit(n: number): FluentQuery<TTable, TSelect> {
    return this.query().limit(n);
  }

  offset(n: number): FluentQuery<TTable, TSelect> {
    return this.query().offset(n);
  }

  async findBy(
    conditions: Record<string, any>,
    options?: {
      offset?: number;
    },
  ): Promise<TSelect | null> {
    return this.query().findBy(conditions, options);
  }

  async findAllBy(
    conditions: Record<string, any>,
    options?: {
      orderBy?: { column: keyof TSelect; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    },
  ): Promise<TSelect[]> {
    return this.query().findAllBy(conditions, options);
  }

  async count(): Promise<number> {
    return this.query().count();
  }

  async countBy(conditions: Record<string, any>): Promise<number> {
    return this.query().where(conditions).count();
  }

  async findByIds(ids: (string | number)[]): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return this.query()
      .where({ id: { in: ids } })
      .all();
  }

  async firstBy(
    conditions: Record<string, any>,
    options?: {
      offset?: number;
    },
  ): Promise<TSelect | null> {
    return this.findBy(conditions, options);
  }

  async pluck(
    columns: keyof TSelect | keyof TSelect[],
    conditions?: Record<string, any>,
    options?: {
      orderBy?: { column: keyof TSelect; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    const cols = Array.isArray(columns) ? columns : [columns];

    let query = this.query().where(conditions || {});

    if (options?.orderBy?.column) {
      query = query.orderBy(options.orderBy.column, options.orderBy.direction || "ASC");
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    if (cols.length === 1) {
      return query.pluck(cols[0] as any) as Promise<any[]>;
    }

    return query.select(...(cols as any)).all() as Promise<any[]>;
  }

  // ===== Mixin-style Query Helpers =====

  async paginate(params: { page?: number; perPage?: number; filters?: Record<string, any> } = {}) {
    let query = this.query();
    const { filters, ...paginationParams } = params;
    if (filters) {
      const allowed = (this.constructor as any).filterableBy || [];
      for (const [key, value] of Object.entries(filters)) {
        if (!allowed.includes(key)) continue;
        if (value === undefined || value === null || value === "") continue;
        query = query.where({ [key]: value });
      }
    }
    return query.paginate(paginationParams);
  }

  async search(term: string, columns?: string[]) {
    if (!term) return this.query();
    const cols = columns || (this.constructor as any).searchableBy || [];
    if (cols.length === 0) return this.query();
    return this.query().where((q: any) => {
      cols.forEach((col: string, i: number) => {
        if (i === 0) q.where({ [col]: { like: `%${term}%` } });
        else q.orWhere({ [col]: { like: `%${term}%` } });
      });
      return q;
    });
  }

  // ===== Lifecycle Query Helpers =====

  trashed(): FluentQuery<TTable, TSelect> {
    return this.query().where({ trashed_at: { neq: null } });
  }

  notTrashed(): FluentQuery<TTable, TSelect> {
    return this.query().where({ trashed_at: null });
  }

  hidden(): FluentQuery<TTable, TSelect> {
    return this.query().where({ hidden_at: { neq: null } });
  }

  notHidden(): FluentQuery<TTable, TSelect> {
    return this.query().where({ hidden_at: null });
  }

  flagged(): FluentQuery<TTable, TSelect> {
    return this.query().where({ flagged_at: { neq: null } });
  }

  notFlagged(): FluentQuery<TTable, TSelect> {
    return this.query().where({ flagged_at: null });
  }

  retired(): FluentQuery<TTable, TSelect> {
    return this.query().where({ retired_at: { neq: null } });
  }

  notRetired(): FluentQuery<TTable, TSelect> {
    return this.query().where({ retired_at: null });
  }

  active(): FluentQuery<TTable, TSelect> {
    return this.query().where({
      trashed_at: null,
      hidden_at: null,
      retired_at: null,
    });
  }

  // ===== Lifecycle Mutations =====

  async trash(id: number | string): Promise<TSelect> {
    return this.update(id, { trashed_at: new Date().toISOString() } as any);
  }

  async restore(id: number | string): Promise<TSelect> {
    return this.update(id, { trashed_at: null } as any);
  }

  async hide(id: number | string): Promise<TSelect> {
    return this.update(id, { hidden_at: new Date().toISOString() } as any);
  }

  async unhide(id: number | string): Promise<TSelect> {
    return this.update(id, { hidden_at: null } as any);
  }

  async flag(id: number | string): Promise<TSelect> {
    return this.update(id, { flagged_at: new Date().toISOString() } as any);
  }

  async unflag(id: number | string): Promise<TSelect> {
    return this.update(id, { flagged_at: null } as any);
  }

  async retire(id: number | string): Promise<TSelect> {
    return this.update(id, { retired_at: new Date().toISOString() } as any);
  }

  async unretire(id: number | string): Promise<TSelect> {
    return this.update(id, { retired_at: null } as any);
  }

  async purge(id: number | string): Promise<boolean> {
    return this.delete(id);
  }

  // ===== Relationship Traversal =====

  async listChildIds(relationName: string, id: number | string): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel || rel.type !== "has_many" || !rel.foreignKey) return [];

    let relatedModel = (this.db as any)[rel.model] || (this.db as any).query?.[rel.model];
    if (!relatedModel) {
      const regClass = BaseModel.registry[rel.model];
      if (regClass) relatedModel = new regClass({ db: this.db, table: regClass.tableName });
    }
    if (!relatedModel) return [];

    return relatedModel.where({ [rel.foreignKey]: id }).pluck("id");
  }

  async listParentIds(relationName: string, id: number | string): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel || rel.type !== "belongs_to" || !rel.foreignKey) return [];

    const item = await this.findBy({ id } as any);
    if (!item) return [];

    const parentId = (item as any)[rel.foreignKey];
    return parentId ? [parentId] : [];
  }

  async listSiblingIds(relationName: string, id: number | string): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel || rel.type !== "has_many" || !rel.foreignKey) return [];

    const item = await this.findBy({ id } as any);
    if (!item) return [];

    const parentId = (item as any)[rel.foreignKey];
    if (!parentId) return [];

    const foreignKey = rel.foreignKey;
    let relatedModel = (this.db as any)[rel.model] || (this.db as any).query?.[rel.model];
    if (!relatedModel) {
      const regClass = BaseModel.registry[rel.model];
      if (regClass) relatedModel = new regClass({ db: this.db, table: regClass.tableName });
    }
    if (!relatedModel) return [];

    return relatedModel.where({ [foreignKey]: parentId, id: { neq: id } }).pluck("id");
  }

  async listCousinIds(
    relationName: string,
    parentRelationName: string,
    id: number | string,
  ): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel || rel.type !== "has_many" || !rel.foreignKey) return [];

    const item = await this.findBy({ id } as any);
    if (!item) return [];

    const parentId = (item as any)[rel.foreignKey];
    if (!parentId) return [];

    const parentRel = this.relationships[parentRelationName];
    if (!parentRel || parentRel.type !== "belongs_to" || !parentRel.foreignKey) return [];

    const parent = await this.findBy({ id: parentId } as any);
    if (!parent) return [];

    const grandparentId = (parent as any)[parentRel.foreignKey];
    if (!grandparentId) return [];

    const cousins: (string | number)[] = [];
    for (const [siblingRelName, siblingRel] of Object.entries(this.relationships)) {
      if (
        typeof siblingRelName === "string" &&
        siblingRel.type === "has_many" &&
        (siblingRel.model !== rel.model || siblingRel.foreignKey !== rel.foreignKey) &&
        siblingRel.foreignKey
      ) {
        let siblingModel =
          (this.db as any)[siblingRel.model] || (this.db as any).query?.[siblingRel.model];
        if (!siblingModel) {
          const regClass = BaseModel.registry[siblingRel.model];
          if (regClass) siblingModel = new regClass({ db: this.db, table: regClass.tableName });
        }
        if (siblingModel) {
          const siblings = await siblingModel
            .where({ [siblingRel.foreignKey]: grandparentId, id: { neq: id } })
            .pluck("id");
          cousins.push(...siblings);
        }
      }
    }

    return cousins;
  }

  async listAncestorIds(relationName: string, id: number | string): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel || rel.type !== "belongs_to" || !rel.foreignKey) return [];

    const ancestors: (string | number)[] = [];
    const visited = new Set<string | number>();
    let currentId: string | number | null = id;
    const maxDepth = 100;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const item = await this.findBy({ id: currentId } as any);
      if (!item) break;

      currentId = (item as any)[rel.foreignKey];
      if (currentId) {
        ancestors.push(currentId);
      }
      depth++;
    }

    return ancestors;
  }

  async listDescendantIds(relationName: string, id: number | string): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel || rel.type !== "has_many" || !rel.foreignKey) return [];

    const descendants: (string | number)[] = [];
    const foreignKey = rel.foreignKey;
    const visited = new Set<string | number>();
    const maxDepth = 100;

    const collectDescendants = async (parentId: string | number, depth: number) => {
      if (depth >= maxDepth || visited.has(parentId)) return;
      visited.add(parentId);

      let relatedModel = (this.db as any)[rel.model] || (this.db as any).query?.[rel.model];
      if (!relatedModel) {
        const regClass = BaseModel.registry[rel.model];
        if (regClass) relatedModel = new regClass({ db: this.db, table: regClass.tableName });
      }
      if (!relatedModel) return;

      const children = await relatedModel.where({ [foreignKey]: parentId }).pluck("id");

      for (const childId of children) {
        descendants.push(childId as string | number);
        await collectDescendants(childId as string | number, depth + 1);
      }
    };

    await collectDescendants(id, 0);
    return descendants;
  }

  async listAssociatedThroughIds(
    relationName: string,
    throughTable: string,
    id: number | string,
  ): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel || !rel.foreignKey) return [];

    const s = sql.statement([
      sql.key("SELECT "),
      sql.id("id"),
      sql.key(" FROM "),
      sql.id(throughTable),
      sql.key(" WHERE "),
      sql.id(rel.foreignKey),
      sql.op(" = "),
      sql.val(id),
    ]);
    const junctionItems = await this.queryExec(s);

    return junctionItems.map((item: any) => item.id as string | number);
  }

  async listRelatedIds(relationName: string, id: number | string): Promise<(string | number)[]> {
    const rel = this.relationships[relationName];
    if (!rel) return [];

    if (rel.type === "has_many") {
      return this.listChildIds(relationName, id);
    }

    if (rel.type === "has_one") {
      if (!rel.foreignKey) return [];
      const item = await this.findBy({ id } as any);
      if (!item) return [];
      const childId = (item as any)[rel.foreignKey];
      return childId ? [childId] : [];
    }

    if (rel.type === "belongs_to") {
      if (!rel.foreignKey) return [];
      return this.listParentIds(relationName, id);
    }

    return [];
  }

  // ===== Include/Eager Loading Methods =====

  async findAllWith(
    conditions: Record<string, any>,
    includes: Record<string, { model: string; foreignKey: string }>,
    options?: {
      orderBy?: { column: string; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    const items = await this.findAllBy(conditions, options as any);
    if (!items?.length || !includes || Object.keys(includes).length === 0) {
      return items;
    }

    const includeEntries = Object.entries(includes);
    const results = await Promise.all(
      items.map(async (item) => {
        const enriched = { ...item };
        for (const [includeKey, includeConfig] of includeEntries) {
          const rel = this.relationships[includeKey];
          const foreignKeyValue = (item as any)[includeConfig.foreignKey];

          let relatedModel =
            (this.db as any)[includeConfig.model] || (this.db as any).query?.[includeConfig.model];
          if (!relatedModel) {
            const regClass = BaseModel.registry[includeConfig.model];
            if (regClass) relatedModel = new regClass({ db: this.db, table: regClass.tableName });
          }

          if (!relatedModel) {
            (enriched as any)[includeKey] = [];
            continue;
          }

          if (rel?.type === "has_many") {
            const relatedItems = await relatedModel
              .where({ [includeConfig.foreignKey]: (item as any).id })
              .all();
            (enriched as any)[includeKey] = relatedItems;
          } else if (foreignKeyValue) {
            const relatedItems = await relatedModel.where({ id: foreignKeyValue }).all();
            (enriched as any)[includeKey] = relatedItems;
          } else {
            (enriched as any)[includeKey] = [];
          }
        }
        return enriched;
      }),
    );

    return results;
  }

  async findWith(
    conditions: Record<string, any>,
    includes: Record<string, { model: string; foreignKey: string }>,
  ): Promise<any> {
    const item = await this.findBy(conditions);
    if (!item || !includes || Object.keys(includes).length === 0) {
      return item;
    }

    const enriched = { ...item };
    for (const [includeKey, includeConfig] of Object.entries(includes)) {
      const foreignKeyValue = (item as any)[includeConfig.foreignKey];

      let relatedModel =
        (this.db as any)[includeConfig.model] || (this.db as any).query?.[includeConfig.model];
      if (!relatedModel) {
        const regClass = BaseModel.registry[includeConfig.model];
        if (regClass) relatedModel = new regClass({ db: this.db, table: regClass.tableName });
      }

      if (!relatedModel) {
        (enriched as any)[includeKey] = [];
        continue;
      }

      if (foreignKeyValue) {
        const relatedItems = await relatedModel.where({ id: foreignKeyValue }).all();
        (enriched as any)[includeKey] = relatedItems;
      } else {
        (enriched as any)[includeKey] = [];
      }
    }

    return enriched;
  }

  // --- Lifecycle Hooks ---
  protected async _beforeValidation(
    data: TInsert | Partial<TInsert>,
  ): Promise<TInsert | Partial<TInsert>> {
    await this.runCallbacks("beforeValidation", (data as any).id ? "update" : "create", data);
    return data;
  }

  protected async _afterValidation(data: TInsert | Partial<TInsert>): Promise<void> {
    await this.runCallbacks("afterValidation", (data as any).id ? "update" : "create", data);
  }

  protected async _beforeCreate(data: TInsert): Promise<TInsert> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[BEFORE CREATE] ${tableName}`, { data });
    await this.runCallbacks("beforeCreate", "create", data);

    const idColumn = this.table && typeof this.table === "object" ? (this.table as any).id : null;
    const hasAutoIncrement = idColumn?.autoIncrement;

    if (!(data as any).id && !hasAutoIncrement) {
      (data as any).id = crypto.randomUUID();
    }
    return data;
  }

  protected async _afterCreate(record: TSelect): Promise<void> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[AFTER CREATE] ${tableName}#${(record as any).id}`, {
      record,
    });
    await this.runCallbacks("afterCreate", "create", record);
  }

  protected async _beforeUpdate(data: Partial<TInsert>): Promise<Partial<TInsert>> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[BEFORE UPDATE] ${tableName}`, { data });
    await this.runCallbacks("beforeUpdate", "update", data);
    return data;
  }

  protected async _afterUpdate(record: TSelect): Promise<void> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[AFTER UPDATE] ${tableName}#${(record as any).id}`, {
      record,
    });
    await this.runCallbacks("afterUpdate", "update", record);
  }

  protected async _beforeSave(
    data: TInsert | Partial<TInsert>,
  ): Promise<TInsert | Partial<TInsert>> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[BEFORE SAVE] ${tableName}`, { data });
    const context = (data as any).id ? "update" : "create";
    await this.runCallbacks("beforeSave", context, data);
    return data;
  }

  protected async _afterSave(record: TSelect): Promise<void> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[AFTER SAVE] ${tableName}#${(record as any).id}`, {
      record,
    });
    const context = (record as any).id ? "update" : "create";
    await this.runCallbacks("afterSave", context, record);
  }

  protected async _beforeDelete(id: number | string): Promise<void> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[BEFORE DELETE] ${tableName}#${id}`);
    await this.runCallbacks("beforeDestroy", "destroy", { id });
  }

  protected async _afterDelete(id: number | string): Promise<void> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[AFTER DELETE] ${tableName}#${id}`);
    await this.runCallbacks("afterDestroy", "destroy", { id });
  }

  async create(data: TInsert): Promise<TSelect> {
    const tableName = getTableName(this.table);
    this.logger?.info(`[CREATE] ${tableName}`, { data });

    let finalData = (await this._beforeSave(data)) as TInsert;
    finalData = await this._beforeCreate(finalData);

    let record: TSelect;

    const filtered: any = {};
    const hasColumnsDefined =
      this.table && typeof this.table === "object" && Object.keys(this.table).length > 0;

    for (const k in finalData) {
      const isValidColumn = !hasColumnsDefined || k in this.table;
      if (isValidColumn && finalData[k] !== undefined) {
        filtered[k] = finalData[k];
      }
    }

    const keys = Object.keys(filtered);
    const vals = keys.map((k) => filtered[k]);

    const s = sql.statement([
      sql.key("INSERT INTO "),
      sql.id(tableName),
      sql.op(" ("),
      sql.join(
        keys.map((k) => sql.id(k)),
        sql.op(", "),
      ),
      sql.op(") VALUES ("),
      sql.join(
        vals.map((v) => sql.val(v)),
        sql.op(", "),
      ),
      sql.op(") RETURNING *"),
    ]);
    const res = await this.queryExec(s);
    record = res[0] as TSelect;

    await this._afterCreate(record);
    await this._afterSave(record);
    if (this._inTransaction) {
      this._transactionCallbacks.push(
        { event: "afterCommit", context: "create", data: record },
        { event: "afterCreateCommit", context: "create", data: record },
        { event: "afterSaveCommit", context: "create", data: record },
      );
      this._transactionOps.push({ context: "create", data: record });
    } else {
      await this.runCallbacks("afterCommit", "create", record);
      await this.runCallbacks("afterCreateCommit", "create", record);
      await this.runCallbacks("afterSaveCommit", "create", record);
    }
    this.logger?.info(`[CREATED] ${tableName}#${(record as any).id}`);
    return record;
  }

  async update(id: number | string, data: Partial<TInsert>): Promise<TSelect> {
    const tableName = getTableName(this.table);
    this.logger?.info(`[UPDATE] ${tableName}#${id}`, { data });

    let finalData = (await this._beforeSave(data)) as Partial<TInsert>;
    finalData = await this._beforeUpdate(finalData);

    let record: TSelect;

    const filtered: any = {};
    const hasColumnsDefined =
      this.table && typeof this.table === "object" && Object.keys(this.table).length > 0;

    for (const k in finalData) {
      const isValidColumn = !hasColumnsDefined || k in this.table;
      if (isValidColumn && (finalData as any)[k] !== undefined) {
        filtered[k] = (finalData as any)[k];
      }
    }

    if (Object.keys(filtered).length === 0) {
      this.logger?.warn(`[UPDATE SKIP] ${tableName}#${id}: No valid columns to update`);
      const existing = await this.find(id);
      if (!existing) throw new Error(`Record with id ${id} not found`);
      return existing;
    }

    const entries = Object.entries(filtered).map(([k, v]) =>
      sql.composite(sql.id(k), sql.op(" = "), sql.val(v)),
    );

    const s = sql.statement([
      sql.key("UPDATE "),
      sql.id(tableName),
      sql.key(" SET "),
      sql.join(entries, sql.op(", ")),
      sql.nl(),
      sql.key("WHERE "),
      sql.id("id"),
      sql.op(" = "),
      sql.val(id),
      sql.key(" RETURNING *"),
    ]);
    const res = await this.queryExec(s);
    if (res.length === 0) throw new Error(`Record with id ${id} not found`);
    record = res[0] as TSelect;

    await this._afterUpdate(record);
    await this._afterSave(record);
    if (this._inTransaction) {
      this._transactionCallbacks.push(
        { event: "afterCommit", context: "update", data: record },
        { event: "afterUpdateCommit", context: "update", data: record },
        { event: "afterSaveCommit", context: "update", data: record },
      );
      this._transactionOps.push({ context: "update", data: record });
    } else {
      await this.runCallbacks("afterCommit", "update", record);
      await this.runCallbacks("afterUpdateCommit", "update", record);
      await this.runCallbacks("afterSaveCommit", "update", record);
    }
    this.logger?.info(`[UPDATED] ${tableName}#${id}`);
    return record;
  }

  async delete(id: number | string): Promise<boolean> {
    const tableName = getTableName(this.table);
    this.logger?.info(`[DELETE] ${tableName}#${id}`);

    await this._beforeDelete(id);

    const s = sql.statement([
      sql.key("DELETE FROM "),
      sql.id(tableName),
      sql.key(" WHERE "),
      sql.id("id"),
      sql.op(" = "),
      sql.val(id),
      sql.key(" RETURNING *"),
    ]);
    const res = await this.queryExec(s);
    const success = res.length > 0;

    if (success) {
      await this._afterDelete(id);
      if (this._inTransaction) {
        this._transactionCallbacks.push(
          { event: "afterCommit", context: "destroy", data: { id } },
          { event: "afterDestroyCommit", context: "destroy", data: { id } },
        );
        this._transactionOps.push({ context: "destroy", data: { id } });
      } else {
        await this.runCallbacks("afterCommit", "destroy", { id });
        await this.runCallbacks("afterDestroyCommit", "destroy", { id });
      }
      this.logger?.info(`[DELETED] ${tableName}#${id}`);
    }
    return success;
  }

  async find(id: number | string): Promise<TSelect | null> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[FIND] ${tableName}#${id}`);

    let record: TSelect | null = null;

    record = await this.where({ id }).first();

    if (record) {
      this.logger?.debug(`[FOUND] ${tableName}#${id}`);
    } else {
      this.logger?.debug(`[NOT FOUND] ${tableName}#${id}`);
    }

    return record;
  }

  async all(): Promise<TSelect[]> {
    const tableName = getTableName(this.table);
    this.logger?.debug(`[ALL] ${tableName}`);

    let records: TSelect[] = [];

    records = await this.query().all();

    this.logger?.debug(`[ALL RESULT] ${tableName} count=${records.length}`);
    return records;
  }

  private async queryExec(s: Statement): Promise<any[]> {
    const dialect = (this.query() as any).strategy?.dialect ?? "sqlite";
    const strategy = getDialectStrategy(dialect);
    const sqlRes = s.toSql(strategy);
    if (!sqlRes.success) throw new Error(sqlRes.message);
    const sqlText = sqlRes.data.value;
    const params = sqlRes.params;

    this.logger?.debug(`[SQL] ${sqlText}`);

    try {
      return await execRaw(this.db, sqlText, params, strategy.dialect);
    } catch (err: any) {
      this.logger?.error(`[SQL ERROR]`, { sql: sqlText, error: err.message });

      const errorMsg = err.message || "";

      if (errorMsg.includes("UNIQUE constraint failed")) {
        throw new ConflictError(`Unique constraint violated: ${err.message}`);
      }
      if (errorMsg.includes("FOREIGN KEY constraint failed")) {
        throw new ConstraintError("Foreign key constraint violated", "FOREIGN_KEY", {
          originalError: err.message,
        });
      }
      if (errorMsg.includes("NOT NULL constraint failed")) {
        throw new ConstraintError("Not null constraint violated", "NOT_NULL", {
          originalError: err.message,
        });
      }
      if (errorMsg.includes("CHECK constraint failed")) {
        throw new ConstraintError("Check constraint violated", "CHECK", {
          originalError: err.message,
        });
      }
      if (errorMsg.includes("datatype mismatch")) {
        throw new BadRequestError(`Datatype mismatch: ${err.message}`);
      }
      throw err;
    }
  }

  async transaction<T>(fn: (model: this) => Promise<T>): Promise<T> {
    const tableName = getTableName(this.table);
    this.logger?.info(`[TRANSACTION START] ${tableName}`);

    this._inTransaction = true;
    this._transactionCallbacks = [];
    this._transactionOps = [];

    try {
      await execRaw(this.db, "BEGIN");
      const result = await fn(this);
      await execRaw(this.db, "COMMIT");

      // Flush queued commit callbacks — outside the rollback catch so a
      // callback failure doesn't retroactively roll back a committed tx.
      try {
        for (const entry of this._transactionCallbacks) {
          await this.runCallbacks(entry.event as CallbackEvent, entry.context, entry.data);
        }
      } catch (cbErr: any) {
        this.logger?.error(`[TRANSACTION CALLBACK ERROR] ${tableName}`, { error: cbErr.message });
      }

      this.logger?.info(`[TRANSACTION COMMIT] ${tableName}`);
      return result;
    } catch (err: any) {
      try {
        await execRaw(this.db, "ROLLBACK");
      } catch {
        this.logger?.warn(`[TRANSACTION ROLLBACK FAILED] ${tableName}`);
      }

      // Fire afterRollback once per operation with its record data and context
      for (const op of this._transactionOps) {
        await this.runCallbacks("afterRollback", op.context, { ...op.data, error: err.message });
      }
      // If nothing was queued, fire once with a neutral context
      if (this._transactionOps.length === 0) {
        await this.runCallbacks("afterRollback", "create", { error: err.message });
      }

      this._transactionCallbacks = [];
      this._transactionOps = [];
      this.logger?.error(`[TRANSACTION ROLLBACK] ${tableName}`, { error: err.message });
      throw err;
    } finally {
      this._inTransaction = false;
      this._transactionCallbacks = [];
      this._transactionOps = [];
    }
  }
}

export function defineModel<TTableName extends string, TColumnsMap extends Record<string, any>>(
  name: TTableName,
  columns: TColumnsMap,
) {
  return {
    tableName: name,
    columns,
  };
}
