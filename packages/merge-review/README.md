# @nowarelabs/merge-review

Review, approval, and merge policy engine over the cfour model.

## Install

```bash
pnpm add @nowarelabs/merge-review
```

## Quick Start

```ts
import {
  createReviewStore,
  openReview,
  voteReview,
  tryMerge,
  pollEvents,
} from "@nowarelabs/merge-review";

const store = createReviewStore();

// Open a review — runs all gates automatically
const review = await openReview(client, store, {
  projectId: "proj-1",
  branchName: "feature-login",
  targetBranch: "main",
});

// Approve
await voteReview(store, review.id, "lead-dev", "approve");

// Try merge — checks policy, then applies atomically
const result = await tryMerge(client, store, review.id, {
  minApprovals: 2,
  required: ["lead-dev"],
  blockOnOpenClaims: true,
  autoMergeWhenGreen: true,
});
```

## API

### Event consumption (7.1)

| Export | Description |
| --- | --- |
| `pollEvents(client, filter, since?)` | Polls workspace-do for `CfourChangeEvent`s matching a filter, optionally since a timestamp cursor. |
| `tailEvents(client, workspaceName)` | Placeholder for WS-based real-time event tailing (follow-up in §7.5). |

### Gates (7.2)

| Export | Description |
| --- | --- |
| `lintGate(client, workspaceName?)` | Runs cfour `lint`; fails on Elements/Relationships category issues. |
| `validateGate(client, workspaceName?)` | Runs cfour `validate`; fails on severity "error" issues. |
| `driftGate(fn, cfour, fs, manifest)` | Runs gen-diesel `reportDrift`; fails when files have drifted or orphans exist. |
| `blockersGate(plan)` | Checks `claimBlockers` on a `C4MergePlan`; fails when another editor holds a claim. |
| `runGates(client, branch, into, opts?)` | Runs all gates in order; fails fast at the first failure. |

### Review + approval (7.3)

| Export | Description |
| --- | --- |
| `createReviewStore()` | In-memory review store for testing. |
| `openReview(client, store, opts)` | Runs gates, creates an open review record. |
| `addComment(store, reviewId, editorId, text)` | Adds a comment to a review. |
| `voteReview(store, reviewId, editorId, vote)` | Records an approve/reject vote. Only works on open reviews. |

### Merge policy (7.4)

| Export | Description |
| --- | --- |
| `evaluateMerge(review, policy)` | Checks approvals, required reviewers, gates, and blockers. Returns `{ pass, reason }`. |
| `tryMerge(client, store, reviewId, policy)` | Evaluates policy + applies merge atomically if all checks pass. |
| `rejectReview(store, reviewId, editorId, reason)` | Rejects a review and records the vote. |

### Types

| Export | Description |
| --- | --- |
| `MergeReviewClient` | Injected interface — tests fake it, production binds to a DO stub. |
| `Review` | `{ id, projectId, branchName, targetBranch, status, comments, votes, gates, createdAt }` |
| `GateResult` | `{ gate, pass, report }` |
| `MergePolicy` | `{ minApprovals, required, blockOnOpenClaims, autoMergeWhenGreen }` |
| `ReviewStore` | `create`, `get`, `update`, `listByBranch`, `listByProject` |

## Architecture

```
┌──────────────────┐     inject     ┌──────────────────┐
│  openReview      │ ─────────────► │ MergeReviewClient│
│  tryMerge        │                │ (interface)      │
│  pollEvents      │                └──────────────────┘
└──────────────────┘
```

- **MergeReviewClient** is an interface — production binds to a real DO stub; tests provide a fake.
- Core package stays **transport-agnostic** — no node builtins, no DO binding.
- Gates return `{ pass: boolean; report: string[] }`. A review fails fast when any gate fails.

## Development

```bash
pnpm vp check   # lint + format + typecheck
pnpm vp test    # unit tests
```
