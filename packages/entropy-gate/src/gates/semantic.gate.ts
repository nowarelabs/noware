import type { GateResult } from "../types.js";

const ACTION_VERBS = [
  "implement",
  "create",
  "add",
  "remove",
  "update",
  "fix",
  "refactor",
  "migrate",
  "deploy",
  "test",
  "review",
  "audit",
  "optimize",
  "configure",
  "build",
  "design",
  "analyze",
  "validate",
  "verify",
  "document",
  "debug",
  "integrate",
  "setup",
  "initialize",
  "configure",
  "modify",
  "enhance",
  "improve",
  "rewrite",
  "extract",
];

const MIN_TASK_LENGTH = 10;
const MAX_TASK_LENGTH = 500;
const MAX_ATTR_LENGTH = 200;

export function validateTaskDescription(task: string): GateResult {
  if (task.length < MIN_TASK_LENGTH) {
    return {
      pass: false,
      gate: "semantic",
      reason: `Task description too short (${task.length} chars, min ${MIN_TASK_LENGTH})`,
    };
  }
  if (task.length > MAX_TASK_LENGTH) {
    return {
      pass: false,
      gate: "semantic",
      reason: `Task description too long (${task.length} chars, max ${MAX_TASK_LENGTH})`,
    };
  }

  const lower = task.toLowerCase();
  const hasVerb = ACTION_VERBS.some((v) => lower.includes(v));
  if (!hasVerb) {
    return {
      pass: false,
      gate: "semantic",
      reason: `Task description must contain an action verb`,
    };
  }

  return { pass: true, gate: "semantic" };
}

export function validateAttributes(attrs: Record<string, string>): GateResult {
  const keys = Object.keys(attrs);
  if (keys.length === 0) {
    return {
      pass: false,
      gate: "semantic",
      reason: "Attributes must not be empty",
    };
  }

  for (const key of keys) {
    const value = attrs[key];
    if (typeof value !== "string") {
      return {
        pass: false,
        gate: "semantic",
        reason: `Attribute "${key}" must be a string`,
      };
    }
    if (value.length > MAX_ATTR_LENGTH) {
      return {
        pass: false,
        gate: "semantic",
        reason: `Attribute "${key}" exceeds max length of ${MAX_ATTR_LENGTH}`,
      };
    }
  }

  return { pass: true, gate: "semantic" };
}

export function validateConversationBody(body: string): GateResult {
  if (body.trim().length === 0) {
    return {
      pass: false,
      gate: "semantic",
      reason: "Conversation body must not be empty",
    };
  }
  return { pass: true, gate: "semantic" };
}

export function semanticGate(input: unknown, _context: unknown): GateResult {
  if (typeof input !== "object" || input === null) {
    return { pass: false, gate: "semantic", reason: "Input must be a non-null object" };
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.task === "string") {
    const result = validateTaskDescription(obj.task);
    if (!result.pass) return result;
  }

  if (typeof obj.attributes === "object" && obj.attributes !== null) {
    const result = validateAttributes(obj.attributes as Record<string, string>);
    if (!result.pass) return result;
  }

  if (typeof obj.body === "string") {
    const result = validateConversationBody(obj.body);
    if (!result.pass) return result;
  }

  return { pass: true, gate: "semantic" };
}
