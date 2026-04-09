import { type Result, ok, err, safeAsync } from "nomo/result";
import { Migration } from "../index";
import * as fs from "node:fs/promises";
import * as path from "pathe";

export class MigrationCompiler {
  private migrationsDir: string;
  private outDir: string;

  constructor() {
    this.migrationsDir = path.resolve(process.cwd(), "src/db/migrate");
    this.outDir = path.resolve(process.cwd(), "src/db/migrations");
  }

  /**
   * Set source directory for TS migrations
   */
  from(dir: string): this {
    this.migrationsDir = path.resolve(process.cwd(), dir);
    return this;
  }

  /**
   * Set output directory for SQL files
   */
  to(dir: string): this {
    this.outDir = path.resolve(process.cwd(), dir);
    return this;
  }

  /**
   * Compile TS migrations into SQL
   */
  async compile(): Promise<Result<this>> {
    return await safeAsync(async () => {
      await fs.mkdir(this.outDir, { recursive: true });

      const tempDbPath = path.resolve(process.cwd(), ".nomo/temp_compile.db");
      const metadataPath = path.resolve(process.cwd(), ".nomo/temp_metadata.json");
      const { execSync } = await import("node:child_process");

      // Clean up any existing temp files
      await fs.rm(path.dirname(metadataPath), { force: true }).catch(() => {});
      await fs.mkdir(path.dirname(metadataPath), { recursive: true });

      const allMetadata: Record<string, any[]> = {};

      const files = (await fs.readdir(this.migrationsDir))
        .filter((f) => f.endsWith(".ts"))
        .sort();

      console.log(
        `🔍 Found ${files.length} migrations in ${path.relative(process.cwd(), this.migrationsDir)}`,
      );

      for (const [index, file] of files.entries()) {
        const fullPath = path.join(this.migrationsDir, file);

        const module = await import(fullPath);
        const MigrationClass = module.default;

        if (!MigrationClass) {
          console.warn(`⚠️  No default export found in ${file}. Skipping.`);
          continue;
        }

        const migration = new MigrationClass({
          run: async () => ok({}),
          all: async () => ok([]),
        }) as Migration;

        const sqlResArr = await migration.toSql("up");
        if (!sqlResArr.success) return sqlResArr as Result<never>;
        const upSql = sqlResArr.data;

        // Collect metadata
        const metadata = migration.getMetadata();
        for (const [table, relationships] of Object.entries(metadata)) {
          allMetadata[table] = [...(allMetadata[table] || []), ...relationships];
        }

        const { spawnSync } = await import("node:child_process");
        // Execute SQL against temp DB to evolve schema
        for (const statement of upSql) {
          const res = spawnSync("sqlite3", [tempDbPath], {
            input: statement,
            encoding: "utf-8",
          });
          if (res.status !== 0) {
            return err(
              `Error evolving schema in temp DB while compiling ${file}: ${res.stderr}`,
            );
          }
        }

        // D1 format: 0001_name.sql
        const prefix = (index + 1).toString().padStart(4, "0");
        const name = file.replace(/^\d+_/, "").replace(".ts", "");
        const sqlFileName = `${prefix}_${name}.sql`;
        const sqlFilePath = path.join(this.outDir, sqlFileName);

        let finalSql = upSql.join("\n");
        if (migration.durableObjectClass) {
          finalSql =
            `-- @durableObjectClass: ${migration.durableObjectClass}\n` +
            finalSql;
        }

        await fs.writeFile(sqlFilePath, finalSql);
        console.log(`  ✨ Compiled: ${sqlFileName}`);
      }

      // Save metadata
      await fs.writeFile(metadataPath, JSON.stringify(allMetadata, null, 2));

      // Keep temp DB if needed for sync/reflect, otherwise clean up
      await fs.rm(tempDbPath, { force: true }).catch(() => {});

      return this;
    });
  }
}
