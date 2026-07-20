// @ts-nocheck
/**
 * Simulated Postgres driver for demonstration purposes.
 *
 * Exposes the same `.prepare().bind().all()` interface that D1/PG clients
 * provide, but uses an in-memory Map for storage. The key point is that
 * @nowarelabs/models will emit $1, $2 positional placeholders when the
 * dialect is set to "postgres".
 */
export function createPgSim(rows: Map<string, any[]> = new Map()) {
  return {
    prepare(sql: string) {
      console.log(`  [pg-sim] SQL: ${sql}`);
      const stmt = {
        bind(...params: any[]) {
          console.log(`  [pg-sim] params: ${JSON.stringify(params)}`);
          return {
            all: async () => {
              let matched: any[] = [];
              for (const [key, val] of rows) {
                if (sql.includes(`"${key}"`) || sql.includes(`FROM ${key}`)) {
                  matched = val;
                  break;
                }
              }
              return { results: matched };
            },
          };
        },
      };
      return stmt;
    },
  };
}
