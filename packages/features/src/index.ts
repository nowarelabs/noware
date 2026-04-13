/**
 * nomo/features - FeatureHandler, Feature contracts, and orchestration layer
 * 
 * Standard Gauge: FeatureHandler is the orchestration layer that can call multiple BaseRpc instances.
 * 
 * Connection Flow:
 * BaseRpcServer → FeatureHandler → BaseRpc (Tier 2) → Controller → Service → Model → Persistence
 */

import { BaseRpc } from "nomo/rpc";

/* ============================================================================
 * Types
 * ============================================================================ */

export type FeatureInput = Record<string, unknown>;
export type FeatureOutput = unknown;

export type FeaturePlugin<TInput extends FeatureInput = FeatureInput> = {
  name: string;
  version: string;
  beforeExecute?: (input: TInput) => Promise<void> | void;
  afterExecute?: (output: unknown) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;
};

export type FeatureContract<TInput extends FeatureInput, TOutput> = {
  input: TInput;
  output: TOutput;
};

/* ============================================================================
 * FeatureHandler
 * ============================================================================ */

/**
 * BaseFeatureHandler - The Orchestrator
 * 
 * Connection: This layer → BaseRpc (multiple allowed)
 * 
 * Lifecycle: validate() → prepare() → execute() → finalize()
 * 
 * FeatureHandler is the ONLY layer that can call multiple RCSM chains.
 */
export abstract class BaseFeatureHandler<
  TInput extends FeatureInput,
  TOutput
> {
  // Static plugin points
  static beforeExecutes: Array<(input: TInput) => Promise<void>> = [];
  static afterExecutes: Array<(output: TOutput) => Promise<void>> = [];
  static validators: Array<(input: TInput) => Promise<void>> = [];
  static plugins: FeaturePlugin[] = [];

  protected input: TInput;
  protected output?: TOutput;
  protected env: unknown;
  protected ctx?: unknown;

  // REFERENCES - multiple Rpc calls for orchestration
  protected ordersRpc?: BaseRpc<FeatureInput, unknown>;
  protected paymentsRpc?: BaseRpc<FeatureInput, unknown>;
  protected inventoryRpc?: BaseRpc<FeatureInput, unknown>;
  protected usersRpc?: BaseRpc<FeatureInput, unknown>;
  protected productsRpc?: BaseRpc<FeatureInput, unknown>;
  protected notificationsRpc?: BaseRpc<FeatureInput, unknown>;

  constructor(input: TInput, env: unknown, ctx?: unknown) {
    this.input = input;
    this.env = env;
    this.ctx = ctx;
  }

  /**
   * Get RPC reference by name
   */
  protected getRpc<T extends BaseRpc<FeatureInput, unknown>>(name: string): T | undefined {
    return (this as unknown as Record<string, T>)[name];
  }

  /**
   * Set RPC reference
   */
  protected setRpc<T extends BaseRpc<FeatureInput, unknown>>(name: string, rpc: T): void {
    (this as unknown as Record<string, T>)[name] = rpc;
  }

  /* -------------------------------------------------------------------------
   * Lifecycle Phases (override in subclass)
   * ------------------------------------------------------------------------- */

  /**
   * Phase 1: Validate - Business rule validation
   */
  async validate(input: TInput): Promise<void> {
    // Override with business rules
  }

  /**
   * Phase 2: Prepare - Gather data from multiple sources
   */
  async prepare(input: TInput): Promise<Record<string, unknown>> {
    return {};
  }

  /**
   * Phase 3: Execute - Core logic (orchestrate RCSM calls)
   */
  async execute(prepared: Record<string, unknown>): Promise<TOutput> {
    throw new Error("Not implemented");
  }

  /**
   * Phase 4: Finalize - Emit events, side effects
   */
  async finalize(output: TOutput): Promise<void> {
    // Override for events
  }

  /* -------------------------------------------------------------------------
   * Hooks
   * ------------------------------------------------------------------------- */

  async beforeExecute(input: TInput): Promise<void> {
    // Run static hooks
    for (const hook of (this.constructor as typeof BaseFeatureHandler).beforeExecutes) {
      await hook(input);
    }
    // Run plugins
    for (const plugin of (this.constructor as typeof BaseFeatureHandler).plugins) {
      await plugin.beforeExecute?.(input);
    }
  }

  async afterExecute(output: TOutput): Promise<void> {
    // Run static hooks
    for (const hook of (this.constructor as typeof BaseFeatureHandler).afterExecutes) {
      await hook(output);
    }
    // Run plugins
    for (const plugin of (this.constructor as typeof BaseFeatureHandler).plugins) {
      await plugin.afterExecute?.(output);
    }
  }

  async onError(error: Error): Promise<void> {
    // Run plugins
    for (const plugin of (this.constructor as typeof BaseFeatureHandler).plugins) {
      await plugin.onError?.(error);
    }
  }

  /* -------------------------------------------------------------------------
   * Internal RPC - Call Tier 2 RPC
   * ------------------------------------------------------------------------- */

  /**
   * Call BaseRpc (Tier 2) - REQUIRED for RCSM calls
   * This ensures the flow: FeatureHandler → Rpc → Controller → Service → Model
   */
  protected async dispatch<T>(
    rpc: BaseRpc<FeatureInput, unknown>,
    action: string,
    params: Record<string, unknown>
  ): Promise<T> {
    return await rpc.dispatch(action, params) as T;
  }

  /* -------------------------------------------------------------------------
   * Run the complete flow
   * ------------------------------------------------------------------------- */

  async run(input: TInput): Promise<TOutput> {
    try {
      // Before hooks
      await this.beforeExecute(input);

      // Phase 1: Validate
      await this.validate(input);

      // Phase 2: Prepare
      const prepared = await this.prepare(input);

      // Phase 3: Execute
      const output = await this.execute(prepared);
      this.output = output;

      // Phase 4: Finalize
      await this.finalize(output);

      // After hooks
      await this.afterExecute(output);

      return output;
    } catch (error) {
      await this.onError(error as Error);
      throw error;
    }
  }
}

/* ============================================================================
 * Feature Contract
 * ============================================================================ */

export class FeatureContractInput<T extends FeatureInput> {
  constructor(public data: T) {}
}

export class FeatureContractOutput<T> {
  constructor(public data: T) {}
}

/* ============================================================================
 * Simple Feature Handler (for straightforward workflows)
 * ============================================================================ */

/**
 * SimpleFeatureHandler - for features that just need to call one RCSM chain
 */
export abstract class SimpleFeatureHandler<
  TInput extends FeatureInput,
  TOutput
> extends BaseFeatureHandler<TInput, TOutput> {
  protected rpc?: BaseRpc<FeatureInput, TOutput>;

  constructor(input: TInput, env: unknown, ctx?: unknown) {
    super(input, env, ctx);
  }

  async execute(prepared: Record<string, unknown>): Promise<TOutput> {
    if (!this.rpc) {
      throw new Error("RPC not configured");
    }
    return await this.dispatch<TOutput>(this.rpc, this.getActionName(), prepared as FeatureInput);
  }

  protected getActionName(): string {
    return "execute";
  }
}
