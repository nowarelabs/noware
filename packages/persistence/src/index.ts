/**
 * nomo/persistence - BasePersistence, data access driver
 * 
 * Standard Gauge: BasePersistence is the bottom of RCSM chain
 * 
 * Connection Flow: BaseModel → BasePersistence → Driver SDKs
 */

export type QueryResult = { results?: unknown[]; changes?: number; lastInsertRowid?: string };
export type TransactionFn = () => Promise<unknown>;

/* ============================================================================
 * BasePersistence
 * ============================================================================ */

/**
 * BasePersistence - Data Access Driver (D1/SQLite/KV)
 * 
 * Connection: This layer → Database Driver (RCSM pattern - one call)
 */
export class BasePersistence {
  protected driver: unknown;
  protected env: unknown;

  // Static plugin points
  static beforeQueries: Array<(sql: string, params: unknown[]) => Promise<{ sql: string; params: unknown[] }>> = [];
  static afterQueries: Array<(result: QueryResult) => Promise<QueryResult>> = [];
  static transactionLogs: Array<(fn: TransactionFn) => Promise<unknown>> = [];

  constructor(env?: unknown) {
    this.env = env;
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  async connect(): Promise<void> {
    // Override for connection
  }

  async disconnect(): Promise<void> {
    // Override for cleanup
  }

  /* -------------------------------------------------------------------------
   * Query Lifecycle
   * ------------------------------------------------------------------------- */

  async onQuery(sql: string, params: unknown[]): Promise<QueryResult> {
    let processed = { sql, params };

    // Run before hooks
    for (const hook of (this.constructor as typeof BasePersistence).beforeQueries) {
      processed = await hook(processed.sql, processed.params);
    }

    // Execute query
    const result = await this.executeRaw(processed.sql, processed.params);

    // Run after hooks
    for (const hook of (this.constructor as typeof BasePersistence).afterQueries) {
      return await hook(result);
    }

    return result;
  }

  async onTransaction(fn: TransactionFn): Promise<unknown> {
    // Run transaction logs
    for (const log of (this.constructor as typeof BasePersistence).transactionLogs) {
      await log(fn);
    }

    return fn();
  }

  /* -------------------------------------------------------------------------
   * Raw Queries (override with driver-specific implementation)
   * ------------------------------------------------------------------------- */

  protected async executeRaw(sql: string, params: unknown[]): Promise<QueryResult> {
    throw new Error("Not implemented");
  }

  async raw(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.onQuery(sql, params || []);
  }

  async all(sql: string, params?: unknown[]): Promise<unknown[]> {
    const result = await this.raw(sql, params);
    return result.results || [];
  }

  async get(sql: string, params?: unknown[]): Promise<unknown | null> {
    const results = await this.all(sql, params);
    return results[0] || null;
  }

  async run(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    const result = await this.raw(sql, params);
    return { changes: result.changes || 0 };
  }

  /* -------------------------------------------------------------------------
   * Helper Methods
   * ------------------------------------------------------------------------- */

  async exists(sql: string, params?: unknown[]): Promise<boolean> {
    const result = await this.get(sql, params);
    return result !== null;
  }

  async count(sql: string, params?: unknown[]): Promise<number> {
    const result = await this.get(sql, params);
    return (result as { count?: number })?.count || 0;
  }
}

/* ============================================================================
 * D1 Persistence (Cloudflare D1)
 * ============================================================================ */

export class D1Persistence extends BasePersistence {
  private d1: D1Database;

  constructor(d1: D1Database, env?: unknown) {
    super(env);
    this.d1 = d1;
    this.driver = d1;
  }

  protected async executeRaw(sql: string, params: unknown[]): Promise<QueryResult> {
    const result = await this.d1.prepare(sql).bind(params).all();
    return {
      results: result.results,
      changes: result.meta?.changes || 0,
      lastInsertRowid: result.meta?.last_row_id?.toString()
    };
  }
}

/* ============================================================================
 * Export
 * ============================================================================ */

export { BasePersistence, D1Persistence, type QueryResult, type TransactionFn };