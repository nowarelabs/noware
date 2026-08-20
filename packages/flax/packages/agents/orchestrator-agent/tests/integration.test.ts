import { describe, expect, test, vi } from "vite-plus/test";

import { OrchestratorService } from "../src/services/orchestrator.service.js";
import type { IDispatchAgentPort, IHitlPort } from "@nowarelabs/agent-ports";
import type { UseCaseResult } from "@nowarelabs/shared";

// ----------------------------------------------------------------
// Mock D1 helpers
// ----------------------------------------------------------------

interface MockCall {
  sql: string;
  params: any[];
}

function createMockD1(
  override?: (
    sql: string,
  ) => { first?: () => Promise<any>; all?: () => Promise<{ results: any[] }> } | undefined,
) {
  const calls: MockCall[] = [];

  function mockPrepare(sql: string) {
    calls.push({ sql, params: [] });
    const o = override?.(sql);

    const boundMethods = {
      async run() {
        return { success: true, meta: {} };
      },
      async first() {
        return o?.first ? o.first() : null;
      },
      async all() {
        return o?.all ? o.all() : { results: [] };
      },
    };

    return {
      ...boundMethods,
      bind(...params: any[]) {
        calls[calls.length - 1].params = params;
        return boundMethods;
      },
    };
  }

  return {
    db: { prepare: mockPrepare } as any,
    calls,
  };
}

// ----------------------------------------------------------------
// Mock Port helpers
// ----------------------------------------------------------------

function createMockDispatchPort(
  result: UseCaseResult<{
    streamUrl?: string;
    offset?: number;
    submissionId?: string;
    stage: string;
  }>,
): IDispatchAgentPort {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function createMockHitlPort(
  result: UseCaseResult<{ hitlId?: string; count?: number; resolved?: boolean }>,
): IHitlPort {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

// ----------------------------------------------------------------
// OrchestratorService — dispatch
// ----------------------------------------------------------------

describe("OrchestratorService", () => {
  test("dispatchTask calls port and records stage + instance", async () => {
    const { db, calls } = createMockD1();
    const dispatchPort = createMockDispatchPort({
      success: true,
      data: { streamUrl: "http://stream/1", stage: "coding" },
      status: "delivered",
    });

    const svc = new OrchestratorService(db, dispatchPort);

    const result = await svc.dispatchTask({
      agent: "coding",
      conversationId: "conv-1",
      task: "Build feature X",
      stage: "coding",
    });

    expect(dispatchPort.execute).toHaveBeenCalledTimes(1);
    expect(result.streamUrl).toBe("http://stream/1");
    expect(result.stage).toBe("coding");

    // stage + instance recorded
    const stageCalls = calls.filter((c) => c.sql.includes("INSERT INTO flax_stages"));
    expect(stageCalls.length).toBe(1);

    const instanceCalls = calls.filter(
      (c) => c.sql.includes("UPDATE flax_instances") && c.sql.includes("current_stage"),
    );
    expect(instanceCalls.length).toBe(1);
  });

  test("dispatchTask falls back when no port", async () => {
    const { db, calls } = createMockD1();
    const svc = new OrchestratorService(db);

    const result = await svc.dispatchTask({
      agent: "coding",
      conversationId: "conv-1",
      task: "Build feature X",
      stage: "coding",
    });

    expect(result.stage).toBe("coding");
    expect(result.streamUrl).toBeUndefined();

    // still records stage + instance
    const stageCalls = calls.filter((c) => c.sql.includes("INSERT INTO flax_stages"));
    expect(stageCalls.length).toBe(1);
  });

  test("dispatchTask uses stageForAgent when no stage provided", async () => {
    const { db, calls } = createMockD1();
    const dispatchPort = createMockDispatchPort({
      success: true,
      data: { stage: "requirements" },
      status: "delivered",
    });

    const svc = new OrchestratorService(db, dispatchPort);

    const result = await svc.dispatchTask({
      agent: "product-requirements",
      conversationId: "conv-1",
      task: "Write PRD",
    });

    expect(result.stage).toBe("requirements");
    const stageCalls = calls.filter((c) => c.sql.includes("INSERT INTO flax_stages"));
    expect(stageCalls[0].params[1]).toBe("requirements");
  });

  // ----------------------------------------------------------------
  // createHitl
  // ----------------------------------------------------------------

  test("createHitl inserts record and updates instance", async () => {
    const { db, calls } = createMockD1();
    const svc = new OrchestratorService(db);

    const result = await svc.createHitl({
      conversationId: "conv-1",
      id: "hitl-abc",
      type: "approve-reject",
      title: "Approve deployment?",
      summary: "Deploy v2.0",
    });

    expect(result.hitlId).toBe("hitl-abc");
    expect(result.status).toBe("blocked_on_human");

    const hitlCalls = calls.filter((c) => c.sql.includes("INSERT INTO flax_hitl"));
    expect(hitlCalls.length).toBe(1);
    expect(hitlCalls[0].params[0]).toBe("hitl-abc");

    const instanceCalls = calls.filter(
      (c) => c.sql.includes("UPDATE flax_instances") && c.sql.includes("status = ?"),
    );
    expect(instanceCalls.length).toBe(1);
    expect(instanceCalls[0].params).toContain("blocked_on_human");
  });

  // ----------------------------------------------------------------
  // resolveHitl
  // ----------------------------------------------------------------

  test("resolveHitl calls port when available", async () => {
    const { db } = createMockD1();
    const hitlPort = createMockHitlPort({
      success: true,
      data: { resolved: true },
      status: "delivered",
    });

    const svc = new OrchestratorService(db, undefined, hitlPort);

    await svc.resolveHitl({ id: "hitl-abc", answer: "Approved" });

    expect(hitlPort.execute).toHaveBeenCalledTimes(1);
    expect(hitlPort.execute).toHaveBeenCalledWith({
      method: "resolve",
      answer: "Approved",
    });
  });

  test("resolveHitl falls back to model when no port", async () => {
    const { db, calls } = createMockD1();
    const svc = new OrchestratorService(db);

    await svc.resolveHitl({ id: "hitl-abc", answer: "Approved" });

    const resolveCalls = calls.filter(
      (c) => c.sql.includes("UPDATE flax_hitl") && c.sql.includes("resolved"),
    );
    expect(resolveCalls.length).toBe(1);
    expect(resolveCalls[0].params[0]).toBe("Approved");
    expect(resolveCalls[0].params[2]).toBe("hitl-abc");
  });

  // ----------------------------------------------------------------
  // listInstances
  // ----------------------------------------------------------------

  test("listInstances returns data from model", async () => {
    const mockRows = [{ id: "conv-1", status: "running", created_at: 100, last_seen_at: 200 }];
    const { db } = createMockD1((sql) => {
      if (sql.includes("SELECT") && sql.includes("flax_instances")) {
        return { all: async () => ({ results: mockRows }) };
      }
      return undefined;
    });

    const svc = new OrchestratorService(db);
    const result = await svc.listInstances();

    expect(result).toEqual(mockRows);
  });
});

// ----------------------------------------------------------------
// Integration: Controller → Service → Model
// ----------------------------------------------------------------

describe("OrchestratorController integration", () => {
  test("listInstances action returns JSON response", async () => {
    const mockRows = [{ id: "conv-1", status: "running", created_at: 100, last_seen_at: 200 }];

    const { db } = createMockD1((sql) => {
      if (sql.includes("PRAGMA")) {
        return {
          all: async () => ({
            results: [
              { name: "id" },
              { name: "created_at" },
              { name: "last_seen_at" },
              { name: "title" },
              { name: "origin" },
              { name: "current_stage" },
              { name: "current_agent" },
              { name: "status" },
              { name: "last_activity_at" },
            ],
          }),
        };
      }
      if (sql.includes("SELECT") && sql.includes("flax_instances")) {
        return { all: async () => ({ results: mockRows }) };
      }
      return undefined;
    });

    // Import and instantiate controller directly
    const { OrchestratorController } =
      await import("../src/controllers/orchestrator.controller.js");

    const request = new Request("http://localhost/agents/orchestrator", { method: "GET" });
    const env = { FLAX_DB: db };
    const ctx = { params: {}, waitUntil: () => {} };

    const controller = new OrchestratorController(request as any, env as any, ctx as any);
    const response = await controller.run("listInstances");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.instances).toEqual(mockRows);
  });

  test("ping action returns pong", async () => {
    const { OrchestratorController } =
      await import("../src/controllers/orchestrator.controller.js");

    const request = new Request("http://localhost/api/ping", { method: "GET" });
    const env = {};
    const ctx = { params: {}, waitUntil: () => {} };

    const controller = new OrchestratorController(request as any, env as any, ctx as any);
    const response = await controller.run("ping");
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("pong");
  });
});

// ----------------------------------------------------------------
// Integration: Feature → Service → Model
// ----------------------------------------------------------------

describe("OrchestratorFeature integration", () => {
  test("listInstances feature returns UseCaseResult with data", async () => {
    const mockRows = [{ id: "conv-1", status: "running", created_at: 100, last_seen_at: 200 }];

    const { db } = createMockD1((sql) => {
      if (sql.includes("SELECT") && sql.includes("flax_instances")) {
        return { all: async () => ({ results: mockRows }) };
      }
      return undefined;
    });

    const { OrchestratorFeature } = await import("../src/features/orchestrator.feature.js");

    const svc = new OrchestratorService(db);
    const feature = new OrchestratorFeature(svc);

    const request = new Request("http://localhost/agents/orchestrator", { method: "GET" });
    const env = { FLAX_DB: db };
    const ctx = { params: {}, waitUntil: () => {} };
    const featureContext = {
      request: request as any,
      env: env as any,
      ctx: ctx as any,
      metadata: {},
    };

    const response = await feature.handle({ action: "listInstances" }, featureContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.instances).toEqual(mockRows);
  });

  test("ping feature returns pong response", async () => {
    const { db } = createMockD1();
    const { OrchestratorFeature } = await import("../src/features/orchestrator.feature.js");

    const svc = new OrchestratorService(db);
    const feature = new OrchestratorFeature(svc);

    const request = new Request("http://localhost/api/ping", { method: "GET" });
    const env = {};
    const ctx = { params: {}, waitUntil: () => {} };
    const featureContext = {
      request: request as any,
      env: env as any,
      ctx: ctx as any,
      metadata: {},
    };

    const response = await feature.handle({ action: "ping" }, featureContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pong).toBe(true);
  });
});
