# 07 — merge-review Spec

`@nowarelabs/merge-review` — the review/approval/CI pipeline over the model. This is what
turns agent work into shipped changes: gates, human approvals, merge policy.

New package, scaffolded per `02-package-conventions.md`. Composes cfour, workspace-do,
gen-diesel. Pure logic in `src/`; the DO serves events, this package consumes them.

## Responsibilities

### 7.1 Event consumption

- `pollEvents(project, filter, cursor)` → workspace-do `queryEvents`, or
- `tailEvents(project)` → WS subscription (`{ type: "subscribe", workspaceName, since }`)
  with replay-on-connect.
- `CfourEvent` already carries `workspaceName`, `op`, `elementId`, `elementKind`, `editorId`,
  `timestamp`, `snapshotBefore`, `after`, `batched`.

### 7.2 Gates

For a candidate branch (agent's merged-or-pending changes):

- `lintGate(diff)` — cfour `lint` on the diff.
- `validateGate(workspace)` — cfour `validate`.
- `driftGate(diff, fs)` — gen-diesel `reportDrift` (only when code is part of the change).
- `blockersGate(plan)` — cfour 2.1 `claimBlockers` on the branch's `planMerge` result:
  merge is blocked while another editor holds a claimed id.

Each gate returns `{ pass: boolean; report }`. A review **fails fast** when any gate fails.

### 7.3 Review + approval objects

```ts
interface Review {
  id: string; projectId: string; branchName: string; status: "open" | "approved" | "rejected";
  comments: ReviewComment[];        // from humans and agents
  votes: Record<editorId, "approve" | "reject">;
  gates: GateResult[]; createdAt: string;
}
```

- Opening a review runs all gates and snapshots the branch.
- `approve`/`reject` record votes; approval is durable (persist to workspace-do or its own
  storage — decide in implementation; workspace-do's proposals/approvals tables already cover
  the cross-boundary-relationship approval flow and should be reused for that part).

### 7.4 Merge policy

`MergePolicy { minApprovals: number; required: editorId[]; blockOnOpenClaims: boolean;
autoMergeWhenGreen: boolean }`:
- Check: approvals ≥ minApprovals, required reviewers approved, no open `claimBlockers`,
  all gates green.
- On pass → `applyMerge` (claim-enforced; atomic). On failure → review stays open, report
  surfaced to agents/humans.

### 7.5 Human-in-the-loop server binding

A thin server layer (follow-up) exposes review approve/reject/comment over the DO; the
studio UI consumes it. Core package stays transport-agnostic.

## Acceptance criteria

- Gate logic unit-tested with in-memory cfour workspaces + a fake workspace-do client.
- Merge policy matrix tested (approvals / required / blockers / gates / auto-merge).
- Replay-based CI: given a `since` cursor, the pipeline catches every missed event.
- No node builtins in `src/`.
