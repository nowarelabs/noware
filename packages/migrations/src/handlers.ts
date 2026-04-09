import { type Result, ok } from "nomo/result";
import {
  Column,
  ForeignKey,
  TableBuilder,
  SqlExpression,
  Constraint,
  VirtualTableBuilder,
} from "./index";
import { sql, Statement, SqlPart, DialectStrategy } from "nomo/sql";

export type HandlerFunc = (action: unknown, strategy: DialectStrategy) => Result<Statement | null>;

export const STANDARD_HANDLERS: Record<string, HandlerFunc> = {
  createTable: (action, strategy) =>
    ok(
      (() => {
        const { name, table } = action as { name: string; table: TableBuilder };
        const stmt = sql
          .statement()
          .append(sql.key("CREATE TABLE IF NOT EXISTS "), sql.id(name), sql.op(" ("), sql.nl());

        const defs: SqlPart[] = [];

        // Columns
        table.columns.forEach((col: Column) => {
          const dbName = col.options.name || col.name;
          const colParts = sql.composite(
            sql.indent(),
            sql.id(dbName),
            sql.op(" "),
            sql.type(strategy.mapType(col.type)),
            col.options.primaryKey ? sql.composite(sql.op(" "), sql.primaryKey()) : sql.raw(""),
            col.options.primaryKey && col.options.autoincrement && strategy.dialect === "sqlite"
              ? sql.composite(sql.op(" "), sql.key("AUTOINCREMENT"))
              : sql.raw(""),
            col.options.notNull ? sql.composite(sql.op(" "), sql.key("NOT NULL")) : sql.raw(""),
            col.options.unique ? sql.composite(sql.op(" "), sql.key("UNIQUE")) : sql.raw(""),
          );

          if (col.options.generated) {
            const { as, stored } = col.options.generated;
            const expr = typeof as === "object" ? sql.raw(as.sql) : sql.raw(as);
            colParts.append(sql.op(" "), sql.generated(expr, stored));
          }

          if (col.options.check) {
            colParts.append(sql.key(" CHECK ("));
            if (typeof col.options.check === "object" && "__isSql" in col.options.check) {
              colParts.append(sql.raw((col.options.check as SqlExpression).sql));
            } else {
              colParts.append(sql.raw(String(col.options.check)));
            }
            colParts.append(sql.op(")"));
          }

          if (col.options.default !== undefined) {
            const val = col.options.default;
            let defaultVal: SqlPart;
            if (val && typeof val === "object" && "__isSql" in val) {
              defaultVal = sql.raw((val as SqlExpression).sql);
            } else if (val instanceof SqlPart) {
              defaultVal = val;
            } else {
              defaultVal = sql.val(val);
            }
            colParts.append(sql.op(" "), sql.default(defaultVal));
          }
          defs.push(colParts);
        });

        // Foreign Keys
        table.foreignKeys.forEach((fk: ForeignKey) => {
          const fkParts = sql.composite(
            sql.indent(),
            sql.key("FOREIGN KEY ("),
            sql.id(fk.column),
            sql.op(") REFERENCES "),
            sql.id(fk.toTable),
            sql.op("("),
            sql.id(fk.toColumn),
            sql.op(")"),
            fk.options.onDelete
              ? sql.key(` ON DELETE ${fk.options.onDelete.toUpperCase()}`)
              : sql.raw(""),
          );
          defs.push(fkParts);
        });

        // Table-level Primary Key (Composite)
        if (table.primaryKey) {
          const pks = Array.isArray(table.primaryKey) ? table.primaryKey : [table.primaryKey];
          const pkParts = sql.composite(
            sql.indent(),
            sql.key("PRIMARY KEY ("),
            sql.join(
              pks.map((pk) => sql.id(pk)),
              sql.op(", "),
            ),
            sql.op(")"),
          );
          defs.push(pkParts);
        }

        // Constraints (Unique, Check)
        table.constraints?.forEach((con: Constraint) => {
          const conParts = sql.composite(sql.indent());
          if (con.name) {
            conParts.append(sql.key("CONSTRAINT "), sql.id(con.name), sql.raw(" "));
          }

          if (con.type === "unique") {
            const columns = Array.isArray(con.definition)
              ? con.definition
              : [con.definition as string];
            conParts.append(
              sql.key("UNIQUE ("),
              sql.join(
                columns.map((c) => sql.id(c)),
                sql.op(", "),
              ),
              sql.op(")"),
            );
          } else if (con.type === "check") {
            conParts.append(sql.key("CHECK ("));
            if (typeof con.definition === "object" && "__isSql" in (con.definition as any)) {
              conParts.append(sql.raw((con.definition as any).sql));
            } else {
              conParts.append(sql.raw(String(con.definition)));
            }
            conParts.append(sql.op(")"));
          }
          defs.push(conParts);
        });

        defs.forEach((def, i) => {
          stmt.append(def);
          if (i < defs.length - 1) {
            stmt.append(sql.op(","), sql.nl());
          }
        });

        stmt.append(sql.nl(), sql.op(")"));

        if (table.strict && strategy.dialect === "sqlite") {
          stmt.append(sql.op(" "), sql.strict());
        }
        if (table.withoutRowid && strategy.dialect === "sqlite") {
          stmt.append(sql.op(" "), sql.withoutRowid());
        }

        stmt.append(sql.op(";"));

        // Indexes
        table.indexes.forEach((idx) => {
          const idxName = idx.name || `idx_${name}_${idx.columns.join("_")}`;
          const unique = idx.unique ? "UNIQUE " : "";
          stmt.append(
            sql.nl(),
            sql.key(`CREATE ${unique}INDEX IF NOT EXISTS `),
            sql.id(idxName),
            sql.key(" ON "),
            sql.id(name),
            sql.op(" ("),
            sql.join(
              idx.columns.map((c) => sql.id(c)),
              sql.op(", "),
            ),
            sql.op(");"),
          );
        });

        return stmt;
      })(),
    ),

  dropTable: (action) =>
    ok(
      sql
        .statement()
        .append(sql.key("DROP TABLE IF EXISTS "), sql.id((action as { name: string }).name)),
    ),

  addColumn: (action, strategy) =>
    ok(
      (() => {
        const { tableName, name, columnType, options } = action as {
          tableName: string;
          name: string;
          columnType: string;
          options: any;
        };
        const stmt = sql
          .statement()
          .append(
            sql.key("ALTER TABLE "),
            sql.id(tableName),
            sql.key(" ADD COLUMN "),
            sql.id(name),
            sql.op(" "),
            sql.type(strategy.mapType(columnType)),
          );

        if (options.notNull) stmt.append(sql.op(" "), sql.key("NOT NULL"));
        if (options.default !== undefined)
          stmt.append(sql.op(" "), sql.default(sql.val(options.default)));

        return stmt;
      })(),
    ),

  removeColumn: (action) =>
    ok(
      sql
        .statement()
        .append(
          sql.key("ALTER TABLE "),
          sql.id((action as { tableName: string }).tableName),
          sql.key(" DROP COLUMN "),
          sql.id((action as { name: string }).name),
        ),
    ),

  renameColumn: (action) =>
    ok(
      sql
        .statement()
        .append(
          sql.key("ALTER TABLE "),
          sql.id((action as { tableName: string }).tableName),
          sql.key(" RENAME COLUMN "),
          sql.id((action as { from: string }).from),
          sql.key(" TO "),
          sql.id((action as { to: string }).to),
        ),
    ),

  renameTable: (action) =>
    ok(
      sql
        .statement()
        .append(
          sql.key("ALTER TABLE "),
          sql.id((action as { from: string }).from),
          sql.key(" RENAME TO "),
          sql.id((action as { to: string }).to),
        ),
    ),

  addIndex: (action) => {
    const { tableName, columns, options } = action as {
      tableName: string;
      columns: string[];
      options: { name?: string; unique?: boolean };
    };
    const idxName = options.name || `idx_${tableName}_${columns.join("_")}`;
    const unique = options.unique ? "UNIQUE " : "";

    return ok(
      sql
        .statement()
        .append(
          sql.key(`CREATE ${unique}INDEX IF NOT EXISTS `),
          sql.id(idxName),
          sql.key(" ON "),
          sql.id(tableName),
          sql.op(" ("),
        )
        .append(
          sql.join(
            columns.map((c: string) => sql.id(c)),
            sql.op(", "),
          ),
        )
        .append(sql.op(")")),
    );
  },

  removeIndex: (action) => {
    const { tableName, columns, options } = action as {
      tableName: string;
      columns: string[];
      options: { name?: string };
    };
    const idxName = options.name || `idx_${tableName}_${columns.join("_")}`;
    return ok(sql.statement().append(sql.key("DROP INDEX IF EXISTS "), sql.id(idxName)));
  },

  changeColumn: (action) => {
    console.warn(
      `ALTER TABLE CHANGE COLUMN is not supported in SQLite. Use migrate-reflect to rebuild the table.`,
    );
    return ok(null);
  },

  changeColumnDefault: (action) => {
    console.warn(`ALTER TABLE ALTER COLUMN SET DEFAULT is not supported in SQLite.`);
    return ok(null);
  },

  changeColumnNull: (action) => {
    console.warn(`ALTER TABLE ALTER COLUMN SET NOT NULL is not supported in SQLite.`);
    return ok(null);
  },

  addForeignKey: (action) => {
    console.warn(
      `ALTER TABLE ADD FOREIGN KEY is not supported in SQLite. Define them in createTable.`,
    );
    return ok(null);
  },

  removeForeignKey: (action) => {
    console.warn(`ALTER TABLE DROP FOREIGN KEY is not supported in SQLite.`);
    return ok(null);
  },

  recreateTable: (action, strategy) =>
    ok(
      (() => {
        const { name, table } = action as { name: string; table: TableBuilder };
        if (!table) return null;

        const oldName = `old_${name}`;
        const stmt = sql
          .statement()
          .append(sql.key("PRAGMA foreign_keys=OFF;"), sql.nl())
          .append(sql.key("BEGIN TRANSACTION;"), sql.nl())
          .append(
            sql.key("ALTER TABLE "),
            sql.id(name),
            sql.key(" RENAME TO "),
            sql.id(oldName),
            sql.op(";"),
            sql.nl(),
          );

        const createStmtRes = STANDARD_HANDLERS.createTable({ name, table }, strategy);
        const createStmt = createStmtRes.success ? createStmtRes.data : null;
        if (createStmt) stmt.append(createStmt, sql.op(";"), sql.nl());

        const cols = sql.join(
          table.columns.map((c) => sql.id(c.options.name || c.name)),
          sql.op(", "),
        );
        stmt
          .append(
            sql.key("INSERT INTO "),
            sql.id(name),
            sql.op(" ("),
            cols,
            sql.op(") SELECT "),
            cols,
            sql.key(" FROM "),
            sql.id(oldName),
            sql.op(";"),
            sql.nl(),
          )
          .append(sql.key("DROP TABLE "), sql.id(oldName), sql.op(";"), sql.nl())
          .append(sql.key("COMMIT;"), sql.nl())
          .append(sql.key("PRAGMA foreign_keys=ON;"));

        return stmt;
      })(),
    ),

  createView: (action) =>
    ok(
      (() => {
        const { name, definition } = action as {
          name: string;
          definition: string | SqlExpression;
        };
        const stmt = sql
          .statement()
          .append(sql.key("CREATE VIEW IF NOT EXISTS "), sql.id(name), sql.key(" AS "));
        if (typeof definition === "object" && definition !== null && "__isSql" in definition) {
          stmt.append(sql.raw((definition as SqlExpression).sql));
        } else {
          stmt.append(sql.raw(String(definition)));
        }
        return stmt;
      })(),
    ),

  dropView: (action) =>
    ok(
      sql
        .statement()
        .append(sql.key("DROP VIEW IF EXISTS "), sql.id((action as { name: string }).name)),
    ),

  createVirtualTable: (action) =>
    ok(
      (() => {
        const { name, builder } = action as {
          name: string;
          builder: VirtualTableBuilder;
        };
        const stmt = sql
          .statement()
          .append(
            sql.key("CREATE VIRTUAL TABLE IF NOT EXISTS "),
            sql.id(name),
            sql.key(` USING ${builder.moduleName.toUpperCase()}`),
            sql.op(" ("),
          );

        stmt.append(
          sql.join(
            builder.arguments.map((arg: string) => sql.raw(arg)),
            sql.op(", "),
          ),
        );
        stmt.append(sql.op(")"));
        return stmt;
      })(),
    ),
};
