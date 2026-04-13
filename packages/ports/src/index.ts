/**
 * nomo/ports - BasePort interfaces for hexagonal architecture
 * 
 * Standard Gauge: Ports define interfaces, Adapters implement them
 * 
 * Connection: Core/ports → Infrastructure/adapters
 */

export type PortInput = Record<string, unknown>;
export type PortOutput = unknown;

/* ============================================================================
 * Inbound Ports (Core exposes these)
 * ============================================================================ */

/**
 * Inbound port - what the domain exposes to the outside
 */
export interface IPlaceOrderUseCase {
  execute(input: PortInput): Promise<PortOutput>;
}

export interface IOrderQueries {
  getById(id: string): Promise<PortOutput>;
  list(params: PortInput): Promise<PortOutput>;
}

/* ============================================================================
 * Outbound Ports (Core needs these)
 * ============================================================================ */

/**
 * Outbound port - what the domain needs from infrastructure
 */
export interface IOrderRepository {
  findById(id: string): Promise<PortOutput>;
  findByUserId(userId: string): Promise<PortOutput>;
  save(order: PortOutput): Promise<PortOutput>;
  delete(id: string): Promise<void>;
}

export interface IPaymentGateway {
  charge(input: PortInput): Promise<PortOutput>;
  refund(paymentId: string): Promise<PortOutput>;
}

export interface IEmailService {
  send(to: string, subject: string, body: string): Promise<PortOutput>;
}

export interface IEventStore {
  append(aggregateId: string, events: unknown[]): Promise<void>;
  getEvents(aggregateId: string): Promise<unknown[]>;
}

/* ============================================================================
 * BasePort (abstract class)
 * ============================================================================ */

/**
 * BasePort - Abstract port base class
 */
export abstract class BasePort<TInput, TOutput> {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  abstract execute(input: TInput): Promise<TOutput>;
}

/* ============================================================================
 * Inbound Port Implementation
 * ============================================================================ */

export abstract class BaseInboundPort<
  TInput extends PortInput,
  TOutput
> extends BasePort<TInput, TOutput> {
  constructor(name: string) {
    super(name);
  }

  abstract execute(input: TInput): Promise<TOutput>;
}

/* ============================================================================
 * Outbound Port Implementation  
 * ============================================================================ */

export abstract class BaseOutboundPort<
  TInput extends PortInput,
  TOutput
> extends BasePort<TInput, TOutput> {
  protected adapter?: unknown;

  constructor(name: string) {
    super(name);
  }

  setAdapter(adapter: unknown): void {
    this.adapter = adapter;
  }

  getAdapter(): unknown {
    if (!this.adapter) {
      throw new Error(`Adapter not set for port: ${this.name}`);
    }
    return this.adapter;
  }

  abstract execute(input: TInput): Promise<TOutput>;
}