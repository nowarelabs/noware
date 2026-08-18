# Phase 6 — @nowarelabs/merge-review

## What was built

Review, approval, and merge policy engine over the cfour model.

### Event consumption (7.1)
- `pollEvents(client, filter, since?)` — polls `CfourChangeEvent`s from workspace-do via `queryEvents`.
- `tailEvents(client, workspaceName)` — placeholder for WS-based real-time tailing (§7.5 follow-up).

### Gates (7.2)
- `lintGate(client, workspaceName?)` — wraps cfour `lint`; fails on Elements/Relationships category issues.
- `validateGate(client, workspaceName?)` — wraps cfour `validate`; fails on severity "error" issues.
- `driftGate(fn, cfour, fs, manifest)` — wraps gen-diesel `reportDrift`; fails when files have drifted.
- `blockersGate(plan)` — checks `claimBlockers` on a `C4MergePlan`; fails when another editor holds a claim.
- `runGates(client, branch, into, opts?)` — runs all gates in order; fails fast at first failure.

### Review + approval (7.3)
- `Review` interface: `{ id, projectId, branchName, targetBranch, status, comments, votes, gates, createdAt }`.
- `ReviewStore` interface + `createReviewStore()` — in-memory implementation for testing.
- `openReview(client, store, opts)` — runs gates, creates an open review record.
- `addComment(store, reviewId, editorId, text)` — adds a comment.
- `voteReview(store, reviewId, editorId, vote)` — records approve/reject; only on open reviews.

### Merge policy (7.4)
- `MergePolicy` interface: `{ minApprovals, required, blockOnOpenClaims, autoMergeWhenGreen }`.
- `evaluateMerge(review, policy)` — checks approvals, required reviewers, gates, blockers. Returns `{ pass, reason }`.
- `tryMerge(client, store, reviewId, policy)` — evaluates policy + applies merge atomically.
- `rejectReview(store, reviewId, editorId, reason)` — rejects and records the vote.

### MergeReviewClient interface
Injected dependency — tests provide a fake; production binds to a real workspace-do DO stub.

## Test results

```
packages/merge-review: 32 tests ✅
Full workspace: 43 files, 1141 tests ✅
```

## Design decisions

- **Transport-agnostic**: core package has no node builtins, no DO binding. The DO serves events; this package consumes them through an injected client.
- **Fail-fast gates**: `runGates` stops at the first failing gate — no need to run expensive checks (drift) if lint fails.
- **Drift gate is opt-in**: requires `driftReportFn` + `fs` + `manifest` to be provided; skipped otherwise.
- **Review store is in-memory**: for testing. Production should persist to workspace-do's existing approval tables or a dedicated store.
- **Merge policy is declarative**: `evaluateMerge` is pure; `tryMerge` is the side-effecting variant that applies the merge.
