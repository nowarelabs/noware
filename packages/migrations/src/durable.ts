import { type Result, ok, safe } from "nomo/result";
import { sql, Statement, getDialectStrategy } from "nomo/sql";
import { Logger } from "nomo/logger";

/**
 * Utility for running SQL migrations within a Cloudflare Durable Object using ctx.storage.sql.
 * This should be called within ctx.blockConcurrencyWhile().
 */

export interface DOMigration {
  name: string;
  sql: string;
  durableObjectClass?: string;
}

export interface SqlStorage {
  exec(sql: string, ...params: unknown[]): { toArray(): unknown[] };
}

/**
 * Runs a set of SQL migrations against the Durable Object's SQLite storage.
 *
 * @param migrations Array of migrations to apply (usually imported from the generated bundle)
 * @param options Configuration options for migration
 */
export async function migrateDO(
  storage: SqlStorage,
  migrations: DOMigration[],
  options: { className?: string; logger?: Logger } = {},
): Promise<Result<void>> {
  const logger =
    options.logger ||
    new Logger({
      service: "migrations",
      context: { class_name: options.className },
    });
  const strategy = getDialectStrategy("sqlite");

  // 1. Ensure the migrations tracking table exists using structural builder
  const createTableStmt = new Statement([
    sql.key("CREATE TABLE IF NOT EXISTS "),
    sql.id("_migrations"),
    sql.op(" ("),
    sql.nl(),
    sql.indent(),
    sql.id("name"),
    sql.op(" "),
    sql.type("TEXT"),
    sql.op(" "),
    sql.primaryKey(),
    sql.op(","),
    sql.nl(),
    sql.indent(),
    sql.id("applied_at"),
    sql.op(" "),
    sql.type("TEXT"),
    sql.op(" "),
    sql.default(sql.currentTimestamp()),
    sql.nl(),
    sql.op(")"),
  ]);

  const ensureRes = safe(() => {
    const res = createTableStmt.toSql(strategy);
    if (!res.success) throw new Error(res.message);
    return storage.exec(res.data.value);
  });
  if (!ensureRes.success) return ensureRes as Result<never>;

  // 2. Fetch already applied migrations
  const selectStmt = new Statement([
    sql.key("SELECT "),
    sql.id("name"),
    sql.key(" FROM "),
    sql.id("_migrations"),
  ]);

  const fetchRes = safe(() => {
    const res = selectStmt.toSql(strategy);
    if (!res.success) throw new Error(res.message);
    return storage.exec(res.data.value).toArray();
  });

  if (!fetchRes.success) return fetchRes as Result<never>;
  const applied = fetchRes.data;
  const appliedNames = new Set(applied.map((m: any) => m.name));

  logger.info(`Found ${appliedNames.size} applied migrations.`);

  // 3. Apply missing migrations in sequence
  let appliedCount = 0;
  for (const m of migrations) {
    if (!appliedNames.has(m.name)) {
      // Filter by durableObjectClass: must have a class AND it must match the provided className
      if (m.durableObjectClass && m.durableObjectClass !== options.className) {
        logger.debug(
          `Skipping migration ${m.name}: targeted at ${m.durableObjectClass}, but running in ${options.className || "unspecified class"}`,
        );
        continue;
      }

      logger.info(`Applying migration: ${m.name}`);

      const applyRes = safe(() => {
        // Execute the migration SQL (bundled SQL is assumed to be safe or at least raw)
        storage.exec(m.sql);
        // Record that it was applied using parameterized query
        storage.exec("INSERT INTO _migrations (name) VALUES (?)", m.name);
      });

      if (!applyRes.success) return applyRes as Result<never>;

      appliedCount++;
    }
  }

  if (appliedCount > 0) {
    logger.info(`Successfully applied ${appliedCount} new migrations.`);
  } else {
    logger.debug(`No new migrations to apply.`);
  }

  return ok(undefined);
}
