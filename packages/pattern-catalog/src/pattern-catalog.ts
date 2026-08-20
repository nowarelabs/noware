import type { ArchitecturalPattern, CodingPattern } from "@nowarelabs/shared";
import {
  ARCHITECTURAL_PATTERNS,
  type ArchitecturalPatternDefinition,
} from "./architectural-patterns.ts";
import {
  CODING_PATTERNS,
  type CodingPatternDefinition,
  type PatternCategory,
} from "./coding-patterns.ts";

export type PatternDefinition = ArchitecturalPatternDefinition | CodingPatternDefinition;

export const PATTERN_CATALOG: PatternDefinition[] = [...ARCHITECTURAL_PATTERNS, ...CODING_PATTERNS];

export function getPattern(
  name: ArchitecturalPattern | CodingPattern,
): PatternDefinition | undefined {
  return PATTERN_CATALOG.find((p) => p.name === name);
}

export function getPatternsByCategory(category: PatternCategory): CodingPatternDefinition[] {
  return CODING_PATTERNS.filter((p) => p.category === category);
}

export interface PatternValidationResult {
  compliant: boolean;
  violations: string[];
}

export function validatePattern(
  code: string,
  pattern: ArchitecturalPattern | CodingPattern,
): PatternValidationResult {
  const def = getPattern(pattern);
  if (!def) {
    return { compliant: false, violations: [`Unknown pattern: ${pattern}`] };
  }

  const violations: string[] = [];

  const requiredElements = "requiredElements" in def ? def.requiredElements : [];
  for (const element of requiredElements) {
    const regex = new RegExp(`\\b${element}\\b`, "i");
    if (!regex.test(code)) {
      violations.push(`Missing required element: ${element}`);
    }
  }

  const requiredInterfaces = "requiredInterfaces" in def ? def.requiredInterfaces : [];
  for (const iface of requiredInterfaces) {
    const regex = new RegExp(`\\b${iface}\\b`, "i");
    if (!regex.test(code)) {
      violations.push(`Missing required interface: ${iface}`);
    }
  }

  const requiredMethods = "requiredMethods" in def ? def.requiredMethods : [];
  for (const method of requiredMethods) {
    const methodName = method.replace("()", "");
    const regex = new RegExp(`\\b${methodName}\\b`, "i");
    if (!regex.test(code)) {
      violations.push(`Missing required method: ${method}`);
    }
  }

  return { compliant: violations.length === 0, violations };
}
