/**
 * nomo/gateways - BaseInfrastructureAdapter for external service integrations
 * 
 * Standard Gauge: Gateways implement ports and connect to external services
 * 
 * Connection: Infrastructure → External Services (Stripe, SendGrid, etc.)
 */

import { BaseOutboundPort, IOrderRepository, IPaymentGateway, IEmailService, PortInput, PortOutput } from "nomo/ports";

/* ============================================================================
 * Circuit Breaker
 * ============================================================================ */

export type CircuitBreakerConfig = {
  failureThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
};

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private config: CircuitBreakerConfig = {}) {
    this.config.failureThreshold = config.failureThreshold || 5;
    this.config.timeout = config.timeout || 60000;
    this.config.resetTimeout = config.resetTimeout || 30000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.config.resetTimeout!) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.config.failureThreshold!) {
        this.state = 'open';
      }
      throw error;
    }
  }

  getState(): string {
    return this.state;
  }
}

/* ============================================================================
 * BaseInfrastructureAdapter
 * ============================================================================ */

/**
 * BaseInfrastructureAdapter - Port implementation (gateways)
 * 
 * Connection: This layer → implements BaseOutboundPort → calls External Service
 */
export abstract class BaseInfrastructureAdapter<TPort> {
  protected config: Record<string, unknown>;
  protected client?: unknown;
  protected circuitBreaker?: CircuitBreaker;

  // Static plugin points
  static beforeConnects: Array<() => Promise<void>> = [];
  static afterDisconnects: Array<() => Promise<void>> = [];
  static circuitBreakers: Record<string, CircuitBreakerConfig> = {};

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------------------- */

  async onConnect(): Promise<void> {
    // Override to initialize client
  }

  async onDisconnect(): Promise<void> {
    // Override to cleanup
  }

  /* -------------------------------------------------------------------------
   * Circuit Breaker
   * ------------------------------------------------------------------------- */

  protected async withCircuitBreaker<T>(
    fn: () => Promise<T>,
    options?: CircuitBreakerConfig
  ): Promise<T> {
    if (!this.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(options);
    }
    return this.circuitBreaker.execute(fn);
  }
}

/* ============================================================================
 * Concrete Adapters
 * ============================================================================ */

/**
 * Order Repository Adapter - implements IOrderRepository
 */
export class OrderRepositoryAdapter 
  extends BaseInfrastructureAdapter<IOrderRepository> 
  implements IOrderRepository 
{
  async findById(id: string): Promise<PortOutput> {
    // Implement with D1
    throw new Error("Not implemented");
  }

  async findByUserId(userId: string): Promise<PortOutput> {
    throw new Error("Not implemented");
  }

  async save(order: PortOutput): Promise<PortOutput> {
    throw new Error("Not implemented");
  }

  async delete(id: string): Promise<void> {
    throw new Error("Not implemented");
  }
}

/**
 * Payment Gateway Adapter - implements IPaymentGateway
 */
export class PaymentGatewayAdapter
  extends BaseInfrastructureAdapter<IPaymentGateway>
  implements IPaymentGateway
{
  async charge(input: PortInput): Promise<PortOutput> {
    return this.withCircuitBreaker(async () => {
      throw new Error("Not implemented - implement with Stripe");
    });
  }

  async refund(paymentId: string): Promise<PortOutput> {
    throw new Error("Not implemented");
  }
}

/**
 * Email Service Adapter - implements IEmailService
 */
export class EmailServiceAdapter
  extends BaseInfrastructureAdapter<IEmailService>
  implements IEmailService
{
  async send(to: string, subject: string, body: string): Promise<PortOutput> {
    return this.withCircuitBreaker(async () => {
      throw new Error("Not implemented - implement with SendGrid/Resend");
    });
  }
}

/* ============================================================================
 * Export
 * ============================================================================ */

export {
  BaseInfrastructureAdapter,
  CircuitBreaker,
  CircuitBreakerConfig,
  OrderRepositoryAdapter,
  PaymentGatewayAdapter,
  EmailServiceAdapter
};