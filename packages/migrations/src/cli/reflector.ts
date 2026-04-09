import * as fs from "node:fs/promises";
import * as path from "pathe";
import { spawnSync } from "node:child_process";
import { CodeBuilder } from "./builder";
import * as templates from "./templates";

export interface ReflectorOptions {
  outDir: string;
  metadata?: Record<string, any[]>;
}

export class SchemaReflector {
  private sqlPath: string | null = null;
  private tempSqlPath = path.resolve(process.cwd(), "temp_reflect.sql");
  private tempDbPath = path.resolve(process.cwd(), "temp_reflect.db");
  private tables: { name: string; sql: string }[] = [];
  private outDir: string;
  private metadata: Record<string, any[]>;

  constructor(options: ReflectorOptions) {
    this.outDir = path.resolve(process.cwd(), options.outDir);
    this.metadata = options.metadata || {};
  }

  /**
   * Set the source: either a file or a D1 database
   */
  async source(file?: string, options: { db?: string; remote?: boolean } = {}): Promise<this> {
    if (options.db) {
      console.log(`\n📡 Exporting schema from D1 database: ${options.db}...`);
      const scope = options.remote ? "--remote" : "--local";
      const res = spawnSync(
        "pnpm",
        ["wrangler", "d1", "export", options.db, scope, "--no-data", "--output", this.tempSqlPath],
        { stdio: "inherit" },
      );
      if (res.status !== 0)
        throw new Error(`Failed to export D1 schema: ${res.stderr || res.status}`);
      this.sqlPath = this.tempSqlPath;
    } else if (file) {
      this.sqlPath = path.resolve(process.cwd(), file);
    }

    if (!this.sqlPath) {
      throw new Error("You must provide either a SQL file or a D1 database name.");
    }

    return this;
  }

  /**
   * Prepare a temporary SQLite database for metadata extraction
   */
  async prepare(): Promise<this> {
    if (!this.sqlPath) throw new Error("Source not set");
    console.log(`\n🔍 Processing SQL from ${path.relative(process.cwd(), this.sqlPath)}...`);
    console.log(`🔨 Creating temporary database for metadata extraction...`);
    await fs.rm(this.tempDbPath, { force: true });

    // Read SQL file and pipe to sqlite3
    const sqlContent = await fs.readFile(this.sqlPath, "utf-8");
    const res = spawnSync("sqlite3", [this.tempDbPath], {
      input: sqlContent,
      encoding: "utf-8",
    });
    if (res.status !== 0) throw new Error(`Failed to initialize temp DB: ${res.stderr}`);

    return this;
  }

  /**
   * Extract metadata from the temporary database
   */
  async extract(): Promise<this> {
    console.log(`🛰️  Extracting table metadata...`);
    const res = spawnSync(
      "sqlite3",
      [
        "-json",
        this.tempDbPath,
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
      ],
      { encoding: "utf-8" },
    );
    if (res.status !== 0) throw new Error(`Failed to extract metadata: ${res.stderr}`);
    const tablesJson = res.stdout;
    this.tables = tablesJson ? JSON.parse(tablesJson) : [];

    if (this.tables.length === 0) {
      throw new Error("No tables found in the provided SQL/Database.");
    }
    return this;
  }

  /**
   * Generate code and write to files
   */
  async generate(): Promise<void> {
    console.log(`📦 Generating schemas...`);
    const drizzleBuilder = new CodeBuilder().append(templates.DRIZZLE_HEADER);
    const typesExports: string[] = [];
    const typesDir = path.resolve(process.cwd(), "src/models/types");
    await fs.mkdir(typesDir, { recursive: true });

    for (const table of this.tables) {
      console.log(`  📦 Reflecting table: ${table.name}`);
      const res = spawnSync(
        "sqlite3",
        ["-json", this.tempDbPath, `SELECT * FROM pragma_table_info('${table.name}');`],
        { encoding: "utf-8" },
      );
      if (res.status !== 0)
        throw new Error(`Failed to extract columns for ${table.name}: ${res.stderr}`);
      const columnsJson = res.stdout;
      const columns: {
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }[] = JSON.parse(columnsJson);

      drizzleBuilder.render(templates.TABLE_START, { tableName: table.name });

      for (const col of columns) {
        drizzleBuilder.render(templates.COLUMN_START, {
          name: col.name,
          type: this.mapToDrizzleType(col.type, col.name),
        });

        const isAutoIncrement =
          table.sql
            .toUpperCase()
            .includes(`"${col.name.toUpperCase()}" INTEGER PRIMARY KEY AUTOINCREMENT`) ||
          table.sql
            .toUpperCase()
            .includes(`"${col.name.toUpperCase()}" INTEGER PRIMARY KEY  AUTOINCREMENT`) ||
          table.sql
            .toUpperCase()
            .includes(`${col.name.toUpperCase()} INTEGER PRIMARY KEY AUTOINCREMENT`);

        if (col.pk) {
          if (isAutoIncrement) {
            drizzleBuilder.append(templates.COLUMN_AUTO_INCREMENT);
          } else {
            drizzleBuilder.append(templates.COLUMN_PK);
          }
        }
        if (col.notnull) drizzleBuilder.append(templates.COLUMN_NOT_NULL);

        if (col.dflt_value !== null) {
          let value = String(col.dflt_value);

          // SQLite PRAGMA returns string literals wrapped in single quotes,
          // or SQL keywords/functions without quotes.
          const isQuoted = value.startsWith("'") && value.endsWith("'");
          const rawValue = isQuoted ? value.slice(1, -1) : value;

          const isBoolean = this.isBooleanColumn(col.type, col.name);
          const isNumeric =
            col.type.toUpperCase().includes("INT") ||
            col.type.toUpperCase().includes("REAL") ||
            col.type.toUpperCase().includes("FLOAT");

          if (rawValue.toUpperCase() === "CURRENT_TIMESTAMP" || rawValue.includes("()")) {
            value = `sql\`${rawValue}\``;
          } else if (isBoolean) {
            if (rawValue === "1" || rawValue.toLowerCase() === "true") value = "true";
            else if (rawValue === "0" || rawValue.toLowerCase() === "false") value = "false";
            else value = `'${rawValue.replace(/'/g, "\\'")}'`;
          } else if (isNumeric) {
            const num = Number(rawValue);
            if (!isNaN(num) && rawValue.trim() !== "") {
              value = num.toString();
            } else {
              value = `'${rawValue.replace(/'/g, "\\'")}'`;
            }
          } else {
            // It's a string literal or something else
            value = `'${rawValue.replace(/'/g, "\\'")}'`;
          }

          drizzleBuilder.render(templates.COLUMN_DEFAULT, {
            value,
          });
        }

        drizzleBuilder.append(templates.COLUMN_LINE_END);
      }

      drizzleBuilder.append(templates.TABLE_COLUMN_END);

      let hasExtraConfig = false;
      const ensureExtraConfig = () => {
        if (!hasExtraConfig) {
          drizzleBuilder.append(templates.TABLE_EXTRA_START);
          hasExtraConfig = true;
        }
      };

      // Foreign Keys
      const fkRes = spawnSync(
        "sqlite3",
        ["-json", this.tempDbPath, `SELECT * FROM pragma_foreign_key_list('${table.name}');`],
        { encoding: "utf-8" },
      );
      if (fkRes.status === 0 && fkRes.stdout) {
        const fks: {
          table: string;
          from: string;
          to: string;
          on_delete: string;
        }[] = JSON.parse(fkRes.stdout);
        if (fks.length > 0) {
          ensureExtraConfig();
          for (const fk of fks) {
            drizzleBuilder.render(templates.REFERENCE, {
              column: fk.from,
              foreignTable: fk.table,
              foreignColumn: fk.to,
              onDelete: fk.on_delete.toLowerCase(),
            });
          }
        }
      }

      // Indexes
      const idxRes = spawnSync(
        "sqlite3",
        ["-json", this.tempDbPath, `SELECT * FROM pragma_index_list('${table.name}');`],
        { encoding: "utf-8" },
      );
      if (idxRes.status === 0 && idxRes.stdout) {
        const indexes: {
          name: string;
          unique: number;
          origin: string;
        }[] = JSON.parse(idxRes.stdout);
        for (const idx of indexes) {
          if (idx.origin === "pk") continue; // Skip PK auto-indexes

          const infoRes = spawnSync(
            "sqlite3",
            ["-json", this.tempDbPath, `SELECT name FROM pragma_index_info('${idx.name}');`],
            { encoding: "utf-8" },
          );
          if (infoRes.status === 0 && infoRes.stdout) {
            const cols: { name: string }[] = JSON.parse(infoRes.stdout);
            const columns = cols.map((c) => `table.${c.name}`).join(", ");
            ensureExtraConfig();
            drizzleBuilder.render(idx.unique ? templates.UNIQUE_INDEX : templates.INDEX, {
              name: idx.name,
              columns,
            });
          }
        }
      }

      if (hasExtraConfig) {
        drizzleBuilder.append(
          templates.TABLE_EXTRA_START.includes("[") ? templates.TABLE_EXTRA_END : "})",
        );
      }
      const typeName = this.capitalize(table.name);
      drizzleBuilder.append(templates.TABLE_END);

      // Model generation
      const modelName = `${typeName}Model`;
      let relationshipsStr = "";
      const tableMetadata = this.metadata[table.name] || [];

      for (const rel of tableMetadata) {
        const targetModel = `${this.capitalize(rel.targetTable)}Model`;
        const optionsParts: string[] = [];
        if (rel.options.foreignKey) optionsParts.push(`foreignKey: '${rel.options.foreignKey}'`);
        if (rel.options.through) optionsParts.push(`through: '${rel.options.through}'`);
        if (rel.options.sourceKey) optionsParts.push(`sourceKey: '${rel.options.sourceKey}'`);

        const options = optionsParts.length > 0 ? `, ${optionsParts.join(", ")}` : "";

        relationshipsStr += new CodeBuilder()
          .render(templates.RELATIONSHIP_TEMPLATE, {
            type: rel.type,
            name: rel.name,
            targetModel: targetModel,
            options: options,
          })
          .toString();
      }

      const modelContent = new CodeBuilder()
        .render(templates.MODEL_TEMPLATE, {
          tableName: table.name,
          modelName: modelName,
          typeName: typeName,
          relationships: relationshipsStr,
        })
        .toString();

      const singularName = this.singularize(table.name);
      const modelsDir = path.resolve(process.cwd(), "src/models");
      await fs.mkdir(modelsDir, { recursive: true });

      const modelPath = path.join(modelsDir, `${singularName}.ts`);
      const modelExists = await fs.stat(modelPath).catch(() => null);
      let shouldUpdate = !modelExists;

      if (modelExists) {
        const existingContent = await fs.readFile(modelPath, "utf-8");
        // Overwrite if it was generated by our tool and we're enforcing style
        if (
          existingContent.includes("// model") ||
          existingContent.includes("Generated by nomo/migrations")
        ) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        await fs.writeFile(modelPath, modelContent);
        console.log(`  📝 Updated model: ${path.relative(process.cwd(), modelPath)}`);
      }

      // Zod and TS Interfaces
      const zodIndividualBuilder = new CodeBuilder().append(templates.ZOD_HEADER_INDIVIDUAL);
      zodIndividualBuilder.render(templates.ZOD_TEMPLATE, {
        tableName: table.name,
        typeName,
      });

      const typePath = path.join(typesDir, `${singularName}.ts`);
      await fs.writeFile(typePath, zodIndividualBuilder.toString());
      console.log(`  📝 Created type model: ${path.relative(process.cwd(), typePath)}`);
      typesExports.push(`export * from './${singularName}';`);
    }

    await fs.mkdir(this.outDir, { recursive: true });
    await fs.writeFile(path.join(this.outDir, "schema.ts"), drizzleBuilder.toString());
    await fs.writeFile(path.join(typesDir, "index.ts"), typesExports.join("\n") + "\n");

    console.log(`\n✅ Success!`);
    console.log(
      `  - Drizzle Schema:        ${path.relative(process.cwd(), path.join(this.outDir, "schema.ts"))}`,
    );
    console.log(`  - Zod/TS Interfaces:     ${path.relative(process.cwd(), typesDir)}`);

    await this.cleanup();
  }

  private async cleanup() {
    try {
      await fs.rm(this.tempSqlPath, { force: true });
      await fs.rm(this.tempDbPath, { force: true });
    } catch (e) {}
  }

  private singularize(str: string) {
    if (str.endsWith("ses")) {
      return str.slice(0, -2);
    }
    if (str.endsWith("s") && str.length > 3 && !str.endsWith("ss")) {
      return str.slice(0, -1);
    }
    return str;
  }

  private capitalize(str: string) {
    const singular = this.singularize(str);
    return singular
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private isBooleanColumn(sqlType: string, colName: string): boolean {
    const type = sqlType.toUpperCase();
    const name = colName;
    return type.includes("BOOLEAN") || name.startsWith("is_") || name.startsWith("has_");
  }

  private mapToDrizzleType(sqlType: string, colName: string): string {
    const type = sqlType.toUpperCase();
    const name = colName;

    if (this.isBooleanColumn(sqlType, colName)) {
      return `integer('${name}', { mode: 'boolean' })`;
    }

    if (type.includes("INT")) {
      return `integer('${name}')`;
    }

    if (
      type.includes("REAL") ||
      type.includes("FLOAT") ||
      type.includes("DOUBLE") ||
      type.includes("DECIMAL")
    ) {
      return `real('${name}')`;
    }

    if (type === "BLOB") return `blob('${name}')`;

    if (type.includes("TIMESTAMP") || type.includes("DATETIME")) {
      return `text('${name}')`; // In SQLite these are usually TEXT or INT. Drizzle uses text() with mode: "timestamp"
    }

    if (type === "JSON" || type === "JSONB") {
      return `text('${name}', { mode: 'json' })`;
    }

    return `text('${name}')`;
  }
}
