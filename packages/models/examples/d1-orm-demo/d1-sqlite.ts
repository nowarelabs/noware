// @ts-nocheck — bun:sqlite types are provided by Bun at runtime
/**
 * D1-compatible SQLite wrapper using bun:sqlite.
 *
 * Exposes the same `.prepare().bind().all()` interface that Cloudflare D1
 * provides, so the models package takes the parameterized-query path.
 */
import { Database } from "bun:sqlite";

export function createD1(db: Database) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...params: any[]) {
          return {
            all() {
              const rows = stmt.all(...params);
              return Promise.resolve({ results: rows });
            },
          };
        },
      };
    },

    // Fallback path — not used when prepare() is available, but kept for
    // completeness if someone calls execSql directly.
    async execSql(sql: string) {
      return db.query(sql).all();
    },
  };
}
