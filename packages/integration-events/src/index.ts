/**
 * nomo/integration-events - BaseIntegrationEvent, cross-context broadcast
 * 
 * Standard Gauge: BaseIntegrationEvent publishes to EventBus for cross-context communication
 * 
 * Connection Flow: Context → EventBus → Other Contexts
 */

export type IntegrationEventPayload = Record<string, unknown>;

/* ============================================================================
 * BaseIntegrationEvent
 * ============================================================================ */

/**
 * BaseIntegrationEvent - Cross-Context Broadcast
 * 
 * Connection: This layer → EventBus (only)
 */
export class BaseIntegrationEvent<T extends IntegrationEventPayload> {
  static readonly name: string;
  static readonly version: number = 1;
  
  protected eventBus?: EventBus;
  protected payload?: T;

  // Static plugin points
  static serializers: Array<(event: T) => Promise<string>> = [];
  static deserializers: Array<(data: string) => Promise<T>> = [];

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus;
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  /**
   * Publish event to event bus
   */
  async onPublish(event: T): Promise<void> {
    if (!this.eventBus) {
      throw new Error("EventBus not configured");
    }
    
    let serialized = JSON.stringify(event);
    
    // Run serializers
    for (const serializer of (this.constructor as typeof BaseIntegrationEvent).serializers) {
      serialized = await serializer(event);
    }
    
    await this.eventBus.publish((this.constructor as typeof BaseIntegrationEvent).name, serialized);
  }

  /**
   * Receive event from event bus
   */
  async onReceive(data: string): Promise<T> {
    let payload = JSON.parse(data) as T;
    
    // Run deserializers
    for (const deserializer of (this.constructor as typeof BaseIntegrationEvent).deserializers) {
      payload = await deserializer(data);
    }
    
    this.payload = payload;
    return payload;
  }

  /* -------------------------------------------------------------------------
   * Serialization
   * ------------------------------------------------------------------------- */

  async serialize(event: T): Promise<string> {
    return JSON.stringify(event);
  }

  async deserialize(data: string): Promise<T> {
    return JSON.parse(data) as T;
  }

  /* -------------------------------------------------------------------------
   * Subscription (static pattern)
   * ------------------------------------------------------------------------- */

  static subscribe(handler: (event: T) => Promise<void>): void {
    // Register handler with EventBus
  }

  static unsubscribe(): void {
    // Remove handler from EventBus
  }
}

/* ============================================================================
 * Event Bus
 * ============================================================================ */

export class EventBus {
  private subscriptions: Map<string, Array<(data: string) => Promise<void>>> = new Map();

  /**
   * Subscribe to an event
   */
  subscribe(eventName: string, handler: (data: string) => Promise<void>): void {
    const handlers = this.subscriptions.get(eventName) || [];
    handlers.push(handler);
    this.subscriptions.set(eventName, handlers);
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(eventName: string): void {
    this.subscriptions.delete(eventName);
  }

  /**
   * Publish an event
   */
  async publish(eventName: string, data: string): Promise<void> {
    const handlers = this.subscriptions.get(eventName);
    if (!handlers) return;

    await Promise.all(
      handlers.map(handler => handler(data).catch(console.error))
    );
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
  }
}

/* ============================================================================
 * Export
 * ============================================================================ */

export { BaseIntegrationEvent, EventBus, type IntegrationEventPayload };