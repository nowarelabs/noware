# 06 — agents Spec

`@nowarelabs/agents` — multi-agent orchestration built on crash-safe leases. This is the
"software factory" layer: it maps tasks to branches, hands agents claims, heartbeats their
leases, queues their work, and reconciles when agents die.

New package, scaffolded per `02-package-conventions.md`. Composes `result`, `telemetry`,
`jobs` (if reused for the queue), cfour, and workspace-do. Pure orchestration logic in
`src/`; a worker/DO runtime binding is a follow-up.

## Responsibilities

### 6.1 Session model

```ts
interface AgentSession {
  projectId: string;
  agentId: string;             // stable identity, e.g. "frontend-agent"
  branchName: string;          // branch-per-agent derived from the task
  editorId: string;            // same as the agent's editor identity in cfour
  lease: { workspaceName: string; claimIds: string[] };
}
```

`createSession({ projectId, agentId, task })` → resolves branch (reuse existing branch if the
task's branch exists, else create), `getWorkspace`, returns a session. Every session is keyed
by `agentId` so a crashed agent restarts into the same branch.

### 6.2 Claim ↔ lease mapping

A claim in cfour *is* the crash-safe lease:
- `agent.claim("default", elementIds, editorId)` on workspace-do grants the lease.
- Heartbeat loop: every `heartbeatMs` (default e.g. 30s) call `touchClaim`; run over a WS
  channel when connected (single in-flight, coalesce).
- On clean exit: `releaseAllClaimsFor(editorId)`.
- On crash: no more heartbeats → the DO alarm sweeps `expireStaleClaims` → the lease frees
  automatically. Nothing in agents needs to be a DO for this to be crash-safe; the DO owns
  expiry.

### 6.3 Task queue

Reuse the `jobs` package (or a workspace-do-hosted queue) with states
`queued → running → done | failed | retrying`. A task record carries: id, projectId, branch,
agentId, payload, priority, deadline, retry policy, result refs.

### 6.4 Reconciliation

`reconcile(projectId)`:
- Find sessions whose lease expired (query claims or `getChanges`) → mark their task
  `failed` with reason `"lease-expired"` → re-queue according to retry policy.
- Find orphaned branches (branch exists, no live session) → report, optionally delete.
- Emit telemetry events for every transition.

### 6.5 Agent boundary

The package defines **what an agent may do** (the loop):

```
loop:
  session = createSession(...)
  ws = getWorkspace(session.branchName)
  plan  = session.plan()          # agent proposes edits (see gen-diesel for codegen plans)
  claim selected ids
  apply edits via applyBatch / atomic cfour ops
  propose cross-boundary relationships (proposeRelationship)
  heartbeat loop (parallel)
  run codegen host-side against exported model (gen-diesel, node adapter)
  run lint/validate (merge-review owns the gates)
  release all claims on completion
```

This is the contract the merge-review CI gates and the human-in-the-loop studio build on.

## Acceptance criteria

- Orchestration logic fully unit-tested against an in-memory cfour + a fake workspace-do
  client (no real DO needed).
- Lease expiry → task requeue verified with fake clock; clean-exit releases verified.
- No node builtins in `src/`.
