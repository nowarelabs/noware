import { describe, expect, test } from "vite-plus/test";
import { GENERATORS, ScriptRunner } from "../src/index.ts";

describe("GENERATORS", () => {
  test("controller generator returns string", () => {
    const result = GENERATORS.controller("User");
    expect(result).toBe("// Controller template");
  });

  test("service generator returns string", () => {
    const result = GENERATORS.service("User");
    expect(result).toBe("// Service template");
  });

  test("model generator returns string", () => {
    const result = GENERATORS.model("User");
    expect(result).toBe("// Model template");
  });
});

describe("ScriptRunner", () => {
  test("constructor accepts optional params", () => {
    const runner = new ScriptRunner();
    expect(runner).toBeDefined();
  });

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {} as any;

    const runner = new ScriptRunner(mockRequest, mockEnv, mockCtx);
    expect(runner).toBeDefined();
  });
});
