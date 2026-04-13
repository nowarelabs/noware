/**
 * nomo/query - BaseQueryController and BaseQueryProjection for optimized reads
 * 
 * Standard Gauge: CQRS read side
 * 
 * Connection Flow:
 * BaseRpcServer → BaseQueryController → BaseQueryProjection → BasePersistence
 */

export type QueryParams = Record<string, unknown>;
export type ProjectionEntity = Record<string, unknown>;

/* ============================================================================
 * BaseQueryProjection
 * ============================================================================ */

/**
 * BaseQueryProjection - Hydrating View Models from Events
 * 
 * Connection: This layer → BasePersistence (RCSM pattern - one call)
 */
export class BaseQueryProjection<
  TEntity extends ProjectionEntity
> {
  protected db: unknown;
  protected tableName: string;
  protected req?: Request;
  protected env?: unknown;
  protected ctx?: unknown;

  // Static plugin points
  static eventHandlers: Array<(event: unknown) => Promise<void>> = [];
  static rebuildTriggers: Array<(entityId: string) => Promise<void>> = [];

  constructor(db: unknown, req?: Request, env?: unknown, ctx?: unknown) {
    this.db = db;
    this.req = req;
    this.env = env;
    this.ctx = ctx;
  }

  /* -------------------------------------------------------------------------
   * Event Handling
   * ------------------------------------------------------------------------- */

  /**
   * Handle event - update projection
   */
  async onEvent(event: unknown): Promise<void> {
    // Run handlers
    for (const handler of (this.constructor as typeof BaseQueryProjection).eventHandlers) {
      await handler(event);
    }
  }

  /**
   * Rebuild from events
   */
  async rebuild(entityId: string): Promise<void> {
    for (const trigger of (this.constructor as typeof BaseQueryProjection).rebuildTriggers) {
      await trigger(entityId);
    }
  }

  /* -------------------------------------------------------------------------
   * Projection Operations
   * ------------------------------------------------------------------------- */

  async upsert(id: string, data: Partial<TEntity>): Promise<void> {
    throw new Error("Not implemented");
  }

  async update(id: string, data: Partial<TEntity>): Promise<void> {
    throw new Error("Not implemented");
  }

  async delete(id: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async findById(id: string): Promise<TEntity | null> {
    throw new Error("Not implemented");
  }

  async findByIds(ids: string[]): Promise<TEntity[]> {
    throw new Error("Not implemented");
  }

  async findAll(): Promise<TEntity[]> {
    throw new Error("Not implemented");
  }

  async findWhere(conditions: Record<string, unknown>): Promise<TEntity[]> {
    throw new Error("Not implemented");
  }

  /* -------------------------------------------------------------------------
   * Materialized Views
   * ------------------------------------------------------------------------- */

  async materialize(): Promise<void> {
    throw new Error("Not implemented");
  }

  async refresh(): Promise<void> {
    throw new Error("Not implemented");
  }
}

/* ============================================================================
 * BaseQueryController
 * ============================================================================ */

/**
 * BaseQueryController - Optimized "Fast-Path" Reads
 * 
 * Connection: This layer → BaseQueryProjection (RCSM pattern - one call)
 */
export class BaseQueryController<
  TEnv,
  TCtx,
  TProjection extends BaseQueryProjection<any>
> {
  protected env: TEnv;
  protected ctx: TCtx;
  protected projection!: TProjection;

  // Static plugin points
  static beforeFetches: Array<(query: QueryParams) => Promise<QueryParams>> = [];
  static afterFetches: Array<(result: unknown) => Promise<unknown>> = [];
  static outputFormats: Array<(result: unknown) => Promise<unknown>> = [];

  constructor(env: TEnv, ctx: TCtx) {
    this.env = env;
    this.ctx = ctx;
    this.projection = this.getProjection();
  }

  // Abstract - implement to return projection
  protected getProjection(): TProjection {
    throw new Error("Not implemented");
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  async beforeFetch(query: QueryParams): Promise<QueryParams> {
    let processed = { ...query };
    for (const hook of (this.constructor as typeof BaseQueryController).beforeFetches) {
      processed = await hook(processed);
    }
    return processed;
  }

  async afterFetch(result: unknown): Promise<unknown> {
    let processed = result;
    for (const hook of (this.constructor as typeof BaseQueryController).afterFetches) {
      processed = await hook(processed);
    }
    return processed;
  }

  /* -------------------------------------------------------------------------
   * Query Methods
   * ------------------------------------------------------------------------- */

  async getById(id: string): Promise<unknown> {
    const result = await this.projection.findById(id);
    return this.afterFetch(result);
  }

  async getByIds(ids: string[]): Promise<unknown[]> {
    const result = await this.projection.findByIds(ids);
    return this.afterFetch(result);
  }

  async list(params?: QueryParams): Promise<unknown[]> {
    const query = await this.beforeFetch(params || {});
    const result = await this.projection.findWhere(query);
    return this.afterFetch(result);
  }

  async paginate(page: number, perPage: number): Promise<{ data: unknown[]; total: number; page: number; perPage: number }> {
    const result = await this.projection.findAll();
    const start = (page - 1) * perPage;
    const data = result.slice(start, start + perPage);
    return {
      data: await this.afterFetch(data),
      total: result.length,
      page,
      perPage
    };
  }
}

/* ============================================================================
 * Export
 * ============================================================================ */

export {
  BaseQueryController,
  BaseQueryProjection,
  type QueryParams,
  type ProjectionEntity
};