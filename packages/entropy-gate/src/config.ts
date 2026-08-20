import type { GateConfig } from "./types.js";

export const defaultConfig: GateConfig = {
  schema: true,
  semantic: true,
  ordering: true,
  provenance: true,
  consistency: true,
  stageOrder: [
    "requirements",
    "architecture",
    "design",
    "coding",
    "review",
    "qa",
    "security",
    "devops",
    "release",
    "sre-docs",
  ],
  maxConcurrent: 5,
  circuitBreaker: { threshold: 10, cooldownMs: 60000 },
};

export const strictConfig: GateConfig = {
  ...defaultConfig,
  maxConcurrent: 1,
  circuitBreaker: { threshold: 3, cooldownMs: 120000 },
};

export const permissiveConfig: GateConfig = {
  schema: true,
  semantic: false,
  ordering: false,
  provenance: false,
  consistency: false,
};
