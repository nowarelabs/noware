/**
 * nomo/events - BaseDomainEvent for internal domain events
 * 
 * Standard Gauge: Domain events are internal-only, different from integration events
 * 
 * Connection: EventBus (internal) → Handlers within same context
 */

export type DomainEventType = Record<string, unknown>;

/* ============================================================================
 * BaseDomainEvent
 * ============================================================================ */

/**
 * BaseDomainEvent - Internal domain event
 * 
 * Connection: This layer → stays within context (no EventBus)
 */
export class BaseDomainEvent<T extends DomainEventType> {
  static readonly name: string;
  static readonly version: number = 1;
  
  public readonly timestamp: Date;
  public readonly payload: T;

  constructor(payload: T) {
    this.payload = payload;
    this.timestamp = new Date();
  }

  getName(): string {
    return (this.constructor as typeof BaseDomainEvent).name;
  }

  getVersion(): number {
    return (this.constructor as typeof BaseDomainEvent).version;
  }
}

/* ============================================================================
 * Domain Event Bus (Internal)
 * ============================================================================ */

/**
 * DomainEventBus - Internal event bus (within same context)
 */
export class DomainEventBus {
  private handlers: Map<string, Array<(event: BaseDomainEvent<any>) => Promise<void>>> = new Map();

  /**
   * Register handler for an event
   */
  on<T extends DomainEventType>(
    eventClass: new (payload: T) => BaseDomainEvent<T>,
    handler: (event: BaseDomainEvent<T>) => Promise<void>
  ): void {
    const eventName = (eventClass as any).name;
    const handlers = this.handlers.get(eventName) || [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  /**
   * Emit event to handlers
   */
  async emit<T extends DomainEventType>(event: BaseDomainEvent<T>): Promise<void> {
    const eventName = event.getName();
    const handlers = this.handlers.get(eventName);
    
    if (!handlers) return;

    await Promise.all(
      handlers.map(handler => handler(event).catch(console.error))
    );
  }

  /**
   * Clear handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

/* ============================================================================
 * Common Domain Events
 * ============================================================================ */

export class CreatedEvent extends BaseDomainEvent<{ id: string; [key: string]: unknown }> {
  static readonly name = 'created';
}

export class UpdatedEvent extends BaseDomainEvent<{ id: string; changes: Record<string, unknown> }> {
  static readonly name = 'updated';
}

export class DeletedEvent extends BaseDomainEvent<{ id: string }> {
  static readonly name = 'deleted';
}