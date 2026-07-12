import { describe, expect, test } from "vite-plus/test";
import type { MaintenanceContext } from "@nowarelabs/shared";
import { Maintenance, BaseMaintenance } from "../src/index.ts";

describe("Maintenance", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

    const maintenance = new Maintenance(mockRequest, mockEnv, mockCtx);
    expect(maintenance).toBeDefined();
  });

  test("healthCheck returns true by default", async () => {
    const maintenance = new Maintenance(
      new Request("http://localhost"),
      {},
      { waitUntil: () => {}, passThroughOnException: () => {} },
    );
    const result = await maintenance.healthCheck();
    expect(result).toBe(true);
  });
});

describe("BaseMaintenance", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as MaintenanceContext;

    const maintenance = new BaseMaintenance(mockRequest, mockEnv, mockCtx);
    expect(maintenance).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseMaintenance.beforeHooks).toBeDefined();
    expect(BaseMaintenance.afterHooks).toBeDefined();
  });
});
