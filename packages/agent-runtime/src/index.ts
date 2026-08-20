/**
 * @nowarelabs/agent-runtime — agent runtime infrastructure.
 *
 * This package provides the "software factory" layer: sessions, leases,
 * heartbeats, task queues, reconciliation, and Cloudflare integration.
 *
 * Split from `@nowarelabs/agents` (which now contains only the DSL).
 *
 * ## Data flow (unidirectional)
 *
 * ```
 * Feature → AgentRuntime → UseCase → Port → Gateway → Model
 * ```
 *
 * The runtime sits between the feature layer (lifecycle orchestration)
 * and the use case layer (individual tool operations).
 */

// ----------------------------------------------------------------
// Infrastructure — crash-safe leases, heartbeats, tasks
// ----------------------------------------------------------------

export type {
  Clock,
  WorkspaceDoClient,
  AgentSession,
  CreateSessionOpts,
  HeartbeatLoop,
  Task,
  TaskStatus,
  TaskQueue,
  ReconcileResult,
  RunAgentOpts,
  AgentTaskHandler,
} from "./infrastructure.js";

export {
  createWallClock,
  createSession,
  acquireLease,
  releaseLease,
  createHeartbeatLoop,
  createMemoryQueue,
  reconcile,
  runAgent,
} from "./infrastructure.js";

// ----------------------------------------------------------------
// Cloudflare adapters — DO class generation, tool dispatch
// ----------------------------------------------------------------

export { executeTool, buildSystemPrompt, prepareForCloudflare } from "./cloudflare.js";
export type { CloudflareAgentLike, GeneratedAgentClass } from "./cloudflare.js";

// ----------------------------------------------------------------
// Stigmergic: Bidding Mechanism
// ----------------------------------------------------------------

import type { Bid, BidCondition, ComponentInstance } from "@nowarelabs/shared";

export class AuctionMechanism {
  private bids: Map<string, Bid[]> = new Map();

  submitBid(bid: Bid): void {
    const entityBids = this.bids.get(bid.entityId) ?? [];
    entityBids.push(bid);
    this.bids.set(bid.entityId, entityBids);
  }

  evaluateConditions(conditions: BidCondition[], components: ComponentInstance[]): boolean {
    return conditions.every((cond) => {
      const component = components.find((c) => c.componentName === cond.component);
      if (!component) return false;
      const data = component.data as Record<string, unknown>;
      const fieldVal = data[cond.field];
      switch (cond.operator) {
        case "==": return fieldVal === cond.value;
        case "!=": return fieldVal !== cond.value;
        case "<": return (fieldVal as number) < (cond.value as number);
        case ">": return (fieldVal as number) > (cond.value as number);
        case "<=": return (fieldVal as number) <= (cond.value as number);
        case ">=": return (fieldVal as number) >= (cond.value as number);
        default: return false;
      }
    });
  }

  selectWinner(entityId: string): Bid | null {
    const bids = this.bids.get(entityId) ?? [];
    if (bids.length === 0) return null;
    return bids.reduce((best, curr) => (curr.value > best.value ? curr : best));
  }

  getBidsForEntity(entityId: string): Bid[] {
    return [...(this.bids.get(entityId) ?? [])];
  }

  clearBids(entityId: string): void {
    this.bids.delete(entityId);
  }

  get totalBids(): number {
    let count = 0;
    for (const bids of this.bids.values()) count += bids.length;
    return count;
  }
}

// ----------------------------------------------------------------
// Stigmergic: Capability Security
// ----------------------------------------------------------------

import type { Capability } from "@nowarelabs/shared";

export class CapabilityEnforcer {
  private capabilities: Map<string, Capability[]> = new Map();

  declareCapabilities(systemId: string, caps: Capability[]): void {
    this.capabilities.set(systemId, caps);
  }

  checkCapability(systemId: string, componentName: string, requiredAccess: "read" | "write" | "execute"): boolean {
    const caps = this.capabilities.get(systemId) ?? [];
    const cap = caps.find((c) => c.component === componentName);
    if (!cap) return false;
    switch (requiredAccess) {
      case "read": return cap.access.includes("read");
      case "write": return cap.access.includes("write");
      case "execute": return cap.access.includes("execute");
      default: return false;
    }
  }

  enforce(systemId: string, componentName: string, action: "read" | "write" | "execute"): void {
    if (!this.checkCapability(systemId, componentName, action)) {
      throw new Error(`System ${systemId} not allowed to ${action} ${componentName}`);
    }
  }

  getCapabilities(systemId: string): Capability[] {
    return [...(this.capabilities.get(systemId) ?? [])];
  }
}

// ----------------------------------------------------------------
// Stigmergic: System Manager (Hot-Swap)
// ----------------------------------------------------------------

import type { SystemDefinition } from "@nowarelabs/shared";

export class SystemManager {
  private systems: Map<string, SystemDefinition> = new Map();
  private running: Map<string, boolean> = new Map();

  deploy(definition: SystemDefinition): void {
    this.systems.set(definition.name, definition);
    this.running.set(definition.name, true);
  }

  update(name: string, definition: SystemDefinition): void {
    this.stopSystem(name);
    this.systems.set(name, definition);
    this.startSystem(name);
  }

  remove(name: string): void {
    this.stopSystem(name);
    this.systems.delete(name);
    this.running.delete(name);
  }

  hotSwap(name: string, definition: SystemDefinition): void {
    const newName = `${name}-v2`;
    this.deploy({ ...definition, name: newName });
    this.stopSystem(name);
    this.systems.delete(name);
    this.running.delete(name);
    this.systems.set(name, definition);
    this.running.set(name, true);
  }

  private startSystem(name: string): void {
    this.running.set(name, true);
  }

  private stopSystem(name: string): void {
    this.running.set(name, false);
  }

  isRunning(name: string): boolean {
    return this.running.get(name) ?? false;
  }

  getSystem(name: string): SystemDefinition | undefined {
    return this.systems.get(name);
  }

  get allSystems(): SystemDefinition[] {
    return [...this.systems.values()];
  }
}

// ----------------------------------------------------------------
// Stigmergic: Signal Propagation
// ----------------------------------------------------------------

import type { CfourDiff, PheromoneEvent } from "@nowarelabs/shared";

export function propagateDiff(
  diff: CfourDiff,
  rootId: string,
): Array<{ targetId: string; diff: CfourDiff }> {
  return [{ targetId: rootId, diff }];
}

export function processDiffAtLevel(
  diff: CfourDiff,
  level: string,
): CfourDiff[] {
  if (diff.level === level) {
    return [diff];
  }
  return [];
}

export function shouldCascadeToChildren(diff: CfourDiff, level: string): boolean {
  const cascadeMap: Record<string, string[]> = {
    root: ["ss"],
    ss: ["container"],
    container: ["component"],
    component: ["code"],
  };
  return cascadeMap[level]?.includes(diff.level) ?? false;
}

export function createPheromoneFromDiff(diff: CfourDiff): Omit<PheromoneEvent, "id" | "timestamp" | "consumedBy"> {
  return {
    type: "description-changed",
    elementId: diff.elementId,
    level: diff.level,
    cfourDiff: diff,
  };
}
