import type { GateConfig, GateContext, GateDecision, GateResult } from "./types.js";
import { defaultConfig } from "./config.js";
import { schemaGate } from "./gates/schema.gate.js";
import { semanticGate } from "./gates/semantic.gate.js";
import { orderingGate } from "./gates/ordering.gate.js";
import { ProvenanceTracker, provenanceGate } from "./gates/provenance.gate.js";
import { ConsistencyChecker, consistencyGate } from "./gates/consistency.gate.js";

export class EntropyGate {
  private config: Required<Omit<GateConfig, "circuitBreaker">> & {
    circuitBreaker?: GateConfig["circuitBreaker"];
  };
  private provenanceTracker = new ProvenanceTracker();
  private consistencyChecker = new ConsistencyChecker();
  private failureCount = 0;
  private circuitOpenUntil = 0;

  constructor(config: GateConfig = {}) {
    this.config = {
      schema: config.schema ?? true,
      semantic: config.semantic ?? true,
      ordering: config.ordering ?? true,
      provenance: config.provenance ?? true,
      consistency: config.consistency ?? true,
      stageOrder: config.stageOrder ?? defaultConfig.stageOrder!,
      maxConcurrent: config.maxConcurrent ?? defaultConfig.maxConcurrent!,
      circuitBreaker: config.circuitBreaker ?? defaultConfig.circuitBreaker,
    };
  }

  async evaluate(input: unknown, context: GateContext): Promise<GateDecision> {
    const gates: GateResult[] = [];
    const timestamp = Date.now();

    if (this.config.circuitBreaker) {
      const { threshold } = this.config.circuitBreaker;
      if (this.failureCount >= threshold) {
        if (Date.now() < this.circuitOpenUntil) {
          gates.push({
            pass: false,
            gate: "circuit-breaker",
            reason: `Circuit breaker open. ${this.failureCount} failures. Retry after ${new Date(this.circuitOpenUntil).toISOString()}`,
          });
          return {
            allowed: false,
            gates,
            timestamp,
            sourceAgent: context.sourceAgent,
            targetAgent: context.targetAgent,
          };
        }
        this.failureCount = 0;
      }
    }

    if (this.config.schema) {
      const result = schemaGate(input, {
        metadata: context.metadata,
        stageOrder: this.config.stageOrder,
      });
      gates.push(result);
      if (!result.pass) {
        this.recordFailure();
        return {
          allowed: false,
          gates,
          timestamp,
          sourceAgent: context.sourceAgent,
          targetAgent: context.targetAgent,
        };
      }
    }

    if (this.config.semantic) {
      const result = semanticGate(input, context);
      gates.push(result);
      if (!result.pass) {
        this.recordFailure();
        return {
          allowed: false,
          gates,
          timestamp,
          sourceAgent: context.sourceAgent,
          targetAgent: context.targetAgent,
        };
      }
    }

    if (this.config.ordering) {
      const result = orderingGate(input, context, this.config as GateConfig);
      gates.push(result);
      if (!result.pass) {
        this.recordFailure();
        return {
          allowed: false,
          gates,
          timestamp,
          sourceAgent: context.sourceAgent,
          targetAgent: context.targetAgent,
        };
      }
    }

    if (this.config.provenance) {
      const result = await provenanceGate(input, context, this.provenanceTracker);
      gates.push(result);
      if (!result.pass) {
        this.recordFailure();
        return {
          allowed: false,
          gates,
          timestamp,
          sourceAgent: context.sourceAgent,
          targetAgent: context.targetAgent,
        };
      }
    }

    if (this.config.consistency) {
      const result = consistencyGate(input, context, this.consistencyChecker);
      gates.push(result);
      if (!result.pass) {
        this.recordFailure();
        return {
          allowed: false,
          gates,
          timestamp,
          sourceAgent: context.sourceAgent,
          targetAgent: context.targetAgent,
        };
      }
    }

    this.failureCount = 0;

    return {
      allowed: true,
      gates,
      timestamp,
      sourceAgent: context.sourceAgent,
      targetAgent: context.targetAgent,
    };
  }

  private recordFailure(): void {
    this.failureCount++;
    if (this.config.circuitBreaker) {
      const { threshold, cooldownMs } = this.config.circuitBreaker;
      if (this.failureCount >= threshold) {
        this.circuitOpenUntil = Date.now() + cooldownMs;
      }
    }
  }
}

export function createEntropyGate(config?: GateConfig): EntropyGate {
  return new EntropyGate(config);
}
