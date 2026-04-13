/**
 * nomo/aggregates - BaseAggregate, event sourcing consistency boundary
 * 
 * Standard Gauge: BaseAggregate is the consistency boundary for event sourcing
 * 
 * Connection Flow:
 * BaseService → BaseAggregate → EventStore
 */

export type AggregateState = Record<string, unknown>;
export type AggregateEvent = Record<string, unknown>;

/* ============================================================================
 * BaseAggregate
 * ============================================================================ */

/**
 * BaseAggregate - Consistency Boundary for Event Sourcing
 * 
 * Connection: This layer → EventStore (only)
 */
export class BaseAggregate<
  TState extends AggregateState,
  TEvent extends AggregateEvent
> {
  protected id: string;
  protected version: number = 0;
  protected state: TState;
  protected events: TEvent[] = [];
  protected env: unknown;
  protected ctx?: unknown;

  // Static plugin points
  static commandHandlers: Array<(aggregate: BaseAggregate<any, any>, command: any) => Promise<any>> = [];
  static eventAppliers: Array<(event: TEvent) => Promise<void>> = [];
  static snapshotTriggers: Array<(version: number) => boolean> = [];

  constructor(id: string, env?: unknown, ctx?: unknown) {
    this.id = id;
    this.env = env;
    this.ctx = ctx;
    this.state = this.getInitialState();
  }

  /* -------------------------------------------------------------------------
   * State Management
   * ------------------------------------------------------------------------- */

  protected getInitialState(): TState {
    return {} as TState;
  }

  getState(): TState {
    return this.state;
  }

  getVersion(): number {
    return this.version;
  }

  getId(): string {
    return this.id;
  }

  /* -------------------------------------------------------------------------
   * Command Methods
   * ------------------------------------------------------------------------- */

  /**
   * Apply an event to change state
   */
  protected apply(event: TEvent): void {
    this.events.push(event);
    this.version++;

    // Run event appliers
    for (const applier of (this.constructor as typeof BaseAggregate).eventAppliers) {
      applier(event);
    }
  }

  /**
   * Commit - get events to be persisted
   */
  getEvents(): TEvent[] {
    return [...this.events];
  }

  /**
   * Clear committed events
   */
  clearEvents(): void {
    this.events = [];
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  /**
   * Called after command execution - save events to store
   */
  async afterCommand(): Promise<void> {
    // Override to save to event store
  }

  /**
   * Apply an event to state (for rebuilding)
   */
  async applyEvent(event: TEvent): Promise<void> {
    // Override with state transition logic
  }

  /**
   * Load aggregate from event store
   */
  static async load<T extends BaseAggregate<any, any>>(
    this: new (id: string, env?: unknown, ctx?: unknown) => T,
    id: string,
    env?: unknown,
    ctx?: unknown
  ): Promise<T> {
    // Override to load from event store
    throw new Error("Not implemented");
  }

  /**
   * Create snapshot
   */
  async createSnapshot(): Promise<void> {
    // Override to save snapshot
  }

  /**
   * Load from snapshot
   */
  static async fromSnapshot<T extends BaseAggregate<any, any>>(
    this: new (id: string, env?: unknown, ctx?: unknown) => T,
    snapshot: { id: string; version: number; state: TState },
    env?: unknown,
    ctx?: unknown
  ): Promise<T> {
    const aggregate = new this(snapshot.id, env, ctx);
    aggregate.version = snapshot.version;
    aggregate.state = snapshot.state;
    return aggregate;
  }

  /* -------------------------------------------------------------------------
   * Snapshot Triggers
   * ------------------------------------------------------------------------- */

  shouldSnapshot(): boolean {
    for (const trigger of (this.constructor as typeof BaseAggregate).snapshotTriggers) {
      if (trigger(this.version)) return true;
    }
    return false;
  }
}

/* ============================================================================
 * Export
 * ============================================================================ */

export { BaseAggregate, type AggregateState, type AggregateEvent };