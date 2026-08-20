# Phase 7 — Product wiring (integration demos)

## What was built

Integration tests composing agents + merge-review to demonstrate the full pipeline.

### Multi-agent factory demo

Two agents work on separate branches (`build-login`, `build-api`), both merged through merge-review. Demonstrates the full lifecycle:

- `runAgent` creates sessions, claims elements, runs handlers, releases claims
- `openReview` runs gates on both branches
- `voteReview` + `tryMerge` merge both branches into default

### Crash simulation

Agent crashes mid-task → lease expires → task requeued → new agent resumes. Demonstrates:

- First attempt throws "OOM", task marked retrying and requeued
- Second attempt succeeds, task marked done
- `reconcile` detects orphan branch after completion

### Drift detection

Code drifts from model → `reportDrift` detects → merge-review gate flags. Demonstrates:

- `openReview` with a `driftReportFn` that reports drifted files
- Drift gate fails, blocking merge even with approvals

### Live event consumption

Events produced during agent work consumed via `pollEvents`. Demonstrates:

- Filtering by workspace name, op type, and since cursor
- Event production from branch creation, claims, and model mutations

## Test results

```
packages/agents: 23 unit + 4 integration = 27 tests ✅
Full workspace: 44 files, 1145 tests ✅
```
