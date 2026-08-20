import { describe, expect, test } from "vite-plus/test";
import { OrchestratorDO, AtomDO, AgentDO } from "@nowarelabs/durable_objects";
import { ClaimDO, BranchDO, ComponentRegistry } from "@nowarelabs/cfour";
import { AtomMergeResolver } from "@nowarelabs/merge-review";
import { PheromoneSignalEmitter } from "@nowarelabs/events";
import { AuctionMechanism, CapabilityEnforcer, SystemManager } from "@nowarelabs/agent-runtime";
import { InvariantChecker } from "@nowarelabs/validators";
import { EntropyGate, defaultConfig } from "@nowarelabs/entropy-gate";
import type { CfourDiff, Capability } from "@nowarelabs/shared";

describe("Stigmergic integration", () => {
  test("full hierarchy signal propagation", () => {
    const root = new OrchestratorDO({ id: "root", level: "root", elementId: "company", childOrchestratorIds: ["ss-1"] });
    const ss = new OrchestratorDO({ id: "ss-1", level: "ss", elementId: "payment-api", parentId: "root", childOrchestratorIds: ["container-1"] });
    const container = new OrchestratorDO({ id: "container-1", level: "container", elementId: "gateway", parentId: "ss-1", childOrchestratorIds: ["component-1"] });
    const component = new OrchestratorDO({ id: "component-1", level: "component", elementId: "auth", parentId: "container-1", childOrchestratorIds: [] });

    const diff: CfourDiff = {
      id: "diff-1", level: "ss", elementId: "payment-api",
      changeType: "description", oldValue: "mpesa api", newValue: "flutterwave api",
      timestamp: Date.now(), sourceOrchestratorId: "root",
    };

    root.receiveDiffs([diff]);
    expect(root.pendingDiffCount).toBe(1);

    const rootDiffs = root.processDiffs({});
    expect(rootDiffs.length).toBe(1);

    const cascadedToSS = root.cascadeToChildren(rootDiffs);
    ss.receiveDiffs(cascadedToSS);
    expect(ss.pendingDiffCount).toBe(1);

    const ssDiffs = ss.processDiffs({});
    const cascadedToContainer = ss.cascadeToChildren(ssDiffs);
    container.receiveDiffs(cascadedToContainer);

    const containerDiffs = container.processDiffs({});
    const cascadedToComponent = container.cascadeToChildren(containerDiffs);
    component.receiveDiffs(cascadedToComponent);

    const componentDiffs = component.processDiffs({});
    expect(componentDiffs.length).toBe(1);

    const pheromones = root.releasePheromones(rootDiffs);
    expect(pheromones.length).toBe(1);
  });

  test("claim enforcement", () => {
    const claim = new ClaimDO({ id: "c1", atomId: "atom-1", agentDoId: "agent-1", ttlMs: 5000 });
    expect(claim.isActive()).toBe(true);

    const acquired = claim.acquire("agent-2");
    expect(acquired).toBe(false);

    expect(claim.release("agent-1")).toBe(true);
    expect(claim.acquire("agent-2")).toBe(true);
    expect(claim.isActive()).toBe(true);
  });

  test("branch and merge flow", () => {
    const branch = new BranchDO({ id: "b1", atomId: "atom-1", agentDoId: "agent-1", content: "original", baseVersionId: "v1" });
    branch.update("modified", "agent-1");
    expect(branch.state.content).toBe("modified");
    expect(branch.state.versions.length).toBe(2);

    const conflicts = branch.getConflicts("different content");
    expect(conflicts.length).toBe(1);

    const merged = branch.merge();
    expect(merged.content).toBe("modified");
    expect(branch.state.status).toBe("merged");
  });

  test("pheromone signal flow", () => {
    const emitter = new PheromoneSignalEmitter();
    emitter.emit({ type: "atom-needs-work", elementId: "atom-1", level: "code" });
    emitter.emit({ type: "description-changed", elementId: "ss-1", level: "ss" });

    const signals = emitter.poll("agent-1", 0);
    expect(signals.length).toBe(2);

    emitter.consume(signals[0].id, "agent-1");
    const remaining = emitter.poll("agent-1", 0);
    expect(remaining.length).toBe(1);
  });

  test("entropy gate integration", () => {
    const gate = new EntropyGate(defaultConfig);

    const validInput = { agent: "coding", conversationId: "550e8400-e29b-41d4-a716-446655440000", task: "Implement the login page" };
    const result = gate.evaluateSync(validInput, { sourceAgent: "orchestrator" });
    expect(result.allowed).toBe(true);
  });

  test("bidding mechanism", () => {
    const auction = new AuctionMechanism();
    auction.submitBid({ systemId: "system-1", entityId: "atom-1", value: 10, conditions: [] });
    auction.submitBid({ systemId: "system-2", entityId: "atom-1", value: 15, conditions: [] });

    const winner = auction.selectWinner("atom-1");
    expect(winner?.systemId).toBe("system-2");
    expect(winner?.value).toBe(15);
  });

  test("capability security", () => {
    const enforcer = new CapabilityEnforcer();
    enforcer.declareCapabilities("system-1", [
      { component: "game::Health", access: "read" },
      { component: "game::Position", access: "read+write" },
    ]);

    expect(enforcer.checkCapability("system-1", "game::Health", "read")).toBe(true);
    expect(enforcer.checkCapability("system-1", "game::Health", "write")).toBe(false);
    expect(enforcer.checkCapability("system-1", "game::Position", "write")).toBe(true);

    expect(() => enforcer.enforce("system-1", "game::Health", "write")).toThrow();
  });

  test("hot-swap systems", () => {
    const manager = new SystemManager();
    manager.deploy({ name: "healer", description: "Heals entities", capabilities: [], bids: [] });
    expect(manager.isRunning("healer")).toBe(true);

    manager.hotSwap("healer", { name: "healer", description: "Improved healer", capabilities: [], bids: [] });
    expect(manager.isRunning("healer")).toBe(true);
    expect(manager.getSystem("healer")?.description).toBe("Improved healer");
  });

  test("dynamic component definitions", () => {
    const registry = new ComponentRegistry();
    registry.define("game::Health", { type: "object", properties: { current: { type: "number" } }, required: ["current"] });
    expect(registry.validate("game::Health", { current: 100 })).toBe(true);
    expect(registry.validate("game::Health", {})).toBe(false);

    const instance = registry.attach("entity-1", "game::Health", { current: 100 });
    expect(instance.componentName).toBe("game::Health");
    expect(registry.getComponent("entity-1", "game::Health")).toBeDefined();
  });

  test("invariant checking", () => {
    const checker = new InvariantChecker();
    const inv = checker.createInvariant("sum(health.current) <= 1000", "Total health cap");
    const result = checker.check(inv, { "health.current": 500 });
    expect(result.pass).toBe(true);

    const allResults = checker.checkAll({ "health.current": 100 });
    expect(allResults.length).toBe(1);
  });

  test("atom version history and merge resolution", () => {
    const atom = new AtomDO({
      id: "atom-1", cfourElementId: "code-1", atomType: "function",
      content: "function hello() {}", language: "typescript",
      filePath: "src/hello.ts", parentComponentId: "comp-1", agentDoId: "agent-1",
    });

    atom.addVersion({ content: "v1", agentDoId: "agent-1", timestamp: Date.now(), pheromoneEvents: [], cfourValidation: { valid: true, errors: [] }, patternCompliance: { compliant: true, violations: [] } });
    atom.addVersion({ content: "v2", agentDoId: "agent-1", timestamp: Date.now(), pheromoneEvents: [], cfourValidation: { valid: true, errors: [] }, patternCompliance: { compliant: true, violations: [] } });

    expect(atom.versionCount).toBe(2);
    expect(atom.currentVersion?.content).toBe("v2");

    const archived = atom.archiveVersions();
    expect(archived.length).toBe(2);
    expect(atom.versionCount).toBe(0);
  });
});
