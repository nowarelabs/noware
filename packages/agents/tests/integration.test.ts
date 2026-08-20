/**
 * Phase 7 — integration demos
 *
 * These tests compose agents + merge-review (and optionally gen-diesel) to
 * demonstrate the full product pipeline: multi-agent factory, crash simulation,
 * drift detection, and live event consumption.
 */

import { describe, expect, test } from "vite-plus/test";
import type {
  CfourChangeEvent,
  CfourEventQuery,
  C4MergePlan,
  C4WorkspaceDiff,
  C4Claim,
  C4Workspace,
} from "@nowarelabs/cfour";
import type { Clock } from "@nowarelabs/agent-runtime";
import { acquireLease, createMemoryQueue, reconcile, runAgent } from "@nowarelabs/agent-runtime";
import type { MergePolicy } from "@nowarelabs/merge-review";
import {
  createReviewStore,
  openReview,
  voteReview,
  tryMerge,
  pollEvents,
} from "@nowarelabs/merge-review";

// ----------------------------------------------------------------
// Shared fakes
// ----------------------------------------------------------------

/** Combined fake client that implements both WorkspaceDoClient and MergeReviewClient. */
function createIntegratedClient() {
  const claims = new Map<string, C4Claim>();
  let claimCounter = 0;
  const events: CfourChangeEvent[] = [];
  const branches: Array<{ branch: string; parent: string; createdAt: number }> = [
    { branch: "default", parent: "", createdAt: Date.now() },
  ];
  const lintIssues: Array<{
    check: string;
    message: string;
    category: "General" | "Elements" | "Relationships";
  }> = [];
  const validateIssues: Array<{ id: string; message: string; severity: "error" | "warning" }> = [];
  const mergePlans = new Map<string, C4MergePlan>();
  const appliedMerges: Array<{ plan: C4MergePlan; into: string }> = [];
  const touchCount = new Map<string, number>();

  function emit(event: CfourChangeEvent) {
    events.push(event);
  }

  const client = {
    // Expose for test inspection
    claims,
    events,
    branches,
    lintIssues,
    validateIssues,
    appliedMerges,
    touchCount,

    // WorkspaceDoClient
    async claim(
      selection: C4Selection,
      editorId: string,
      workspaceName = "default",
    ): Promise<C4Claim> {
      const id = `claim-${++claimCounter}`;
      const claim: C4Claim = {
        id,
        editorId,
        workspaceName,
        elementIds: new Set(selection.elementIds),
        relationshipIds: new Set(selection.relationshipIds),
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      claims.set(id, claim);
      emit({ op: "claim", workspaceName, elementId: id, payload: claim, timestamp: Date.now() });
      return claim;
    },

    async releaseAllClaimsFor(editorId: string, workspaceName?: string) {
      for (const [id, claim] of claims) {
        if (
          claim.editorId === editorId &&
          (!workspaceName || claim.workspaceName === workspaceName)
        ) {
          claims.delete(id);
          emit({
            op: "release",
            workspaceName: claim.workspaceName,
            elementId: id,
            payload: claim,
            timestamp: Date.now(),
          });
        }
      }
    },

    async touchClaim(claimId: string) {
      const claim = claims.get(claimId);
      if (claim) claim.lastSeenAt = Date.now();
      touchCount.set(claimId, (touchCount.get(claimId) ?? 0) + 1);
    },

    async getClaims(_workspaceName?: string) {
      return [...claims.values()];
    },

    async branchWorkspace(fromBranch: string, newBranch: string) {
      branches.push({ branch: newBranch, parent: fromBranch, createdAt: Date.now() });
      emit({
        op: "branch",
        workspaceName: newBranch,
        payload: { branch: newBranch, from: fromBranch },
        timestamp: Date.now(),
      });
    },

    async getWorkspace(): Promise<C4Workspace> {
      return { name: "default", people: [], softwareSystems: [], relationships: [] };
    },

    async listBranches() {
      return [...branches];
    },

    async deleteBranch(branch: string) {
      const idx = branches.findIndex((b) => b.branch === branch);
      if (idx >= 0) branches.splice(idx, 1);
    },

    // MergeReviewClient
    async queryEvents(filter: CfourEventQuery) {
      let result = [...events];
      if (filter.workspaceName)
        result = result.filter((e) => e.workspaceName === filter.workspaceName);
      if (filter.op) result = result.filter((e) => e.op === filter.op);
      if (filter.since !== undefined) {
        const since = filter.since;
        result = result.filter((e) => (e.timestamp ?? 0) > since);
      }
      if (filter.limit !== undefined) result = result.slice(0, filter.limit);
      return result;
    },

    async planMerge(branch: string, into: string): Promise<C4MergePlan> {
      const key = `${branch}->${into}`;
      return (
        mergePlans.get(key) ?? {
          branch,
          into,
          branchChanges: {
            nodes: { added: [], removed: [], modified: [] },
            relationships: { added: [], removed: [], modified: [] },
          },
          targetChanges: {
            nodes: { added: [], removed: [], modified: [] },
            relationships: { added: [], removed: [], modified: [] },
          },
          conflicts: [],
          claimBlockers: [],
        }
      );
    },

    async applyMerge(plan: C4MergePlan, into: string) {
      appliedMerges.push({ plan, into });
      emit({ op: "merge", workspaceName: into, payload: plan, timestamp: Date.now() });
    },

    lint() {
      return lintIssues;
    },

    validate(_workspaceName?: string) {
      return validateIssues;
    },

    async diff(_a: string, _b: string): Promise<C4WorkspaceDiff> {
      return {
        nodes: { added: [], removed: [], modified: [] },
        relationships: { added: [], removed: [], modified: [] },
      };
    },
  };

  return client;
}

function createFakeClock(startMs = 1000): Clock & { advance(ms: number): Promise<void> } {
  let time = startMs;
  const timers: Array<{ fn: () => void; at: number; interval: boolean; id: number }> = [];
  let nextId = 1;

  return {
    now: () => time,
    setTimeout(fn, ms) {
      const id = nextId++;
      const entry = { fn, at: time + ms, interval: false, id };
      timers.push(entry);
      return {
        cancel() {
          const idx = timers.indexOf(entry);
          if (idx >= 0) timers.splice(idx, 1);
        },
      };
    },
    setInterval(fn, ms) {
      const id = nextId++;
      const entry = { fn, at: time + ms, interval: true, id };
      timers.push(entry);
      return {
        cancel() {
          const idx = timers.indexOf(entry);
          if (idx >= 0) timers.splice(idx, 1);
        },
      };
    },
    async advance(ms) {
      time += ms;
      while (true) {
        const due = timers.filter((t) => t.at <= time);
        if (due.length === 0) break;
        for (const t of due) {
          const idx = timers.indexOf(t);
          if (idx >= 0) timers.splice(idx, 1);
          t.fn();
          await Promise.resolve();
          if (t.interval) {
            t.at = time + ms;
            timers.push(t);
          }
        }
      }
    },
  };
}

type C4Selection = { elementIds: string[]; relationshipIds: string[] };

// ----------------------------------------------------------------
// Demo 1: Multi-agent factory
// ----------------------------------------------------------------

describe("Integration: multi-agent factory", () => {
  test("two agents work on separate branches, both merged through merge-review", async () => {
    const client = createIntegratedClient();
    const clock = createFakeClock();
    const queue = createMemoryQueue();
    const reviewStore = createReviewStore();

    // --- Agent 1: frontend work ---
    const task1 = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "build-login",
      agentId: "frontend-agent",
      payload: "Build login page",
      priority: 1,
      maxRetries: 0,
    });

    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "frontend-agent",
      task: task1,
      handler: async (session) => {
        await acquireLease(client, session, ["login-form", "login-api"]);
        // Simulate work: emit events
        client.events.push(
          {
            op: "add",
            workspaceName: session.branchName,
            elementId: "login-form",
            timestamp: clock.now(),
          },
          {
            op: "add",
            workspaceName: session.branchName,
            elementId: "login-api",
            timestamp: clock.now(),
          },
        );
      },
      heartbeatMs: 30_000,
      clock,
      claimElementIds: ["login-form", "login-api"],
    });

    // --- Agent 2: backend work ---
    const task2 = await queue.enqueue({
      id: "t2",
      projectId: "proj-1",
      branch: "build-api",
      agentId: "backend-agent",
      payload: "Build REST API",
      priority: 1,
      maxRetries: 0,
    });

    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "backend-agent",
      task: task2,
      handler: async (session) => {
        await acquireLease(client, session, ["rest-api", "db-schema"]);
        client.events.push(
          {
            op: "add",
            workspaceName: session.branchName,
            elementId: "rest-api",
            timestamp: clock.now(),
          },
          {
            op: "add",
            workspaceName: session.branchName,
            elementId: "db-schema",
            timestamp: clock.now(),
          },
        );
      },
      heartbeatMs: 30_000,
      clock,
      claimElementIds: ["rest-api", "db-schema"],
    });

    // --- Both tasks done ---
    expect(task1.status).toBe("done");
    expect(task2.status).toBe("done");

    // --- Open reviews for both branches ---
    const review1 = await openReview(client, reviewStore, {
      projectId: "proj-1",
      branchName: "build-login",
      targetBranch: "default",
    });
    const review2 = await openReview(client, reviewStore, {
      projectId: "proj-1",
      branchName: "build-api",
      targetBranch: "default",
    });

    expect(review1.gates.every((g) => g.pass)).toBe(true);
    expect(review2.gates.every((g) => g.pass)).toBe(true);

    // --- Approve both ---
    const policy: MergePolicy = {
      minApprovals: 1,
      required: [],
      blockOnOpenClaims: false,
      autoMergeWhenGreen: false,
    };

    await voteReview(reviewStore, review1.id, "lead-dev", "approve");
    await voteReview(reviewStore, review2.id, "lead-dev", "approve");

    // --- Merge both ---
    const result1 = await tryMerge(client, reviewStore, review1.id, policy);
    const result2 = await tryMerge(client, reviewStore, review2.id, policy);

    expect(result1.pass).toBe(true);
    expect(result2.pass).toBe(true);
    expect(client.appliedMerges).toHaveLength(2);
    expect(client.appliedMerges[0]!.into).toBe("default");
    expect(client.appliedMerges[1]!.into).toBe("default");

    // --- Events were produced ---
    const branchEvents = await pollEvents(client, { op: "branch" });
    expect(branchEvents.length).toBeGreaterThanOrEqual(2); // two branches created
  });
});

// ----------------------------------------------------------------
// Demo 2: Crash simulation
// ----------------------------------------------------------------

describe("Integration: crash simulation", () => {
  test("agent crashes → lease expires → task requeued → new agent resumes", async () => {
    const client = createIntegratedClient();
    const clock = createFakeClock();
    const queue = createMemoryQueue();

    // --- Agent starts work ---
    const task = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "critical-work",
      agentId: "agent-a",
      payload: "Critical task",
      priority: 5,
      maxRetries: 2,
    });

    // Run agent, but handler will "crash" by throwing
    let attempt = 0;
    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "agent-a",
      task,
      handler: async (session) => {
        attempt++;
        if (attempt === 1) {
          // First attempt: simulate crash
          throw new Error("Agent crashed: OOM");
        }
        // Second attempt: succeeds
        await acquireLease(client, session, ["safe-element"]);
      },
      heartbeatMs: 30_000,
      clock,
      claimElementIds: ["safe-element"],
    });

    // First attempt failed
    expect(attempt).toBe(1);

    // Task was requeued (retries left)
    const retriedTask = await queue.dequeue("proj-1");
    expect(retriedTask).toBeDefined();
    expect(retriedTask!.status).toBe("running");
    expect(retriedTask!.retries).toBe(1);

    // --- Simulate time passing: heartbeat interval ---
    await clock.advance(30_000);

    // --- Run again (second attempt) ---
    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "agent-a",
      task: retriedTask!,
      handler: async (session) => {
        attempt++;
        await acquireLease(client, session, ["safe-element"]);
      },
      heartbeatMs: 30_000,
      clock,
      claimElementIds: ["safe-element"],
    });

    expect(attempt).toBe(2);
    expect(retriedTask!.status).toBe("done");

    // --- Verify reconcile detects orphan branches ---
    const result = await reconcile(client, queue, "proj-1");
    // "critical-work" branch has no claims now (released), so it's orphaned
    expect(result.orphanBranches).toContain("critical-task");
  });
});

// ----------------------------------------------------------------
// Demo 3: Drift detection
// ----------------------------------------------------------------

describe("Integration: drift detection", () => {
  test("code drifts from model → reportDrift detects → merge-review gate flags", async () => {
    const client = createIntegratedClient();
    const reviewStore = createReviewStore();

    // --- Simulate drift: the drift gate receives a reportDrift function that detects drift ---
    const fakeDriftFn = async () => ({
      driftedFiles: new Map([
        ["src/components/Login.tsx", ["expected-hash-abc", "actual-hash-xyz"]],
      ]),
      modelDiff: {
        nodes: {
          added: [],
          removed: [],
          modified: [{ id: "login", before: {} as never, after: {} as never, changes: ["title"] }],
        },
        relationships: { added: [], removed: [], modified: [] },
      },
      orphans: ["src/old-file.ts"],
    });

    // --- Open review with drift detection ---
    const review = await openReview(client, reviewStore, {
      projectId: "proj-1",
      branchName: "feature-drifted",
      targetBranch: "default",
      driftReportFn: fakeDriftFn,
      fs: {} as never,
      manifest: {} as never,
    });

    // --- Drift gate should have failed ---
    const driftGate = review.gates.find((g) => g.gate === "drift");
    expect(driftGate).toBeDefined();
    expect(driftGate!.pass).toBe(false);
    expect(driftGate!.report.some((r) => r.includes("Login.tsx"))).toBe(true);

    // --- Overall review is open but gates failed ---
    expect(review.status).toBe("open");

    // --- Try to merge — should fail because gates failed ---
    const policy: MergePolicy = {
      minApprovals: 1,
      required: [],
      blockOnOpenClaims: false,
      autoMergeWhenGreen: false,
    };

    await voteReview(reviewStore, review.id, "lead-dev", "approve");
    const mergeResult = await tryMerge(client, reviewStore, review.id, policy);
    expect(mergeResult.pass).toBe(false);
    expect(mergeResult.reason).toContain("drift");
  });
});

// ----------------------------------------------------------------
// Demo 4: Live event consumption
// ----------------------------------------------------------------

describe("Integration: live event consumption", () => {
  test("events are produced during agent work and consumed by pollEvents", async () => {
    const client = createIntegratedClient();
    const clock = createFakeClock();
    const queue = createMemoryQueue();

    const task = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "event-source",
      agentId: "agent-x",
      payload: "Generate events",
      priority: 1,
      maxRetries: 0,
    });

    const beforeTimestamp = clock.now();

    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "agent-x",
      task,
      handler: async (session) => {
        // Simulate a series of model mutations
        client.events.push(
          {
            op: "add",
            workspaceName: session.branchName,
            elementId: "sys-1",
            elementKind: "SoftwareSystem",
            timestamp: clock.now(),
          },
          {
            op: "add",
            workspaceName: session.branchName,
            elementId: "container-1",
            elementKind: "Container",
            timestamp: clock.now() + 1,
          },
          {
            op: "add",
            workspaceName: session.branchName,
            elementId: "rel-1",
            elementKind: "Relationship",
            timestamp: clock.now() + 2,
          },
        );
      },
      heartbeatMs: 30_000,
      clock,
    });

    // --- Poll all events since before the work ---
    const allEvents = await pollEvents(client, {}, beforeTimestamp);
    expect(allEvents.length).toBeGreaterThanOrEqual(3);

    // --- Filter by workspace ---
    const wsEvents = await pollEvents(client, { workspaceName: "generate-events" });
    expect(wsEvents.length).toBeGreaterThanOrEqual(3); // 3 add events + branch event from createSession
    expect(wsEvents.every((e) => e.workspaceName === "generate-events")).toBe(true);

    // --- Filter by op ---
    const addEvents = await pollEvents(client, { op: "add" });
    expect(addEvents.length).toBeGreaterThanOrEqual(3);

    // --- Simulate a dashboard subscribing and receiving events ---
    const recentEvents = await pollEvents(client, { since: beforeTimestamp + 1 });
    expect(recentEvents.length).toBeGreaterThanOrEqual(2);
  });
});
