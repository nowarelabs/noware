import { describe, expect, test } from "vite-plus/test";
import type { C4Claim, C4Workspace } from "@nowarelabs/cfour";
import type { WorkspaceDoClient, Clock } from "../src/index.ts";
import {
  createSession,
  acquireLease,
  releaseLease,
  createHeartbeatLoop,
  createMemoryQueue,
  reconcile,
  runAgent,
  createWallClock,
} from "../src/index.ts";

// ----------------------------------------------------------------
// Fake workspace-do client
// ----------------------------------------------------------------

function createFakeClient(): WorkspaceDoClient & {
  claims: Map<string, C4Claim>;
  branches: Array<{ branch: string; parent: string; createdAt: number }>;
  workspace: C4Workspace;
  touchCount: Map<string, number>;
} {
  const claims = new Map<string, C4Claim>();
  let claimCounter = 0;
  const touchCount = new Map<string, number>();

  const client: ReturnType<typeof createFakeClient> = {
    claims,
    touchCount,
    branches: [{ branch: "default", parent: "", createdAt: Date.now() }],
    workspace: {
      name: "default",
      people: [],
      softwareSystems: [],
      relationships: [],
    },

    async claim(selection, editorId, workspaceName = "default") {
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
      return claim;
    },

    async releaseAllClaimsFor(editorId, workspaceName) {
      for (const [id, claim] of claims) {
        if (
          claim.editorId === editorId &&
          (!workspaceName || claim.workspaceName === workspaceName)
        ) {
          claims.delete(id);
        }
      }
    },

    async touchClaim(claimId) {
      const claim = claims.get(claimId);
      if (claim) claim.lastSeenAt = Date.now();
      touchCount.set(claimId, (touchCount.get(claimId) ?? 0) + 1);
    },

    async getClaims() {
      return [...claims.values()];
    },

    async branchWorkspace(fromBranch, newBranch) {
      client.branches.push({
        branch: newBranch,
        parent: fromBranch,
        createdAt: Date.now(),
      });
    },

    async getWorkspace() {
      return client.workspace;
    },

    async listBranches() {
      return [...client.branches];
    },

    async deleteBranch(branch) {
      client.branches = client.branches.filter((b) => b.branch !== branch);
    },
  };

  return client;
}

// ----------------------------------------------------------------
// Fake clock
// ----------------------------------------------------------------

function createFakeClock(startMs = 1000): Clock & { advance(ms: number): void } {
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
    advance(ms) {
      time += ms;
      // Fire all due timers (collect first to avoid mutation issues)
      while (true) {
        const due = timers.filter((t) => t.at <= time);
        if (due.length === 0) break;
        for (const t of due) {
          const idx = timers.indexOf(t);
          if (idx >= 0) timers.splice(idx, 1);
          t.fn();
          if (t.interval) {
            t.at = time + ms; // reschedule at the same interval from now
            timers.push(t);
          }
        }
      }
    },
  };
}

// ----------------------------------------------------------------
// Session model (6.1)
// ----------------------------------------------------------------

describe("Session model", () => {
  test("createSession derives a branch name from the task and creates the branch", async () => {
    const client = createFakeClient();
    const session = await createSession(client, {
      projectId: "proj-1",
      agentId: "frontend-agent",
      task: "Build the login page",
    });

    expect(session.projectId).toBe("proj-1");
    expect(session.agentId).toBe("frontend-agent");
    expect(session.editorId).toBe("frontend-agent");
    expect(session.branchName).toBe("build-the-login-page");
    expect(session.lease.workspaceName).toBe("build-the-login-page");
    expect(session.lease.claimIds).toEqual([]);

    // Branch was created
    const branches = await client.listBranches();
    expect(branches.some((b) => b.branch === "build-the-login-page")).toBe(true);
  });

  test("createSession reuses an existing branch", async () => {
    const client = createFakeClient();
    await client.branchWorkspace("default", "existing-branch");

    const session = await createSession(client, {
      projectId: "proj-1",
      agentId: "agent-a",
      task: "existing branch", // slugifies to "existing-branch"
    });

    expect(session.branchName).toBe("existing-branch");
    // Only one "existing-branch" in the list (not duplicated)
    const matches = (await client.listBranches()).filter((b) => b.branch === "existing-branch");
    expect(matches).toHaveLength(1);
  });
});

// ----------------------------------------------------------------
// Lease / claim mapping (6.2)
// ----------------------------------------------------------------

describe("Lease / claim mapping", () => {
  test("acquireLease calls claim and stores claim ids in the session", async () => {
    const client = createFakeClient();
    const session = await createSession(client, {
      projectId: "proj-1",
      agentId: "agent-a",
      task: "do stuff",
    });

    await acquireLease(client, session, ["node-1", "node-2"]);

    expect(session.lease.claimIds).toHaveLength(1);
    const claim = client.claims.get(session.lease.claimIds[0]);
    expect(claim).toBeDefined();
    expect(claim!.editorId).toBe("agent-a");
    expect(claim!.elementIds).toEqual(["node-1", "node-2"]);
    expect(claim!.workspaceName).toBe("do-stuff");
  });

  test("acquireLease with empty element ids is a no-op", async () => {
    const client = createFakeClient();
    const session = await createSession(client, {
      projectId: "proj-1",
      agentId: "agent-a",
      task: "idle",
    });

    await acquireLease(client, session, []);
    expect(session.lease.claimIds).toEqual([]);
  });

  test("releaseLease calls releaseAllClaimsFor and clears claim ids", async () => {
    const client = createFakeClient();
    const session = await createSession(client, {
      projectId: "proj-1",
      agentId: "agent-a",
      task: "do stuff",
    });
    await acquireLease(client, session, ["node-1"]);
    expect(session.lease.claimIds).toHaveLength(1);

    await releaseLease(client, session);

    expect(session.lease.claimIds).toEqual([]);
    expect(client.claims.size).toBe(0);
  });
});

// ----------------------------------------------------------------
// Heartbeat loop (6.2)
// ----------------------------------------------------------------

describe("Heartbeat loop", () => {
  test("touchClaim is called at the configured interval", async () => {
    const client = createFakeClient();
    const clock = createFakeClock();
    const claimIds = ["c1", "c2"];

    const loop = createHeartbeatLoop(client, claimIds, {
      heartbeatMs: 1000,
      clock,
    });
    loop.start();

    // Advance 1 second — first heartbeat
    clock.advance(1000);
    expect(client.touchCount.get("c1")).toBe(1);
    expect(client.touchCount.get("c2")).toBe(1);

    // Advance another second — second heartbeat
    clock.advance(1000);
    expect(client.touchCount.get("c1")).toBe(2);
    expect(client.touchCount.get("c2")).toBe(2);

    loop.stop();
  });

  test("stop cancels the heartbeat", async () => {
    const client = createFakeClient();
    const clock = createFakeClock();

    const loop = createHeartbeatLoop(client, ["c1"], {
      heartbeatMs: 1000,
      clock,
    });
    loop.start();
    clock.advance(1000);
    expect(client.touchCount.get("c1")).toBe(1);

    loop.stop();
    clock.advance(1000);
    // No additional heartbeat after stop
    expect(client.touchCount.get("c1")).toBe(1);
  });

  test("multiple claims are all heartbeated", async () => {
    const client = createFakeClient();
    const clock = createFakeClock();
    const ids = ["c1", "c2", "c3"];

    const loop = createHeartbeatLoop(client, ids, {
      heartbeatMs: 500,
      clock,
    });
    loop.start();
    clock.advance(500);

    for (const id of ids) {
      expect(client.touchCount.get(id)).toBe(1);
    }
    loop.stop();
  });

  test("start is idempotent — only one interval runs", async () => {
    const client = createFakeClient();
    const clock = createFakeClock();

    const loop = createHeartbeatLoop(client, ["c1"], {
      heartbeatMs: 1000,
      clock,
    });
    loop.start();
    loop.start(); // second start is a no-op
    clock.advance(1000);
    expect(client.touchCount.get("c1")).toBe(1);
    loop.stop();
  });
});

// ----------------------------------------------------------------
// Task queue (6.3)
// ----------------------------------------------------------------

describe("Task queue", () => {
  test("enqueue returns a queued task, dequeue returns it as running", async () => {
    const queue = createMemoryQueue();
    const task = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "main",
      agentId: "agent-a",
      payload: { step: "build" },
      priority: 1,
      maxRetries: 3,
    });

    expect(task.status).toBe("queued");
    expect(task.retries).toBe(0);

    const dequeued = await queue.dequeue("proj-1");
    expect(dequeued?.id).toBe("t1");
    expect(dequeued?.status).toBe("running");
  });

  test("dequeue returns undefined when no tasks are available", async () => {
    const queue = createMemoryQueue();
    expect(await queue.dequeue("proj-1")).toBeUndefined();
  });

  test("dequeue is FIFO within the same priority", async () => {
    const queue = createMemoryQueue();
    await queue.enqueue({
      id: "t1",
      projectId: "p",
      branch: "b",
      agentId: "a",
      payload: null,
      priority: 1,
      maxRetries: 0,
    });
    await queue.enqueue({
      id: "t2",
      projectId: "p",
      branch: "b",
      agentId: "a",
      payload: null,
      priority: 1,
      maxRetries: 0,
    });

    const first = await queue.dequeue("p");
    expect(first?.id).toBe("t1");
    const second = await queue.dequeue("p");
    expect(second?.id).toBe("t2");
  });

  test("higher priority tasks are dequeued first", async () => {
    const queue = createMemoryQueue();
    await queue.enqueue({
      id: "low",
      projectId: "p",
      branch: "b",
      agentId: "a",
      payload: null,
      priority: 1,
      maxRetries: 0,
    });
    await queue.enqueue({
      id: "high",
      projectId: "p",
      branch: "b",
      agentId: "a",
      payload: null,
      priority: 10,
      maxRetries: 0,
    });

    const first = await queue.dequeue("p");
    expect(first?.id).toBe("high");
  });

  test("update patches a task's fields", async () => {
    const queue = createMemoryQueue();
    const task = await queue.enqueue({
      id: "t1",
      projectId: "p",
      branch: "b",
      agentId: "a",
      payload: null,
      priority: 1,
      maxRetries: 3,
    });

    const updated = await queue.update("t1", { status: "failed", failureReason: "boom" });
    expect(updated.status).toBe("failed");
    expect(updated.failureReason).toBe("boom");
  });

  test("findByAgent returns the running task for an agent", async () => {
    const queue = createMemoryQueue();
    await queue.enqueue({
      id: "t1",
      projectId: "p",
      branch: "b",
      agentId: "agent-x",
      payload: null,
      priority: 1,
      maxRetries: 0,
    });
    await queue.dequeue("p"); // marks t1 as running

    const found = await queue.findByAgent("agent-x");
    expect(found?.id).toBe("t1");

    // Different agent has no running task
    expect(await queue.findByAgent("agent-y")).toBeUndefined();
  });
});

// ----------------------------------------------------------------
// Reconcile (6.4)
// ----------------------------------------------------------------

describe("Reconcile", () => {
  test("orphan branches are detected when no claims exist for them", async () => {
    const client = createFakeClient();
    await client.branchWorkspace("default", "orphan-branch");
    const queue = createMemoryQueue();

    const result = await reconcile(client, queue, "proj-1");
    expect(result.orphanBranches).toContain("orphan-branch");
  });

  test("branches with active claims are not orphaned", async () => {
    const client = createFakeClient();
    await client.branchWorkspace("default", "live-branch");
    await client.claim({ elementIds: ["n1"], relationshipIds: [] }, "agent-a", "live-branch");
    const queue = createMemoryQueue();

    const result = await reconcile(client, queue, "proj-1");
    expect(result.orphanBranches).not.toContain("live-branch");
  });

  test("empty result when no orphan branches exist", async () => {
    const client = createFakeClient();
    const queue = createMemoryQueue();

    const result = await reconcile(client, queue, "proj-1");
    expect(result.expiredSessions).toEqual([]);
    expect(result.requeuedTasks).toEqual([]);
    expect(result.orphanBranches).toEqual([]);
  });
});

// ----------------------------------------------------------------
// Agent runner (6.5)
// ----------------------------------------------------------------

describe("Agent runner", () => {
  test("handler is called, claims released, task marked done", async () => {
    const client = createFakeClient();
    const queue = createMemoryQueue();
    const clock = createFakeClock();
    const handlerCalls: string[] = [];

    const task = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "build-login",
      agentId: "agent-a",
      payload: "Build the login page",
      priority: 1,
      maxRetries: 0,
    });

    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "agent-a",
      task,
      handler: async (session, t) => {
        handlerCalls.push(t.id);
        expect(session.lease.workspaceName).toBe("build-login");
      },
      heartbeatMs: 1000,
      clock,
      claimElementIds: ["node-1"],
    });

    expect(handlerCalls).toEqual(["t1"]);
    expect(client.claims.size).toBe(0); // released
    const updated = await queue.update("t1", {}); // re-read
    expect(updated.status).toBe("done");
  });

  test("error in handler marks task failed and requeues if retries remain", async () => {
    const client = createFakeClient();
    const queue = createMemoryQueue();
    const clock = createFakeClock();

    const task = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "failing-task",
      agentId: "agent-b",
      payload: "failing task",
      priority: 1,
      maxRetries: 2,
    });

    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "agent-b",
      task,
      handler: async () => {
        throw new Error("something broke");
      },
      heartbeatMs: 1000,
      clock,
      claimElementIds: ["node-1"],
    });

    const updated = await queue.update("t1", {});
    expect(updated.status).toBe("retrying");
    expect(updated.failureReason).toBe("something broke");
    expect(updated.retries).toBe(1);

    // A retry task was enqueued
    const retry = await queue.dequeue("proj-1");
    expect(retry).toBeDefined();
    expect(retry!.id).toBe("t1");
    expect(retry!.retries).toBe(1);
  });

  test("error with no retries left marks task as failed (not retrying)", async () => {
    const client = createFakeClient();
    const queue = createMemoryQueue();
    const clock = createFakeClock();

    const task = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "doomed",
      agentId: "agent-c",
      payload: "doomed task",
      priority: 1,
      maxRetries: 0,
    });

    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "agent-c",
      task,
      handler: async () => {
        throw new Error("fatal");
      },
      heartbeatMs: 1000,
      clock,
      claimElementIds: ["node-1"],
    });

    const updated = await queue.update("t1", {});
    expect(updated.status).toBe("failed");
    expect(updated.retries).toBe(1);

    // No retry task enqueued (max retries exhausted)
    expect(await queue.dequeue("proj-1")).toBeUndefined();
  });

  test("heartbeat runs during handler execution", async () => {
    const client = createFakeClient();
    const queue = createMemoryQueue();
    const clock = createFakeClock();

    const heartbeatTask = await queue.enqueue({
      id: "t1",
      projectId: "proj-1",
      branch: "slow-task",
      agentId: "agent-d",
      payload: "slow task",
      priority: 1,
      maxRetries: 0,
    });

    await runAgent(client, queue, {
      projectId: "proj-1",
      agentId: "agent-d",
      task: heartbeatTask,
      handler: async (_session) => {
        // Simulate work that takes 3 seconds
        clock.advance(3000);
      },
      heartbeatMs: 1000,
      clock,
      claimElementIds: ["node-1"],
    });

    // At least one heartbeat was fired during the 3s of simulated work
    const totalTouches = [...client.touchCount.values()].reduce((a, b) => a + b, 0);
    expect(totalTouches).toBeGreaterThanOrEqual(1);
  });
});

// ----------------------------------------------------------------
// Clock — wall clock
// ----------------------------------------------------------------

describe("Wall clock", () => {
  test("createWallClock returns a working clock", () => {
    const clock = createWallClock();
    const before = clock.now();
    expect(typeof before).toBe("number");
    expect(clock.now()).toBeGreaterThanOrEqual(before);
  });
});
