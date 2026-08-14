import { describe, expect, test, vi } from "vite-plus/test";
import type { C4Relationship } from "@nowarelabs/cfour";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { WorkspaceDO } from "../src/index.ts";

// ---------------------------------------------------------------------
// Runtime shim for workerd's globals. The DO source references the worker
// global scope directly (Request/Response/WebSocket/WebSocketPair/TextDecoder)
// and imports only the DurableObject base class from `cloudflare:workers`, so
// the mocks must install the same globals Node's vitest would otherwise lack —
// notably a Response that tolerates status 101, which undici's throws on.
// ---------------------------------------------------------------------

const h = vi.hoisted(() => {
  class MockWebSocket {
    sent: string[] = [];
    closed = false;
    accepted = false;
    readyState = 0;
    send(message: string | ArrayBuffer) {
      this.sent.push(typeof message === "string" ? message : "[binary]");
    }
    close(code?: number) {
      this.closed = true;
      this.readyState = 3;
      void code;
    }
    accept() {
      this.accepted = true;
      this.readyState = 1;
    }
  }
  class MockWebSocketPair {
    0: MockWebSocket;
    1: MockWebSocket;
    constructor() {
      this[0] = new MockWebSocket();
      this[1] = new MockWebSocket();
    }
    [Symbol.iterator]() {
      return [this[0], this[1]][Symbol.iterator]();
    }
  }
  class DurableObjectBase {
    protected ctx: unknown;
    protected env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  }
  class MockResponse {
    status: number;
    constructor(_body: unknown, init: { status?: number } = {}) {
      this.status = init.status ?? 200;
    }
  }
  Object.assign(globalThis as Record<string, unknown>, {
    Response: MockResponse,
    WebSocketPair: MockWebSocketPair,
  });
  return { MockWebSocket, MockWebSocketPair, DurableObjectBase, MockResponse };
});

vi.mock("cloudflare:workers", () => ({
  DurableObject: h.DurableObjectBase,
  Response: h.MockResponse,
  TextDecoder: globalThis.TextDecoder,
  WebSocketPair: h.MockWebSocketPair,
}));

// ---------------------------------------------------------------------
// Helpers — a node:sqlite-backed stand-in for the DO's storage so the whole
// lifecycle (write, cold restart, alarm) can be exercised under Node.
// ---------------------------------------------------------------------

type Row = Record<string, unknown>;

function makeCursor(rows: Row[]) {
  let i = 0;
  return {
    one: () => (rows.length ? rows[0] : null),
    all: () => rows,
    toArray: () => rows,
    raw: () => rows.map((r) => Object.values(r)),
    [Symbol.iterator]() {
      return {
        next: () =>
          i < rows.length ? { value: rows[i++], done: false } : { value: undefined, done: true },
      };
    },
  };
}

/**
 * A `cloudflare:workers` SqlStorage shim backed by node:sqlite — the same
 * synchronous call surface the real DO storage exposes. Multi-statement DDL
 * (the schema) with no bindings is routed through `db.exec`; everything else
 * goes through a prepared statement so `?` bindings behave like workerd.
 */
function makeSqlStorage(db: DatabaseSync) {
  return {
    exec(query: string, ...args: SQLInputValue[]) {
      if (args.length === 0 && /;\s*\S/.test(query)) {
        db.exec(query);
        return makeCursor([]);
      }
      const rows = db.prepare(query).all(...args) as Row[];
      return makeCursor(rows);
    },
    run(query: string, ...args: SQLInputValue[]) {
      const info = db.prepare(query).run(...args);
      return {
        changes: info.changes,
        duration: 0,
        lastRowId: info.lastInsertRowid,
        sizeBefore: 0,
        sizeAfter: 0,
        rowsRead: 0n,
        rowsWritten: 0n,
      };
    },
    batch() {
      throw new Error("batch() is not used by WorkspaceDO");
    },
  };
}

/**
 * Builds a DurableObjectState-shaped mock plus the supporting pieces the test
 * assertions need (the backing DatabaseSync, tracked sockets and alarms, the
 * schema-completion promise, and raw query helpers). Pass an existing
 * DatabaseSync to simulate a cold restart against the same storage.
 */
function createState(db?: DatabaseSync) {
  const database = db ?? new DatabaseSync(":memory:");
  const sockets: unknown[] = [];
  const alarmTimes: number[] = [];
  const blockPromises: Promise<unknown>[] = [];
  const kv = new Map<string, unknown>();

  const storage = {
    sql: makeSqlStorage(database),
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return kv.get(key) as T | undefined;
    },
    async put(key: string, value: unknown) {
      kv.set(key, value);
    },
    async delete(key: string) {
      return kv.delete(key);
    },
    async getAlarm() {
      return alarmTimes.length ? alarmTimes[alarmTimes.length - 1] : null;
    },
    async setAlarm(time: number) {
      alarmTimes.push(time);
    },
    async deleteAlarm() {
      alarmTimes.length = 0;
    },
  };

  const state = {
    storage,
    acceptWebSocket(ws: unknown) {
      sockets.push(ws);
    },
    getWebSockets() {
      return [...sockets];
    },
    getTags() {
      return new Set<string>();
    },
    blockConcurrencyWhile<T>(cb: () => Promise<T>) {
      const promise = cb();
      blockPromises.push(promise);
      return promise;
    },
    waitUntil(promise: Promise<unknown>) {
      void promise;
    },
  };

  return {
    db: database,
    state,
    storage,
    sockets,
    alarmTimes,
    async whenReady() {
      await Promise.all(blockPromises);
    },
    query<T = Row>(sqlText: string, ...args: SQLInputValue[]): T[] {
      return database.prepare(sqlText).all(...args) as T[];
    },
    run(sqlText: string, ...args: SQLInputValue[]) {
      return database.prepare(sqlText).run(...args);
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TestSocket {
  sent: string[];
  closed: boolean;
  accepted: boolean;
  readyState: number;
  close(code?: number, reason?: string): void;
  accept(): void;
  send(message: string | ArrayBuffer): void;
}

const ENV = { WORKSPACE_DO: {} };

function rel(id: string, sourceId: string, destinationId: string): C4Relationship {
  return {
    id,
    sourceId,
    destinationId,
    description: id,
    technology: "http",
    kind: "Relationship",
  };
}

function counts(state: ReturnType<typeof createState>) {
  const nodes = state.query<{ n: number }>("SELECT COUNT(*) AS n FROM nodes")[0].n;
  const rels = state.query<{ n: number }>("SELECT COUNT(*) AS n FROM relationships")[0].n;
  const claims = state.query<{ n: number }>("SELECT COUNT(*) AS n FROM claims")[0].n;
  const proposals = state.query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM relationship_proposals",
  )[0].n;
  const workspaces = state.query<{ n: number }>("SELECT COUNT(*) AS n FROM workspaces")[0].n;
  return { nodes, rels, claims, proposals, workspaces };
}

describe("WorkspaceDO persistence", () => {
  test("persists nodes and relationships and recovers them after a restart", async () => {
    const state1 = createState();
    const do1 = new WorkspaceDO(state1.state as never, ENV as never);
    await state1.whenReady();

    await do1.addSoftwareSystem({ id: "sys1", name: "S1", description: "the system" });
    await do1.addPerson({ id: "person1", name: "P1" });
    await do1.addRelationship(rel("r1", "sys1", "person1"), "default", "editor-a");

    expect(counts(state1)).toEqual({ nodes: 2, rels: 1, claims: 0, proposals: 0, workspaces: 1 });

    // ---- cold restart against the same SQLite database ----
    const state2 = createState(state1.db);
    const do2 = new WorkspaceDO(state2.state as never, ENV as never);
    await state2.whenReady();

    const ws = await do2.getWorkspace("default");
    expect(ws.softwareSystems.map((s) => s.id)).toEqual(["sys1"]);
    expect(ws.people.map((p) => p.id)).toEqual(["person1"]);
    expect(ws.relationships.map((r) => r.id)).toEqual(["r1"]);
    expect(ws.softwareSystems[0].description).toBe("the system");

    // The workspaces meta row was restored too.
    const meta = state2.query<{ title: string }>(
      "SELECT title FROM workspaces WHERE workspace_name = ?",
      "default",
    );
    expect(meta[0].title).toBe("Default Workspace");
  });

  test("a lazily-created workspace gets a meta row so it survives a restart", async () => {
    const state1 = createState();
    const do1 = new WorkspaceDO(state1.state as never, ENV as never);
    await state1.whenReady();

    // Bare adds into a workspace name that was never branched or initialized.
    await do1.addSoftwareSystem({ id: "sys1", name: "S1" }, "feature/x");
    await do1.addContainer({ id: "ctr1", name: "Ctr", systemId: "sys1" }, "feature/x", "editor-a");
    await do1.addComponent({ id: "c1", name: "C1", containerId: "ctr1" }, "feature/x", "editor-a");
    const before = counts(state1);
    expect(before.workspaces).toBe(1);
    expect(
      state1.query("SELECT title FROM workspaces WHERE workspace_name = ?", "feature/x")[0].title,
    ).toBe("feature/x");

    const state2 = createState(state1.db);
    const do2 = new WorkspaceDO(state2.state as never, ENV as never);
    await state2.whenReady();
    const ws = await do2.getWorkspace("feature/x");
    const components = ws.softwareSystems[0]?.containers?.[0]?.components;
    expect(components?.map((c) => c.id)).toEqual(["c1"]);
  });

  test("resetWorkspace wipes nodes, claims, proposals and branch lineage; import does not", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();

    await do_.addSoftwareSystem({ id: "sys1", name: "S1" });
    await do_.addSoftwareSystem({ id: "sys2", name: "S2" });
    await do_.branchWorkspace("default", "feature");
    await do_.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");
    await do_.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob");
    // Crosses a claim boundary (sys1 -> sys2), so bob must approve.
    await do_.proposeRelationship(rel("r1", "sys1", "sys2"), "alice");

    // sys1+sys2 exist in BOTH "default" and the "feature" branch, so 4 node rows.
    expect(counts(state)).toEqual({ nodes: 4, rels: 0, claims: 2, proposals: 1, workspaces: 2 });

    await do_.resetWorkspace("default", "Fresh Start", "reset for tests");
    // default is wiped; the feature branch's cloned rows remain.
    expect(counts(state)).toEqual({ nodes: 2, rels: 0, claims: 0, proposals: 0, workspaces: 2 });
    expect(
      state.query("SELECT title FROM workspaces WHERE workspace_name = ?", "default")[0].title,
    ).toBe("Fresh Start");

    // Branch lineage is gone from durable storage (the branch_base row is
    // deleted), so a RESTARTED DO can no longer plan a merge.
    expect(state.query<{ n: number }>("SELECT COUNT(*) AS n FROM branch_base")).toEqual([{ n: 0 }]);
    const state2 = createState(state.db);
    const do2 = new WorkspaceDO(state2.state as never, ENV as never);
    await state2.whenReady();
    await expect(do2.planMerge("feature", "default")).rejects.toThrow(/no recorded base revision/);
  });

  test("exported rows reconstruct a workspace with a zero-change diff", async () => {
    const state1 = createState();
    const do1 = new WorkspaceDO(state1.state as never, ENV as never);
    await state1.whenReady();

    await do1.addSoftwareSystem({ id: "sys1", name: "S1", tags: ["a", "b"] });
    await do1.addSoftwareSystem({ id: "sys2", name: "S2", external: true });
    await do1.addRelationship(rel("r1", "sys1", "sys2"), "default", "editor-a");
    await do1.updateElement("sys1", { name: "Renamed" }, "default", "editor-a");

    const state2 = createState(state1.db);
    const do2 = new WorkspaceDO(state2.state as never, ENV as never);
    await state2.whenReady();
    const ws1 = await do1.getWorkspace("default");
    const ws2 = await do2.getWorkspace("default");
    expect(ws2.softwareSystems.map((s) => s.name)).toEqual(ws1.softwareSystems.map((s) => s.name));
    expect(ws2.softwareSystems.find((s) => s.id === "sys2")?.external).toBe(true);
    expect(ws2.relationships.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("WorkspaceDO claims and proposals", () => {
  test("claims and relationship proposals survive a restart and keep enforcing", async () => {
    const state1 = createState();
    const do1 = new WorkspaceDO(state1.state as never, ENV as never);
    await state1.whenReady();

    await do1.addSoftwareSystem({ id: "s1", name: "S1" });
    await do1.addSoftwareSystem({ id: "s2", name: "S2" });
    const alice = await do1.claim({ elementIds: ["s1"], relationshipIds: [] }, "alice");
    const bob = await do1.claim({ elementIds: ["s2"], relationshipIds: [] }, "bob");
    const proposal = await do1.proposeRelationship(rel("r1", "s1", "s2"), "alice");
    expect([...proposal.pendingApprovals]).toEqual(["bob"]);

    const state2 = createState(state1.db);
    const do2 = new WorkspaceDO(state2.state as never, ENV as never);
    await state2.whenReady();

    const claims = await do2.getClaims("default");
    expect(claims.map((c) => c.editorId).sort()).toEqual(["alice", "bob"]);
    expect(claims.find((c) => c.id === alice.id)?.elementIds.has("s1")).toBe(true);
    expect(claims.find((c) => c.id === bob.id)?.elementIds.has("s2")).toBe(true);

    // Claims are live again after the restart: a third editor cannot overlap.
    await expect(do2.claim({ elementIds: ["s1"], relationshipIds: [] }, "carol")).rejects.toThrow(
      /overlaps claim/,
    );

    const proposals = await do2.getRelationshipProposals("default");
    expect(proposals.map((p) => p.id)).toEqual([proposal.id]);
    expect([...(proposals[0] as { pendingApprovals: Set<string> }).pendingApprovals]).toEqual([
      "bob",
    ]);

    // The persisted proposal can be accepted after the restart.
    await do2.acceptRelationship(proposal.id, "bob");
    const ws = await do2.getWorkspace("default");
    expect(ws.relationships.map((r) => r.id)).toEqual(["r1"]);
    expect(counts(state2).proposals).toBe(0);
  });

  test("release removes a claim from memory and SQLite", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();
    await do_.addSoftwareSystem({ id: "s1", name: "S1" });
    const claim = await do_.claim({ elementIds: ["s1"], relationshipIds: [] }, "alice");
    expect(counts(state).claims).toBe(1);
    await do_.release(claim.id);
    expect(counts(state).claims).toBe(0);
    expect(await do_.getClaims("default")).toEqual([]);
  });
});

describe("WorkspaceDO branching and merging", () => {
  test("merges across two workspace_names in one DO and keeps planning after restart", async () => {
    const state1 = createState();
    const do1 = new WorkspaceDO(state1.state as never, ENV as never);
    await state1.whenReady();

    await do1.addSoftwareSystem({ id: "sys", name: "System" }, "default");
    await do1.branchWorkspace("default", "feature");
    await do1.addSoftwareSystem({ id: "feat", name: "FeatureOnly" }, "feature");
    await do1.addSoftwareSystem({ id: "main", name: "MainOnly" }, "default");

    const plan = await do1.planMerge("feature", "default");
    expect(plan.branch).toBe("feature");
    expect(plan.into).toBe("default");
    expect(plan.conflicts).toEqual([]);

    await do1.applyMerge(plan, "default");
    const after = await do1.getWorkspace("default");
    expect(after.softwareSystems.map((s) => s.id).sort()).toEqual(["feat", "main", "sys"]);

    // ---- restart: branch lineage + both workspaces must be durable ----
    const state2 = createState(state1.db);
    const do2 = new WorkspaceDO(state2.state as never, ENV as never);
    await state2.whenReady();

    // The original branch's base revision was restored: planning still works
    // (it legitimately reports a conflict now, since feature was merged into
    // default above — "feat" was added on both sides of the recorded base).
    const replan = await do2.planMerge("feature", "default");
    expect(replan.conflicts).toEqual(["feat"]);

    // A fresh branch created on the restarted DO merges cleanly.
    await do2.branchWorkspace("default", "feature2");
    await do2.addSoftwareSystem({ id: "feat2", name: "F2" }, "feature2");
    const plan2 = await do2.planMerge("feature2", "default");
    expect(plan2.conflicts).toEqual([]);
    await do2.applyMerge(plan2, "default");
    const after2 = await do2.getWorkspace("default");
    expect(after2.softwareSystems.map((s) => s.id).sort()).toEqual([
      "feat",
      "feat2",
      "main",
      "sys",
    ]);
  });

  test("branchWorkspace rejects a branch that exists after a restart", async () => {
    const state1 = createState();
    const do1 = new WorkspaceDO(state1.state as never, ENV as never);
    await state1.whenReady();
    await do1.branchWorkspace("default", "feature");

    const state2 = createState(state1.db);
    const do2 = new WorkspaceDO(state2.state as never, ENV as never);
    await state2.whenReady();
    await expect(do2.branchWorkspace("default", "feature")).rejects.toThrow(/already exists/);

    // And a genuinely new branch still works.
    await do2.branchWorkspace("default", "feature2");
    const state3 = createState(state1.db);
    const do3 = new WorkspaceDO(state3.state as never, ENV as never);
    await state3.whenReady();
    expect((await do3.getWorkspace("feature2")).softwareSystems).toEqual([]);
  });

  test("merge conflicts block the apply and roll back", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();
    await do_.addSoftwareSystem({ id: "sys", name: "System" }, "default");
    await do_.branchWorkspace("default", "feature");
    await do_.updateElement("sys", { name: "Branch Name" }, "feature", "editor-a");
    await do_.updateElement("sys", { name: "Main Name" }, "default", "editor-b");

    const plan = await do_.planMerge("feature", "default");
    expect(plan.conflicts).toContain("sys");
    await expect(do_.applyMerge(plan, "default")).rejects.toThrow(/conflict/);
    const ws = await do_.getWorkspace("default");
    expect(ws.softwareSystems[0].name).toBe("Main Name");
  });
});

describe("WorkspaceDO claim TTL and alarm", () => {
  test("touchClaim refreshes last_seen_at both in memory and in SQLite", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();
    await do_.addSoftwareSystem({ id: "s1", name: "S1" });
    const claim = await do_.claim({ elementIds: ["s1"], relationshipIds: [] }, "alice");

    await sleep(2);
    const before = state.query<{ t: number }>(
      "SELECT last_seen_at AS t FROM claims WHERE id = ?",
      claim.id,
    )[0].t;
    await sleep(2);
    await do_.touchClaim(claim.id);
    const after = state.query<{ t: number }>(
      "SELECT last_seen_at AS t FROM claims WHERE id = ?",
      claim.id,
    )[0].t;
    expect(after).toBeGreaterThan(before);
  });

  test("stale claims expire and are removed from SQLite; fresh ones survive", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();
    await do_.addSoftwareSystem({ id: "s1", name: "S1" });
    await do_.addSoftwareSystem({ id: "s2", name: "S2" });
    const stale = await do_.claim({ elementIds: ["s1"], relationshipIds: [] }, "alice");

    // alice goes quiet; bob claims later and heartbeats right now.
    await sleep(6);
    const fresh = await do_.claim({ elementIds: ["s2"], relationshipIds: [] }, "bob");
    await do_.touchClaim(fresh.id);

    // 4ms threshold: alice (age ~6ms) expires, bob (age ~0ms) survives.
    const expired = await do_.expireStaleClaims("default", 4);
    expect(expired).toEqual([stale.id]);
    expect(await do_.getClaims("default")).toHaveLength(1);
    expect(state.query<{ n: number }>("SELECT COUNT(*) AS n FROM claims")[0].n).toBe(1);
  });

  test("the alarm expires stale claims across every workspace and reschedules itself", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();
    await do_.setClaimTtl(2);
    await do_.addSoftwareSystem({ id: "s1", name: "S1" }, "default");
    await do_.addSoftwareSystem({ id: "s2", name: "S2" }, "other");
    await do_.claim({ elementIds: ["s1"], relationshipIds: [] }, "alice");
    await do_.claim({ elementIds: ["s2"], relationshipIds: [] }, "bob");
    await sleep(5);

    const alarmsBefore = state.alarmTimes.length;
    await do_.alarm();

    expect(counts(state).claims).toBe(0);
    expect(state.alarmTimes.length).toBe(alarmsBefore + 1);
  });
});

describe("WorkspaceDO WebSocket broadcast", () => {
  test("fetch upgrades to a websocket and broadcasts every change event", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();

    const plain = { headers: { get: () => null }, url: "https://x.test/" };
    const refused = await do_.fetch(plain as never);
    expect(refused.status).toBe(426);

    const upgrade = {
      headers: { get: (name: string) => (name === "Upgrade" ? "websocket" : null) },
      url: "https://x.test/ws",
    };
    const response = await do_.fetch(upgrade as never);
    expect(response.status).toBe(101);
    expect(state.sockets).toHaveLength(1);
    const socket = state.sockets[0] as TestSocket;

    await do_.addSoftwareSystem({ id: "sys1", name: "S1" });
    await do_.updateElement("sys1", { name: "S1 renamed" }, "default", "editor-a");
    await do_.removeElement("sys1", "default", "editor-a");

    const events = socket.sent.map((m) => JSON.parse(m) as { op: string; elementId?: string });
    expect(events.map((e) => e.op)).toEqual(["add", "update", "remove"]);
    expect(events.map((e) => e.elementId)).toEqual(["sys1", "sys1", "sys1"]);
  });

  test("webSocketMessage touchClaim heartbeats refresh the durable claim", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();
    await do_.addSoftwareSystem({ id: "s1", name: "S1" });
    const claim = await do_.claim({ elementIds: ["s1"], relationshipIds: [] }, "alice");

    const upgrade = {
      headers: { get: (name: string) => (name === "Upgrade" ? "websocket" : null) },
      url: "https://x.test/ws",
    };
    await do_.fetch(upgrade as never);
    const socket = state.sockets[0] as TestSocket;

    await sleep(2);
    const before = state.query<{ t: number }>(
      "SELECT last_seen_at AS t FROM claims WHERE id = ?",
      claim.id,
    )[0].t;
    await sleep(2);
    do_.webSocketMessage(
      socket as never,
      JSON.stringify({ type: "touchClaim", claimId: claim.id }),
    );
    await sleep(2);
    const after = state.query<{ t: number }>(
      "SELECT last_seen_at AS t FROM claims WHERE id = ?",
      claim.id,
    )[0].t;
    expect(after).toBeGreaterThan(before);
  });

  test("webSocketMessage replies claimNotFound for an unknown claim", async () => {
    const state = createState();
    const do_ = new WorkspaceDO(state.state as never, ENV as never);
    await state.whenReady();
    const upgrade = {
      headers: { get: (name: string) => (name === "Upgrade" ? "websocket" : null) },
      url: "https://x.test/ws",
    };
    await do_.fetch(upgrade as never);
    const socket = state.sockets[0] as TestSocket;

    do_.webSocketMessage(socket as never, JSON.stringify({ type: "touchClaim", claimId: "nope" }));
    await sleep(2);
    expect(socket.sent.at(-1)).toContain("claimNotFound");
  });
});

describe("WorkspaceDO concurrency", () => {
  const env = ENV as never;

  test("writes to the same workspace serialize", async () => {
    const order: string[] = [];
    class SlowDO extends WorkspaceDO {
      protected async prepareWrite(workspaceName: string) {
        order.push(`start:${workspaceName}`);
        await sleep(30);
        order.push(`end:${workspaceName}`);
      }
    }
    const state = createState();
    const do_ = new SlowDO(state.state as never, env);
    await state.whenReady();

    const first = do_.addPerson({ id: "a", name: "A" }, "alpha");
    await sleep(5);
    const second = do_.addPerson({ id: "b", name: "B" }, "alpha");
    await Promise.all([first, second]);

    // Strictly sequential — the second write only began after the first ended.
    expect(order).toEqual(["start:alpha", "end:alpha", "start:alpha", "end:alpha"]);
    const ws = await do_.getWorkspace("alpha");
    expect(ws.people.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  test("writes to different workspaces do not block each other", async () => {
    const order: string[] = [];
    class VaryingDO extends WorkspaceDO {
      protected async prepareWrite(workspaceName: string) {
        order.push(`start:${workspaceName}`);
        await sleep(workspaceName === "alpha" ? 60 : 10);
        order.push(`end:${workspaceName}`);
      }
    }
    const state = createState();
    const do_ = new VaryingDO(state.state as never, env);
    await state.whenReady();

    const slowAlpha = do_.addPerson({ id: "a", name: "A" }, "alpha");
    await sleep(10);
    const fastBeta = do_.addPerson({ id: "b", name: "B" }, "beta");

    // Beta's write finishes while alpha's is still in flight.
    const betaDone = await Promise.race([fastBeta.then(() => true), sleep(200).then(() => false)]);
    expect(betaDone).toBe(true);
    expect((await do_.getWorkspace("beta")).people.map((p) => p.id)).toEqual(["b"]);

    // And the ordering proves the interleave: beta started before alpha ended.
    await slowAlpha;
    expect(order).toEqual(["start:alpha", "start:beta", "end:beta", "end:alpha"]);
  });
});
