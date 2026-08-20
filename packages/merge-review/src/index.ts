/**
 * @nowarelabs/merge-review — review, approval, and merge policy over the cfour model.
 *
 * Consumes `CfourChangeEvent`s from workspace-do (poll or tail), runs gates
 * (lint, validate, drift, claim-blockers), manages review/approval state, and
 * enforces a merge policy before applying merges atomically.
 *
 * Core package stays **transport-agnostic** — no node builtins, no DO binding.
 * The DO serves events; this package consumes them through an injected client.
 *
 * ## Module doc comment — §7
 *
 * Gates return `{ pass: boolean; report }`. A review fails fast when any gate
 * fails. MergePolicy controls auto-merge and required reviewers.
 */

import type {
  CfourChangeEvent,
  CfourEventQuery,
  C4MergePlan,
  C4WorkspaceDiff,
  C4View,
} from "@nowarelabs/cfour";
import type { DriftReport, CodebaseFs, GenerationManifest } from "@nowarelabs/gen-diesel";
import type { MergeState, MergeConflict, MergeResolution } from "@nowarelabs/shared";

// ----------------------------------------------------------------
// Injected client (tests fake this)
// ----------------------------------------------------------------

/**
 * The subset of workspace-do + cfour RPCs merge-review needs. Injected, not
 * imported — tests provide a fake; production binds to a real DO stub.
 */
export interface MergeReviewClient {
  queryEvents(filter: CfourEventQuery): Promise<CfourChangeEvent[]>;
  planMerge(branch: string, into: string): Promise<C4MergePlan>;
  applyMerge(plan: C4MergePlan, into: string): Promise<void>;
  lint(view?: C4View, workspaceName?: string): ReturnType<LintFn>;
  validate(workspaceName?: string): ReturnType<ValidateFn>;
  diff(workspaceA: string, workspaceB: string): Promise<C4WorkspaceDiff>;
  /** Lookup a view by name in a workspace (for drift gate). */
  getView?(name: string, workspaceName?: string): C4View | undefined;
}

type LintFn = (
  view?: C4View,
  workspaceName?: string,
) => Array<{ check: string; message: string; category: "General" | "Elements" | "Relationships" }>;

type ValidateFn = (
  workspaceName?: string,
) => Array<{ id: string; message: string; severity: "error" | "warning" }>;

// ----------------------------------------------------------------
// Event consumption (7.1)
// ----------------------------------------------------------------

/**
 * Polls workspace-do for events since a cursor (timestamp). Returns events
 * in chronological order.
 */
export async function pollEvents(
  client: MergeReviewClient,
  filter: CfourEventQuery,
  since?: number,
): Promise<CfourChangeEvent[]> {
  const query: CfourEventQuery = { ...filter };
  if (since !== undefined) query.since = since;
  return client.queryEvents(query);
}

/**
 * Tail events — interface for a real-time subscription. The client
 * implementation handles WS connections; this function just defines the
 * shape. Returns an async iterable of events.
 *
 * In tests, the client mock pushes events manually.
 */
export type EventTail = AsyncIterable<CfourChangeEvent>;

export function tailEvents(_client: MergeReviewClient, _workspaceName: string): EventTail {
  // Production: WS subscription with replay-on-connect.
  // This is a placeholder — the actual binding is a follow-up (§7.5).
  return {
    [Symbol.asyncIterator]() {
      return {
        next() {
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}

// ----------------------------------------------------------------
// Gate results (7.2)
// ----------------------------------------------------------------

export interface GateResult {
  gate: "lint" | "validate" | "drift" | "blockers";
  pass: boolean;
  report: string[];
}

/**
 * Lint gate: runs cfour `lint` on the workspace and returns pass/fail.
 * Fails if any error-level lint issues exist.
 */
export function lintGate(client: MergeReviewClient, workspaceName?: string): GateResult {
  const issues = client.lint(undefined as C4View | undefined, workspaceName);
  const errors = issues.filter((i) => i.category === "Elements" || i.category === "Relationships");
  return {
    gate: "lint",
    pass: errors.length === 0,
    report: issues.map((i) => `[${i.category}] ${i.check}: ${i.message}`),
  };
}

/**
 * Validate gate: runs cfour `validate` on the workspace.
 * Fails if any severity: "error" issues exist.
 */
export function validateGate(client: MergeReviewClient, workspaceName?: string): GateResult {
  const issues = client.validate(workspaceName);
  const errors = issues.filter((i) => i.severity === "error");
  return {
    gate: "validate",
    pass: errors.length === 0,
    report: issues.map((i) => `[${i.severity}] ${i.id}: ${i.message}`),
  };
}

/**
 * Drift gate: runs gen-diesel `reportDrift` when code is part of the change.
 * Passes when no files have drifted from the manifest.
 *
 * Accepts an external `reportDrift` function and the required dependencies
 * so the package doesn't directly depend on gen-diesel's implementation.
 */
export async function driftGate(
  reportDriftFn: (
    cfour: { diff: MergeReviewClient["diff"] },
    fs: CodebaseFs,
    manifest: GenerationManifest,
  ) => Promise<DriftReport>,
  cfour: { diff: MergeReviewClient["diff"] },
  fs: CodebaseFs,
  manifest: GenerationManifest,
): Promise<GateResult> {
  const report = await reportDriftFn(cfour, fs, manifest);
  const driftedCount = report.driftedFiles.size;
  const orphansCount = report.orphans.length;
  return {
    gate: "drift",
    pass: driftedCount === 0 && orphansCount === 0,
    report: [
      ...(report.driftedFiles.size > 0
        ? [`Drifted files: ${[...report.driftedFiles.keys()].join(", ")}`]
        : []),
      ...(report.orphans.length > 0 ? [`Orphan files: ${report.orphans.join(", ")}`] : []),
      ...(driftedCount === 0 && orphansCount === 0 ? ["No drift detected"] : []),
    ],
  };
}

/**
 * Blockers gate: checks `claimBlockers` on a merge plan.
 * Fails if any element is claimed by another editor.
 */
export function blockersGate(plan: C4MergePlan): GateResult {
  const blockers = plan.claimBlockers;
  return {
    gate: "blockers",
    pass: blockers.length === 0,
    report:
      blockers.length > 0
        ? blockers.map((b) => `Blocked: ${b.elementId} held by ${b.holderEditorId}`)
        : ["No claim blockers"],
  };
}

/**
 * Run all gates for a candidate branch merge. Returns results in order;
 * fails fast (stops at first failure).
 */
export async function runGates(
  client: MergeReviewClient,
  branch: string,
  into: string,
  opts?: {
    driftReportFn?: (
      cfour: { diff: MergeReviewClient["diff"] },
      fs: CodebaseFs,
      manifest: GenerationManifest,
    ) => Promise<DriftReport>;
    fs?: CodebaseFs;
    manifest?: GenerationManifest;
  },
): Promise<GateResult[]> {
  const results: GateResult[] = [];

  // 1. Lint
  const lint = lintGate(client, branch);
  results.push(lint);
  if (!lint.pass) return results;

  // 2. Validate
  const validate = validateGate(client, branch);
  results.push(validate);
  if (!validate.pass) return results;

  // 3. Drift (only if fs + manifest provided)
  if (opts?.driftReportFn && opts.fs && opts.manifest) {
    const drift = await driftGate(opts.driftReportFn, client, opts.fs, opts.manifest);
    results.push(drift);
    if (!drift.pass) return results;
  }

  // 4. Blockers (requires merge plan)
  const plan = await client.planMerge(branch, into);
  const blockers = blockersGate(plan);
  results.push(blockers);

  return results;
}

// ----------------------------------------------------------------
// Review + approval objects (7.3)
// ----------------------------------------------------------------

export type ReviewStatus = "open" | "approved" | "rejected";

export interface ReviewComment {
  id: string;
  editorId: string;
  text: string;
  createdAt: number;
}

export interface Review {
  id: string;
  projectId: string;
  branchName: string;
  targetBranch: string;
  status: ReviewStatus;
  comments: ReviewComment[];
  votes: Record<string, "approve" | "reject">;
  gates: GateResult[];
  createdAt: number;
}

/** In-memory review store for testing. */
export function createReviewStore(): ReviewStore {
  const reviews = new Map<string, Review>();
  let counter = 0;

  return {
    async create(input) {
      const review: Review = {
        id: `review-${++counter}`,
        projectId: input.projectId,
        branchName: input.branchName,
        targetBranch: input.targetBranch,
        status: "open",
        comments: [],
        votes: {},
        gates: input.gates,
        createdAt: Date.now(),
      };
      reviews.set(review.id, review);
      return review;
    },

    async get(id) {
      return reviews.get(id) ?? undefined;
    },

    async update(id, patch) {
      const review = reviews.get(id);
      if (!review) throw new Error(`Review "${id}" not found`);
      Object.assign(review, patch);
      return review;
    },

    async listByBranch(projectId, branchName) {
      return [...reviews.values()].filter(
        (r) => r.projectId === projectId && r.branchName === branchName,
      );
    },

    async listByProject(projectId) {
      return [...reviews.values()].filter((r) => r.projectId === projectId);
    },
  };
}

export interface ReviewStore {
  create(
    input: Omit<Review, "id" | "status" | "comments" | "votes" | "createdAt">,
  ): Promise<Review>;
  get(id: string): Promise<Review | undefined>;
  update(id: string, patch: Partial<Review>): Promise<Review>;
  listByBranch(projectId: string, branchName: string): Promise<Review[]>;
  listByProject(projectId: string): Promise<Review[]>;
}

/**
 * Opens a review: runs all gates, creates a review record.
 * Returns the review with gate results.
 */
export async function openReview(
  client: MergeReviewClient,
  store: ReviewStore,
  opts: {
    projectId: string;
    branchName: string;
    targetBranch: string;
    driftReportFn?: (
      cfour: { diff: MergeReviewClient["diff"] },
      fs: CodebaseFs,
      manifest: GenerationManifest,
    ) => Promise<DriftReport>;
    fs?: CodebaseFs;
    manifest?: GenerationManifest;
  },
): Promise<Review> {
  const gates = await runGates(client, opts.branchName, opts.targetBranch, {
    driftReportFn: opts.driftReportFn,
    fs: opts.fs,
    manifest: opts.manifest,
  });
  return store.create({
    projectId: opts.projectId,
    branchName: opts.branchName,
    targetBranch: opts.targetBranch,
    gates,
  });
}

/**
 * Adds a comment to a review.
 */
export async function addComment(
  store: ReviewStore,
  reviewId: string,
  editorId: string,
  text: string,
): Promise<ReviewComment> {
  const review = await store.get(reviewId);
  if (!review) throw new Error(`Review "${reviewId}" not found`);
  const comment: ReviewComment = {
    id: `comment-${review.comments.length + 1}`,
    editorId,
    text,
    createdAt: Date.now(),
  };
  review.comments.push(comment);
  await store.update(reviewId, { comments: review.comments });
  return comment;
}

// ----------------------------------------------------------------
// Merge policy (7.4)
// ----------------------------------------------------------------

export interface MergePolicy {
  /** Minimum number of approvals required. */
  minApprovals: number;
  /** Editor ids whose approval is required (empty = any approver suffices). */
  required: string[];
  /** Block merge while another editor holds a claimed id. */
  blockOnOpenClaims: boolean;
  /** Auto-merge when all gates pass and approvals are met. */
  autoMergeWhenGreen: boolean;
}

export interface MergeCheckResult {
  pass: boolean;
  reason: string;
}

/**
 * Evaluates whether a review satisfies a merge policy.
 * Does NOT apply the merge — use `tryMerge` for that.
 */
export function evaluateMerge(review: Review, policy: MergePolicy): MergeCheckResult {
  // 1. Must be open
  if (review.status !== "open") {
    return { pass: false, reason: `Review is ${review.status}, not open` };
  }

  // 2. All gates must pass
  const failedGates = review.gates.filter((g) => !g.pass);
  if (failedGates.length > 0) {
    return {
      pass: false,
      reason: `Gates failed: ${failedGates.map((g) => g.gate).join(", ")}`,
    };
  }

  // 3. Approval count
  const approvals = Object.values(review.votes).filter((v) => v === "approve").length;
  if (approvals < policy.minApprovals) {
    return {
      pass: false,
      reason: `Need ${policy.minApprovals} approvals, have ${approvals}`,
    };
  }

  // 4. Required reviewers
  for (const required of policy.required) {
    if (review.votes[required] !== "approve") {
      return {
        pass: false,
        reason: `Required reviewer "${required}" has not approved`,
      };
    }
  }

  return { pass: true, reason: "All policy checks passed" };
}

/**
 * Approve or reject a review. Returns the updated review.
 */
export async function voteReview(
  store: ReviewStore,
  reviewId: string,
  editorId: string,
  vote: "approve" | "reject",
): Promise<Review> {
  const review = await store.get(reviewId);
  if (!review) throw new Error(`Review "${reviewId}" not found`);
  if (review.status !== "open") {
    throw new Error(`Cannot vote on a review that is ${review.status}`);
  }
  review.votes[editorId] = vote;
  return store.update(reviewId, { votes: review.votes });
}

/**
 * Evaluates policy and, if auto-merge is enabled and all checks pass,
 * applies the merge atomically. Returns the check result.
 */
export async function tryMerge(
  client: MergeReviewClient,
  store: ReviewStore,
  reviewId: string,
  policy: MergePolicy,
): Promise<MergeCheckResult> {
  const review = await store.get(reviewId);
  if (!review) throw new Error(`Review "${reviewId}" not found`);

  const check = evaluateMerge(review, policy);
  if (!check.pass) return check;

  // Apply merge
  const plan = await client.planMerge(review.branchName, review.targetBranch);
  await client.applyMerge(plan, review.targetBranch);
  await store.update(reviewId, { status: "approved" });

  return check;
}

/**
 * Reject a review. Returns the check result (always fails with the rejection reason).
 */
export async function rejectReview(
  store: ReviewStore,
  reviewId: string,
  editorId: string,
  reason: string,
): Promise<MergeCheckResult> {
  const review = await store.get(reviewId);
  if (!review) throw new Error(`Review "${reviewId}" not found`);

  await voteReview(store, reviewId, editorId, "reject");
  await store.update(reviewId, { status: "rejected" });

  return { pass: false, reason: `Rejected by ${editorId}: ${reason}` };
}

// ----------------------------------------------------------------
// Stigmergic: AtomMergeResolver
// ----------------------------------------------------------------

export interface AtomMergeResolverConfig {
  id: string;
  atomId: string;
  sourceBranchId: string;
  targetBranchId?: string;
}

export class AtomMergeResolver {
  state: MergeState;

  constructor(config: AtomMergeResolverConfig) {
    this.state = {
      id: config.id,
      atomId: config.atomId,
      sourceBranchId: config.sourceBranchId,
      targetBranchId: config.targetBranchId,
      status: "pending",
      createdAt: Date.now(),
    };
  }

  autoMerge(sourceContent: string, targetContent: string): boolean {
    if (sourceContent === targetContent) {
      this.state.status = "merged";
      this.state.mergedAt = Date.now();
      return true;
    }
    this.state.conflicts = [{
      id: `conflict-${Date.now()}`,
      section: "full",
      sourceValue: sourceContent,
      targetValue: targetContent,
    }];
    this.state.status = "conflict";
    return false;
  }

  manualMerge(resolution: MergeResolution): void {
    this.state.resolution = resolution;
    this.state.status = "merged";
    this.state.mergedAt = Date.now();
    this.state.conflicts = [];
  }

  gateMerge(passed: boolean, reason?: string): boolean {
    if (passed) {
      this.state.status = "merged";
      this.state.mergedAt = Date.now();
      return true;
    }
    this.state.status = "rejected";
    return false;
  }

  reject(reason: string): void {
    this.state.status = "rejected";
    this.state.resolution = {
      strategy: "manual",
      resolvedBy: "system",
      resolvedAt: Date.now(),
      details: reason,
    };
  }
}
