import { describe, expect, test } from "vite-plus/test";
import {
  PATTERN_CATALOG,
  getPattern,
  getPatternsByCategory,
  validatePattern,
  ARCHITECTURAL_PATTERNS,
  CODING_PATTERNS,
} from "../src/index.ts";

describe("Pattern Catalog", () => {
  test("catalog contains all architectural patterns", () => {
    const archPatterns = PATTERN_CATALOG.filter(
      (p) => "requiredElements" in p && !("category" in p),
    );
    expect(archPatterns.length).toBe(5);
    expect(archPatterns.map((p) => p.name)).toEqual(
      expect.arrayContaining(["mvc", "clean", "ddd", "event-driven", "onion"]),
    );
  });

  test("catalog contains all coding patterns", () => {
    const codePatterns = PATTERN_CATALOG.filter((p) => "category" in p);
    expect(codePatterns.length).toBe(17);
  });

  test("architectural patterns constant matches", () => {
    expect(ARCHITECTURAL_PATTERNS.length).toBe(5);
  });

  test("coding patterns constant matches", () => {
    expect(CODING_PATTERNS.length).toBe(17);
  });
});

describe("getPattern", () => {
  test("returns mvc pattern", () => {
    const pattern = getPattern("mvc");
    expect(pattern).toBeDefined();
    expect(pattern!.name).toBe("mvc");
  });

  test("returns factory pattern", () => {
    const pattern = getPattern("factory");
    expect(pattern).toBeDefined();
    expect(pattern!.name).toBe("factory");
  });

  test("returns undefined for unknown pattern", () => {
    const pattern = getPattern("unknown" as any);
    expect(pattern).toBeUndefined();
  });
});

describe("validatePattern", () => {
  test("validates mvc pattern with all elements", () => {
    const code = `
      class Model {}
      class View {}
      class Controller {
        model: Model;
        view: View;
      }
    `;
    const result = validatePattern(code, "mvc");
    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("detects missing mvc elements", () => {
    const code = `
      class Controller {}
    `;
    const result = validatePattern(code, "mvc");
    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("Model"))).toBe(true);
  });

  test("validates factory pattern", () => {
    const code = `
      interface Product {}
      interface Creator {
        createProduct(): Product;
      }
    `;
    const result = validatePattern(code, "factory");
    expect(result.compliant).toBe(true);
  });

  test("validates singleton pattern", () => {
    const code = `
      class Singleton {
        private static instance: Singleton;
        static getInstance(): Singleton {
          return Singleton.instance;
        }
      }
    `;
    const result = validatePattern(code, "singleton");
    expect(result.compliant).toBe(true);
  });

  test("returns violation for unknown pattern", () => {
    const result = validatePattern("code", "unknown" as any);
    expect(result.compliant).toBe(false);
    expect(result.violations[0]).toContain("Unknown pattern");
  });
});

describe("getPatternsByCategory", () => {
  test("returns creational patterns", () => {
    const patterns = getPatternsByCategory("creational");
    expect(patterns.length).toBe(5);
    expect(patterns.every((p) => p.category === "creational")).toBe(true);
  });

  test("returns structural patterns", () => {
    const patterns = getPatternsByCategory("structural");
    expect(patterns.length).toBe(6);
    expect(patterns.every((p) => p.category === "structural")).toBe(true);
  });

  test("returns behavioral patterns", () => {
    const patterns = getPatternsByCategory("behavioral");
    expect(patterns.length).toBe(6);
    expect(patterns.every((p) => p.category === "behavioral")).toBe(true);
  });

  test("returns empty array for non-existent category", () => {
    const patterns = getPatternsByCategory("nonexistent" as any);
    expect(patterns).toHaveLength(0);
  });
});
