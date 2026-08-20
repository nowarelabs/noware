export type { GateResult, GateDecision, GateContext, GateConfig } from "./types.js";

export { defaultConfig, strictConfig, permissiveConfig } from "./config.js";

export {
  validateAgentName,
  validateBranchName,
  validateRepoName,
  validateConversationId,
  validateStageName,
  schemaGate,
} from "./gates/schema.gate.js";

export {
  validateTaskDescription,
  validateAttributes,
  validateConversationBody,
  semanticGate,
} from "./gates/semantic.gate.js";

export { validateStageOrder, orderingGate } from "./gates/ordering.gate.js";

export { ProvenanceTracker, provenanceGate } from "./gates/provenance.gate.js";
export type { ProvenanceRecord } from "./gates/provenance.gate.js";

export { ConsistencyChecker, consistencyGate } from "./gates/consistency.gate.js";
export type { Claim, Contradiction } from "./gates/consistency.gate.js";

export { EntropyGate, createEntropyGate } from "./gate.js";
