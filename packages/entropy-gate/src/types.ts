export interface GateResult {
  pass: boolean;
  gate: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface GateDecision {
  allowed: boolean;
  gates: GateResult[];
  timestamp: number;
  sourceAgent?: string;
  targetAgent?: string;
}

export interface GateContext {
  sourceAgent?: string;
  targetAgent?: string;
  currentStage?: string;
  metadata?: Record<string, unknown>;
}

export interface GateConfig {
  schema?: boolean;
  semantic?: boolean;
  ordering?: boolean;
  provenance?: boolean;
  consistency?: boolean;
  stageOrder?: string[];
  maxConcurrent?: number;
  circuitBreaker?: {
    threshold: number;
    cooldownMs: number;
  };
}
