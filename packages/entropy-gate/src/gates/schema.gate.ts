import type { GateResult } from "../types.js";

const AGENT_NAMES = [
  "product-requirements",
  "business-data-analyst",
  "solutions-architect",
  "ux-ui-designer",
  "coding",
  "database-data-engineer",
  "code-review",
  "qa-test",
  "security-appsec",
  "devops-cicd",
  "release-manager",
  "sre-observability",
  "documentation",
  "support-feedback",
  "support",
  "orchestrator",
] as const;

const BRANCH_PATTERN = /^[a-z0-9][a-z0-9\-/]*$/;
const REPO_PATTERN = /^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BRANCH_LENGTH = 64;

export function validateAgentName(name: string): GateResult {
  if (!(AGENT_NAMES as readonly string[]).includes(name)) {
    return {
      pass: false,
      gate: "schema",
      reason: `Invalid agent name: "${name}". Must be one of: ${AGENT_NAMES.join(", ")}`,
    };
  }
  return { pass: true, gate: "schema" };
}

export function validateBranchName(name: string): GateResult {
  if (name.length > MAX_BRANCH_LENGTH) {
    return {
      pass: false,
      gate: "schema",
      reason: `Branch name exceeds max length of ${MAX_BRANCH_LENGTH}`,
    };
  }
  if (!BRANCH_PATTERN.test(name)) {
    return {
      pass: false,
      gate: "schema",
      reason: `Invalid branch name: "${name}". Must match pattern ${BRANCH_PATTERN}`,
    };
  }
  return { pass: true, gate: "schema" };
}

export function validateRepoName(name: string): GateResult {
  if (!REPO_PATTERN.test(name)) {
    return {
      pass: false,
      gate: "schema",
      reason: `Invalid repo name: "${name}". Must match pattern ${REPO_PATTERN}`,
    };
  }
  return { pass: true, gate: "schema" };
}

export function validateConversationId(id: string): GateResult {
  if (!UUID_PATTERN.test(id)) {
    return {
      pass: false,
      gate: "schema",
      reason: `Invalid conversation ID: "${id}". Must be a valid UUID`,
    };
  }
  return { pass: true, gate: "schema" };
}

export function validateStageName(name: string, stageOrder: string[]): GateResult {
  if (!stageOrder.includes(name)) {
    return {
      pass: false,
      gate: "schema",
      reason: `Invalid stage name: "${name}". Must be one of: ${stageOrder.join(", ")}`,
    };
  }
  return { pass: true, gate: "schema" };
}

export function schemaGate(
  input: unknown,
  context: { metadata?: Record<string, unknown>; stageOrder?: string[] },
): GateResult {
  if (typeof input !== "object" || input === null) {
    return { pass: false, gate: "schema", reason: "Input must be a non-null object" };
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.agent === "string") {
    const result = validateAgentName(obj.agent);
    if (!result.pass) return result;
  }

  if (typeof obj.branch === "string") {
    const result = validateBranchName(obj.branch);
    if (!result.pass) return result;
  }

  if (typeof obj.repo === "string") {
    const result = validateRepoName(obj.repo);
    if (!result.pass) return result;
  }

  if (typeof obj.conversationId === "string") {
    const result = validateConversationId(obj.conversationId);
    if (!result.pass) return result;
  }

  if (typeof obj.stage === "string" && context.stageOrder) {
    const result = validateStageName(obj.stage, context.stageOrder);
    if (!result.pass) return result;
  }

  return { pass: true, gate: "schema" };
}
