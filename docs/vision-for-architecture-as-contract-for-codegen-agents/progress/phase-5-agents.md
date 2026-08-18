# Phase 5 — @nowarelabs/agents

## What was built

Multi-agent orchestration package providing:

### Session model
- `createSession(client, opts)` — derives a branch name from the task (slugified), ensures the branch exists via `branchWorkspace`, returns `AgentSession` with `projectId`, `agentId`, `editorId`, `branchName`, and `lease` state.
- `acquireLease(client, session, elementIds)` — calls `client.claim()` and stores the resulting claim id in `session.lease.claimIds`.
- `releaseLease(client, session)` — calls `client.releaseAllClaimsFor()` and clears the claim ids.

### Heartbeat loop
- `createHeartbeatLoop(client, claimIds, opts)` — interval-based heartbeat calling `touchClaim` for each claim id. Returns `{ start(), stop() }`.
- `Clock` interface — `now()`, `setTimeout`, `setInterval`. Production uses `createWallClock()` (real timers); tests inject a fake clock for deterministic time.

### Task queue
- `TaskQueue` interface — `enqueue`, `dequeue`, `update`, `findByAgent`.
- `createMemoryQueue()` — in-memory implementation for testing. Dequeues by priority (highest first), FIFO within same priority.

### Reconcile
- `reconcile(client, queue, projectId)` — detects orphan branches (branches with no live claims). Future: expired sessions, task requeueing.

### Agent runner
- `runAgent(client, queue, opts)` — full lifecycle: create session → acquire lease → start heartbeat → run handler → release claims → mark done. On error: release claims, stop heartbeat, mark failed, requeue if retries remain.

### WorkspaceDoClient interface
Injected dependency — tests provide a fake; production binds to a real workspace-do DO stub.

## Test results

```
packages/agents: 23 tests ✅
Full workspace: 42 files, 1109 tests ✅
```

## Design decisions

- **WorkspaceDoClient as interface**: no real DO required for unit tests. Production binds to a DO stub; tests provide a fake implementation.
- **Clock interface**: deterministic time in tests via `createFakeClock()`. The fake clock's `advance()` is async and flushes microtasks so async heartbeat callbacks resolve correctly.
- **No node builtins**: core imports nothing from `node:*` — runs on Workers.
- **Slugify for branch names**: `createSession` slugifies the task string into a branch name. Shortens to 64 chars max.
- **Memory queue for testing**: `createMemoryQueue()` is not durable; production should back onto workspace-do or an external queue.
