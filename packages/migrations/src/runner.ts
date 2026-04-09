import { type Result, ok, safeAsync } from "nomo/result";
import { consola } from "consola";
import { hash } from "ohash";
import { sql as sqlTag } from "./index";
import type { Migration } from "./index";
import { sql as sqlBuilder, getDialectStrategy } from "nomo/sql";

/**
 * Migration Runner for Cloudflare environment (D1/DO)
 */
export class MigrationRunner {
  private migrations: Migration[] = [];

  constructor(private db: any) {}

  /**
   * Set the migrations to operate on
   */
  use(migrations: Migration[]): this {
    this.migrations = migrations;
    return this;
  }

  /**
   * Ensure the migrations table exists
   */
  async ensureMigrationsTable(): Promise<Result<this>> {
    const stmt = sqlBuilder.statement([
      sqlBuilder.key("CREATE TABLE IF NOT EXISTS "),
      sqlBuilder.id("schema_migrations"),
      sqlBuilder.op(" ("),
      sqlBuilder.nl(),
      sqlBuilder.indent(),
      sqlBuilder.id("version"),
      sqlBuilder.op(" "),
      sqlBuilder.type("TEXT"),
      sqlBuilder.op(" "),
      sqlBuilder.primaryKey(),
      sqlBuilder.op(","),
      sqlBuilder.nl(),
      sqlBuilder.indent(),
      sqlBuilder.id("applied_at"),
      sqlBuilder.op(" "),
      sqlBuilder.type("TEXT"),
      sqlBuilder.op(" "),
      sqlBuilder.key("NOT NULL"),
      sqlBuilder.op(" "),
      sqlBuilder.key("DEFAULT CURRENT_TIMESTAMP"),
      sqlBuilder.nl(),
      sqlBuilder.op(","),
      sqlBuilder.nl(),
      sqlBuilder.indent(),
      sqlBuilder.id("checksum"),
      sqlBuilder.op(" "),
      sqlBuilder.type("TEXT"),
      sqlBuilder.nl(),
      sqlBuilder.op(")"),
    ]);

    const sqlRes = stmt.toSql(getDialectStrategy("sqlite"));
    if (!sqlRes.success) return sqlRes as Result<never>;

    const res = await this.db.run({ sql: sqlRes.data.value, __isSql: true });
    if (!res.success) return res as Result<never>;
    return ok(this);
  }

  /**
   * Get applied migration versions
   */
  async getAppliedVersions(): Promise<Result<string[]>> {
    const res = await this.db.all(
      sqlTag`SELECT version FROM schema_migrations ORDER BY version ASC;`,
    );
    if (!res.success) return res as Result<never>;
    return ok(res.data.map((r: any) => r.version));
  }

  /**
   * Run a migration up
   */
  async runUp(migration: Migration): Promise<Result<this>> {
    consola.start(`Migrating ${migration.constructor.name}...`);
    const start = Date.now();
    const upRes = await migration.up();
    if (!upRes.success) return upRes as Result<never>;

    // Generate checksum using ohash
    const checksum = hash(migration.toString());

    const dbRes = await this.db.run(
      sqlTag`INSERT INTO schema_migrations (version, checksum) VALUES (${migration.version}, ${checksum});`,
    );
    if (!dbRes.success) return dbRes as Result<never>;

    const duration = ((Date.now() - start) / 1000).toFixed(4);
    consola.success(`Migrated ${migration.constructor.name} (${duration}s)`);
    return ok(this);
  }

  /**
   * Run a migration down
   */
  async runDown(migration: Migration): Promise<Result<this>> {
    consola.start(`Reverting ${migration.constructor.name}...`);
    const start = Date.now();
    const downRes = await migration.down();
    if (!downRes.success) return downRes as Result<never>;

    const dbRes = await this.db.run(
      sqlTag`DELETE FROM schema_migrations WHERE version = ${migration.version};`,
    );
    if (!dbRes.success) return dbRes as Result<never>;

    const duration = ((Date.now() - start) / 1000).toFixed(4);
    consola.success(`Reverted ${migration.constructor.name} (${duration}s)`);
    return ok(this);
  }

  /**
   * Migrate up to the latest or a specific version
   */
  async up(targetVersion?: string): Promise<Result<this>> {
    const ensureRes = await this.ensureMigrationsTable();
    if (!ensureRes.success) return ensureRes;

    const appliedRes = await this.getAppliedVersions();
    if (!appliedRes.success) return appliedRes as Result<never>;
    const applied = appliedRes.data;

    let pending = this.migrations
      .filter((m) => !applied.includes(m.version))
      .sort((a, b) => a.version.localeCompare(b.version));

    if (targetVersion) {
      pending = pending.filter((m) => m.version <= targetVersion);
    }

    if (pending.length === 0) {
      consola.info("No pending migrations.");
      return ok(this);
    }

    for (const m of pending) {
      const runRes = await this.runUp(m);
      if (!runRes.success) return runRes;
    }
    consola.success("All migrations completed successfully.");
    return ok(this);
  }

  /**
   * Migrate up using batch API (D1 optimized)
   */
  async upBatch(targetVersion?: string): Promise<Result<this>> {
    if (!this.db.batch) return this.up(targetVersion);

    const ensureRes = await this.ensureMigrationsTable();
    if (!ensureRes.success) return ensureRes;

    const appliedRes = await this.getAppliedVersions();
    if (!appliedRes.success) return appliedRes as Result<never>;
    const applied = appliedRes.data;

    let pending = this.migrations
      .filter((m) => !applied.includes(m.version))
      .sort((a, b) => a.version.localeCompare(b.version));

    if (targetVersion) {
      pending = pending.filter((m) => m.version <= targetVersion);
    }

    if (pending.length === 0) {
      consola.info("No pending migrations.");
      return ok(this);
    }

    const batchStmts: any[] = [];
    for (const m of pending) {
      const sqlsRes = await m.toSql("up");
      if (!sqlsRes.success) return sqlsRes as Result<never>;

      const checksum = hash(m.toString());

      sqlsRes.data.forEach((s) => batchStmts.push({ sql: s, __isSql: true }));
      batchStmts.push(
        sqlTag`INSERT INTO schema_migrations (version, checksum) VALUES (${m.version}, ${checksum});`,
      );
    }

    consola.info(`Running ${pending.length} migrations in batch...`);
    const res = await this.db.batch(batchStmts);
    if (!res.success) return res as Result<never>;

    consola.success("All migrations completed successfully via batch.");
    return ok(this);
  }

  /**
   * Rollback a specific number of steps
   */
  async rollback(steps: number = 1): Promise<Result<this>> {
    const ensureRes = await this.ensureMigrationsTable();
    if (!ensureRes.success) return ensureRes;

    const appliedRes = await this.getAppliedVersions();
    if (!appliedRes.success) return appliedRes as Result<never>;
    const applied = appliedRes.data;

    const toRollback = this.migrations
      .filter((m) => applied.includes(m.version))
      .sort((a, b) => b.version.localeCompare(a.version))
      .slice(0, steps);

    if (toRollback.length === 0) {
      consola.info("No migrations to rollback.");
      return ok(this);
    }

    for (const m of toRollback) {
      const runRes = await this.runDown(m);
      if (!runRes.success) return runRes;
    }
    consola.success("Rollback completed successfully.");
    return ok(this);
  }

  /**
   * Reset the database by dropping everything and re-running migrations
   */
  async reset(): Promise<Result<this>> {
    consola.warn("Resetting database...");
    const tablesRes = await this.db.all(
      sqlTag`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`,
    );
    if (!tablesRes.success) return tablesRes as Result<never>;
    const tables = tablesRes.data;

    for (const table of tables) {
      const dropRes = await this.db.run(
        sqlTag.raw(`DROP TABLE IF EXISTS ${table.name};`),
      );
      if (!dropRes.success) return dropRes as Result<never>;
    }
    consola.success("Database cleared.");
    return await this.up();
  }

  /**
   * Show migration status
   */
  async status(): Promise<Result<this>> {
    const ensureRes = await this.ensureMigrationsTable();
    if (!ensureRes.success) return ensureRes;

    const appliedRes = await this.getAppliedVersions();
    if (!appliedRes.success) return appliedRes as Result<never>;
    const applied = appliedRes.data;

    consola.log("");
    consola.info("Migration Status:");
    
    const rows = this.migrations
      .sort((a, b) => a.version.localeCompare(b.version))
      .map((m) => {
        const isApplied = applied.includes(m.version);
        return {
          Status: isApplied ? "up" : "down",
          Version: m.version,
          Name: m.constructor.name,
        };
      });

    console.table(rows);
    return ok(this);
  }

  /**
   * Run SQLite optimization
   */
  async optimize(): Promise<Result<this>> {
    consola.info("Running PRAGMA optimize...");
    const res = await this.db.run(sqlTag`PRAGMA optimize;`);
    if (!res.success) return res as Result<never>;
    return ok(this);
  }

  /**
   * Run SQLite analysis
   */
  async analyze(): Promise<Result<this>> {
    consola.info("Running ANALYZE...");
    const res = await this.db.run(sqlTag`ANALYZE;`);
    if (!res.success) return res as Result<never>;
    return ok(this);
  }
}
