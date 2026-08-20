import { describe, expect, test } from "vite-plus/test";
import { CompanyBuilder } from "../src/company-builder";
import { SelfHealer } from "../src/self-healer";
import { SystemDO, DeploymentDO } from "@nowarelabs/durable-objects";
import { HealthChecker, AlertManager, MetricsCollector } from "@nowarelabs/system-builder";

describe("Company Builder integration", () => {
  test("full pipeline: description → company", async () => {
    const builder = new CompanyBuilder();
    const result = await builder.build(
      "Build a payment processing company\n" +
        "Department: Engineering\n" +
        "Team: Payment Gateway\nRole: API Developer\n" +
        "Team: Notifications\nRole: SMS Sender",
    );
    expect(result.status).toBe("deployed");
    expect(result.systems.length).toBe(2);
    expect(result.cfourModelId).toContain("model-");
    expect(result.orchestratorId).toContain("orch-root-");
    for (const system of result.systems) {
      expect(system.workerUrl).toContain("workers.dev");
      expect(system.status).toBe("deployed");
    }
  });

  test("hierarchy has correct depth", () => {
    const builder = new CompanyBuilder();
    const root = builder.getHierarchy(
      "Build a company\nDepartment: Engineering\nTeam: API\nRole: Dev\nTeam: Notifications\nRole: Sender",
    );
    expect(root.level).toBe("root");
    expect(root.children.length).toBe(1);
    expect(root.children[0].children.length).toBe(2);
    expect(root.children[0].children[0].children.length).toBe(1);
  });
});

describe("Self-healing integration", () => {
  test("heals failed system", async () => {
    const healer = new SelfHealer();
    const action = await healer.heal("system-1");
    expect(action.systemId).toBe("system-1");
    expect(action.level).toBe("restart");
    expect(action.success).toBe(true);
  });

  test("escalates recovery level", async () => {
    const healer = new SelfHealer();
    await healer.heal("system-1");
    await healer.heal("system-1");
    const action = await healer.heal("system-1");
    expect(action.level).toBe("rebuild");
  });

  test("monitor detects unhealthy systems", async () => {
    const healer = new SelfHealer();
    const results = await healer.monitor([
      {
        systemId: "s1",
        endpoint: "/health",
        intervalMs: 30000,
        timeoutMs: 5000,
        expectedStatus: 200,
      },
    ]);
    expect(results.length).toBe(1);
    expect(results[0].healthy).toBe(true);
  });

  test("tracks failure patterns", async () => {
    const healer = new SelfHealer();
    await healer.heal("s1");
    await healer.heal("s1");
    const patterns = healer.getFailurePatterns();
    expect(patterns.length).toBe(1);
    expect(patterns[0].count).toBe(2);
  });
});

describe("SystemDO integration", () => {
  test("system lifecycle transitions", () => {
    const sys = new SystemDO("sys-1", "Payment API");
    expect(sys.state.status).toBe("provisioning");
    expect(sys.transition("building")).toBe(true);
    expect(sys.transition("deploying")).toBe(true);
    expect(sys.transition("deployed")).toBe(true);
    expect(sys.transition("healthy")).toBe(true);
    expect(sys.transition("degraded")).toBe(true);
    expect(sys.transition("rolled-back")).toBe(true);
  });

  test("invalid transition is rejected", () => {
    const sys = new SystemDO("sys-2", "Test");
    expect(sys.transition("healthy")).toBe(false);
  });

  test("records errors", () => {
    const sys = new SystemDO("sys-3", "Test");
    sys.recordError("connection failed");
    expect(sys.errorCount).toBe(1);
  });
});

describe("DeploymentDO integration", () => {
  test("deploy and rollback", () => {
    const dep = new DeploymentDO("worker-1");
    dep.deploy("v1", "code1", "agent-1");
    dep.deploy("v2", "code2", "agent-1");
    expect(dep.versionCount).toBe(2);
    expect(dep.getActiveVersion()?.version).toBe("v2");

    const rolled = dep.rollback();
    expect(rolled?.version).toBe("v1");
    expect(dep.getActiveVersion()?.version).toBe("v1");
  });
});

describe("Monitoring integration", () => {
  test("health check and metrics", async () => {
    const hc = new HealthChecker();
    const mc = new MetricsCollector();
    const result = await hc.check({
      systemId: "s1",
      endpoint: "/health",
      intervalMs: 30000,
      timeoutMs: 5000,
      expectedStatus: 200,
    });
    expect(result.healthy).toBe(true);
    mc.record("s1", "requests", 100);
    mc.record("s1", "errors", 2);
    expect(mc.getLatest("s1", "requests")).toBe(100);
  });

  test("alert manager triggers on threshold", () => {
    const am = new AlertManager();
    am.addRule({ id: "r1", condition: "errorRate > 0.05", action: "restart", cooldown: 0 });
    const events = am.evaluate("s1", { errorRate: 0.1 });
    expect(events.length).toBe(1);
    expect(events[0].action).toBe("restart");
  });

  test("alert respects cooldown", () => {
    const am = new AlertManager();
    am.addRule({ id: "r2", condition: "errorRate > 0.05", action: "notify", cooldown: 60000 });
    am.evaluate("s1", { errorRate: 0.1 });
    const second = am.evaluate("s1", { errorRate: 0.1 });
    expect(second.length).toBe(0);
  });
});
