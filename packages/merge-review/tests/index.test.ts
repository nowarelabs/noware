import { describe, expect, test } from "vite-plus/test";
import type {
  CfourChangeEvent,
  CfourEventQuery,
  C4MergePlan,
  C4WorkspaceDiff,
  C4View,
} from "@nowarelabs/cfour";
import type { MergeReviewClient, Review, MergePolicy } from "../src/index.ts";
import {
  pollEvents,
  lintGate,
  validateGate,
  blockersGate,
  driftGate,
  runGates,
  createReviewStore,
  openReview,
  addComment,
  evaluateMerge,
  voteReview,
  tryMerge,
  rejectReview,
} from "../src/index.ts";

// ----------------------------------------------------------------
// Fake client
// ----------------------------------------------------------------

function createFakeClient(overrides?: Partial<MergeReviewClient>): MergeReviewClient & {
  events: CfourChangeEvent[];
  lintIssues: Array<{
    check: string;
    message: string;
    category: "General" | "Elements" | "Relationships";
  }>;
  validateIssues: Array<{ id: string; message: string; severity: "error" | "warning" }>;
  mergePlans: Map<string, C4MergePlan>;
  appliedMerges: Array<{ plan: C4MergePlan; into: string }>;
} {
  const events: CfourChangeEvent[] = [];
  const lintIssues: Array<{
    check: string;
    message: string;
    category: "General" | "Elements" | "Relationships";
  }> = [];
  const validateIssues: Array<{ id: string; message: string; severity: "error" | "warning" }> = [];
  const mergePlans = new Map<string, C4MergePlan>();
  const appliedMerges: Array<{ plan: C4MergePlan; into: string }> = [];

  return {
    events,
    lintIssues,
    validateIssues,
    mergePlans,
    appliedMerges,

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

    async planMerge(branch: string, into: string) {
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
    },

    lint(_view?: C4View, _workspaceName?: string) {
      return lintIssues;
    },

    validate(_workspaceName?: string) {
      return validateIssues;
    },

    async diff(_workspaceA: string, _workspaceB: string): Promise<C4WorkspaceDiff> {
      return {
        nodes: { added: [], removed: [], modified: [] },
        relationships: { added: [], removed: [], modified: [] },
      };
    },

    ...overrides,
  };
}

// ----------------------------------------------------------------
// Event consumption (7.1)
// ----------------------------------------------------------------

describe("Event consumption", () => {
  test("pollEvents returns events matching the filter", async () => {
    const client = createFakeClient();
    client.events.push(
      { op: "add", workspaceName: "ws-1", elementId: "n1", timestamp: 100 },
      { op: "update", workspaceName: "ws-1", elementId: "n1", timestamp: 200 },
      { op: "add", workspaceName: "ws-2", elementId: "n2", timestamp: 300 },
    );

    const result = await pollEvents(client, { workspaceName: "ws-1" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.workspaceName === "ws-1")).toBe(true);
  });

  test("pollEvents respects since cursor", async () => {
    const client = createFakeClient();
    client.events.push(
      { op: "add", workspaceName: "ws-1", elementId: "n1", timestamp: 100 },
      { op: "add", workspaceName: "ws-1", elementId: "n2", timestamp: 200 },
      { op: "add", workspaceName: "ws-1", elementId: "n3", timestamp: 300 },
    );

    const result = await pollEvents(client, {}, 150);
    expect(result).toHaveLength(2);
    expect(result[0]!.elementId).toBe("n2");
    expect(result[1]!.elementId).toBe("n3");
  });

  test("pollEvents respects limit", async () => {
    const client = createFakeClient();
    client.events.push(
      { op: "add", workspaceName: "ws-1", elementId: "n1", timestamp: 100 },
      { op: "add", workspaceName: "ws-1", elementId: "n2", timestamp: 200 },
      { op: "add", workspaceName: "ws-1", elementId: "n3", timestamp: 300 },
    );

    const result = await pollEvents(client, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  test("pollEvents returns empty for no matches", async () => {
    const client = createFakeClient();
    client.events.push({ op: "add", workspaceName: "ws-1", elementId: "n1", timestamp: 100 });

    const result = await pollEvents(client, { workspaceName: "ws-2" });
    expect(result).toHaveLength(0);
  });
});

// ----------------------------------------------------------------
// Gates (7.2)
// ----------------------------------------------------------------

describe("Gates", () => {
  test("lintGate passes when no lint issues", () => {
    const client = createFakeClient();
    const result = lintGate(client);
    expect(result.pass).toBe(true);
    expect(result.gate).toBe("lint");
  });

  test("lintGate fails when category issues exist", () => {
    const client = createFakeClient();
    client.lintIssues.push({
      check: "orphan",
      message: "Element without parent",
      category: "Elements",
    });
    const result = lintGate(client);
    expect(result.pass).toBe(false);
    expect(result.report.length).toBe(1);
  });

  test("lintGate passes for General-only issues", () => {
    const client = createFakeClient();
    client.lintIssues.push({ check: "naming", message: "Could be shorter", category: "General" });
    const result = lintGate(client);
    expect(result.pass).toBe(true);
  });

  test("validateGate passes when no errors", () => {
    const client = createFakeClient();
    const result = validateGate(client);
    expect(result.pass).toBe(true);
    expect(result.gate).toBe("validate");
  });

  test("validateGate fails when error-level issues exist", () => {
    const client = createFakeClient();
    client.validateIssues.push({ id: "n1", message: "Missing required field", severity: "error" });
    const result = validateGate(client);
    expect(result.pass).toBe(false);
  });

  test("validateGate passes for warning-only issues", () => {
    const client = createFakeClient();
    client.validateIssues.push({ id: "n1", message: "Optional field empty", severity: "warning" });
    const result = validateGate(client);
    expect(result.pass).toBe(true);
  });

  test("blockersGate passes when no claim blockers", () => {
    const plan: C4MergePlan = {
      branch: "b",
      into: "main",
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
    };
    const result = blockersGate(plan);
    expect(result.pass).toBe(true);
    expect(result.gate).toBe("blockers");
  });

  test("blockersGate fails when claims block the merge", () => {
    const plan: C4MergePlan = {
      branch: "b",
      into: "main",
      branchChanges: {
        nodes: { added: [], removed: [], modified: [] },
        relationships: { added: [], removed: [], modified: [] },
      },
      targetChanges: {
        nodes: { added: [], removed: [], modified: [] },
        relationships: { added: [], removed: [], modified: [] },
      },
      conflicts: [],
      claimBlockers: [{ elementId: "n1", holderEditorId: "agent-x" }],
    };
    const result = blockersGate(plan);
    expect(result.pass).toBe(false);
    expect(result.report[0]).toContain("agent-x");
  });

  test("driftGate passes when no drift", async () => {
    const fakeDriftFn = async () => ({
      driftedFiles: new Map<string, string[]>(),
      modelDiff: {
        nodes: { added: [], removed: [], modified: [] },
        relationships: { added: [], removed: [], modified: [] },
      },
      orphans: [],
    });
    const result = await driftGate(fakeDriftFn, {} as never, {} as never, {} as never);
    expect(result.pass).toBe(true);
    expect(result.gate).toBe("drift");
  });

  test("driftGate fails when files have drifted", async () => {
    const fakeDriftFn = async () => ({
      driftedFiles: new Map([["src/foo.ts", ["hash-mismatch"]]]),
      modelDiff: {
        nodes: { added: [], removed: [], modified: [] },
        relationships: { added: [], removed: [], modified: [] },
      },
      orphans: [],
    });
    const result = await driftGate(fakeDriftFn, {} as never, {} as never, {} as never);
    expect(result.pass).toBe(false);
    expect(result.report[0]).toContain("src/foo.ts");
  });

  test("runGates stops at first failure (lint)", async () => {
    const client = createFakeClient();
    client.lintIssues.push({ check: "x", message: "bad", category: "Elements" });
    client.validateIssues.push({ id: "y", message: "err", severity: "error" });

    const results = await runGates(client, "branch", "main");
    expect(results).toHaveLength(1);
    expect(results[0]!.gate).toBe("lint");
    expect(results[0]!.pass).toBe(false);
  });

  test("runGates runs all gates when all pass", async () => {
    const client = createFakeClient();
    client.mergePlans.set("branch->main", {
      branch: "branch",
      into: "main",
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
    });

    const results = await runGates(client, "branch", "main");
    expect(results).toHaveLength(3); // lint + validate + blockers (no drift without fs)
    expect(results.every((r) => r.pass)).toBe(true);
  });
});

// ----------------------------------------------------------------
// Review + approval objects (7.3)
// ----------------------------------------------------------------

describe("Review store", () => {
  test("createReviewStore creates and retrieves reviews", async () => {
    const store = createReviewStore();
    const review = await store.create({
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
      gates: [],
    });

    expect(review.id).toBeDefined();
    expect(review.status).toBe("open");
    expect(review.projectId).toBe("p1");

    const fetched = await store.get(review.id);
    expect(fetched?.id).toBe(review.id);
  });

  test("listByBranch returns matching reviews", async () => {
    const store = createReviewStore();
    await store.create({ projectId: "p1", branchName: "a", targetBranch: "main", gates: [] });
    await store.create({ projectId: "p1", branchName: "b", targetBranch: "main", gates: [] });

    const results = await store.listByBranch("p1", "a");
    expect(results).toHaveLength(1);
    expect(results[0]!.branchName).toBe("a");
  });

  test("update patches review fields", async () => {
    const store = createReviewStore();
    const review = await store.create({
      projectId: "p1",
      branchName: "a",
      targetBranch: "main",
      gates: [],
    });
    const updated = await store.update(review.id, { status: "rejected" });
    expect(updated.status).toBe("rejected");
  });
});

describe("Review lifecycle", () => {
  test("openReview runs gates and creates review", async () => {
    const client = createFakeClient();
    const store = createReviewStore();

    const review = await openReview(client, store, {
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
    });

    expect(review.status).toBe("open");
    expect(review.gates.length).toBeGreaterThan(0);
    expect(review.branchName).toBe("feature");
  });

  test("addComment adds a comment to the review", async () => {
    const client = createFakeClient();
    const store = createReviewStore();
    const review = await openReview(client, store, {
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
    });

    const comment = await addComment(store, review.id, "human-1", "Looks good!");
    expect(comment.text).toBe("Looks good!");
    expect(comment.editorId).toBe("human-1");

    const fetched = await store.get(review.id);
    expect(fetched!.comments).toHaveLength(1);
  });
});

// ----------------------------------------------------------------
// Merge policy (7.4)
// ----------------------------------------------------------------

describe("Merge policy", () => {
  const policy: MergePolicy = {
    minApprovals: 2,
    required: ["lead-dev"],
    blockOnOpenClaims: true,
    autoMergeWhenGreen: false,
  };

  function makeReview(overrides?: Partial<Review>): Review {
    return {
      id: "r1",
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
      status: "open",
      comments: [],
      votes: {},
      gates: [
        { gate: "lint", pass: true, report: [] },
        { gate: "validate", pass: true, report: [] },
        { gate: "blockers", pass: true, report: [] },
      ],
      createdAt: Date.now(),
      ...overrides,
    };
  }

  test("evaluateMerge fails when review is not open", () => {
    const review = makeReview({ status: "approved" });
    const result = evaluateMerge(review, policy);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("approved");
  });

  test("evaluateMerge fails when gates fail", () => {
    const review = makeReview({
      gates: [{ gate: "lint", pass: false, report: ["lint error"] }],
    });
    const result = evaluateMerge(review, policy);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("lint");
  });

  test("evaluateMerge fails when not enough approvals", () => {
    const review = makeReview({ votes: { "dev-1": "approve" } });
    const result = evaluateMerge(review, policy);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("2 approvals");
  });

  test("evaluateMerge fails when required reviewer has not approved", () => {
    const review = makeReview({
      votes: { "dev-1": "approve", "dev-2": "approve" },
    });
    const result = evaluateMerge(review, policy);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("lead-dev");
  });

  test("evaluateMerge passes when all conditions met", () => {
    const review = makeReview({
      votes: { "dev-1": "approve", "dev-2": "approve", "lead-dev": "approve" },
    });
    const result = evaluateMerge(review, policy);
    expect(result.pass).toBe(true);
  });

  test("evaluateMerge passes with no required reviewers", () => {
    const loosePolicy: MergePolicy = {
      minApprovals: 1,
      required: [],
      blockOnOpenClaims: false,
      autoMergeWhenGreen: false,
    };
    const review = makeReview({ votes: { anyone: "approve" } });
    const result = evaluateMerge(review, loosePolicy);
    expect(result.pass).toBe(true);
  });

  test("voteReview records a vote", async () => {
    const store = createReviewStore();
    const review = await store.create({
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
      gates: [],
    });

    const updated = await voteReview(store, review.id, "dev-1", "approve");
    expect(updated.votes["dev-1"]).toBe("approve");
  });

  test("voteReview rejects voting on non-open review", async () => {
    const store = createReviewStore();
    const review = await store.create({
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
      gates: [],
    });
    await store.update(review.id, { status: "approved" });

    await expect(voteReview(store, review.id, "dev-1", "approve")).rejects.toThrow("approved");
  });

  test("tryMerge applies merge when policy passes", async () => {
    const client = createFakeClient();
    const store = createReviewStore();
    const review = await store.create({
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
      gates: [
        { gate: "lint", pass: true, report: [] },
        { gate: "validate", pass: true, report: [] },
        { gate: "blockers", pass: true, report: [] },
      ],
    });

    // Add enough votes
    await voteReview(store, review.id, "dev-1", "approve");
    await voteReview(store, review.id, "lead-dev", "approve");

    const loosePolicy: MergePolicy = {
      minApprovals: 2,
      required: ["lead-dev"],
      blockOnOpenClaims: false,
      autoMergeWhenGreen: true,
    };

    const result = await tryMerge(client, store, review.id, loosePolicy);
    expect(result.pass).toBe(true);
    expect(client.appliedMerges).toHaveLength(1);
    expect(client.appliedMerges[0]!.into).toBe("main");

    const updated = await store.get(review.id);
    expect(updated!.status).toBe("approved");
  });

  test("tryMerge does not apply when policy fails", async () => {
    const client = createFakeClient();
    const store = createReviewStore();
    const review = await store.create({
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
      gates: [{ gate: "lint", pass: false, report: ["lint error"] }],
    });

    const result = await tryMerge(client, store, review.id, policy);
    expect(result.pass).toBe(false);
    expect(client.appliedMerges).toHaveLength(0);
  });

  test("rejectReview marks the review as rejected", async () => {
    const client = createFakeClient();
    const store = createReviewStore();
    const review = await openReview(client, store, {
      projectId: "p1",
      branchName: "feature",
      targetBranch: "main",
    });

    const result = await rejectReview(store, review.id, "lead-dev", "Needs more work");
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("lead-dev");

    const updated = await store.get(review.id);
    expect(updated!.status).toBe("rejected");
  });
});
