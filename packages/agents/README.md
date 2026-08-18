# @nowarelabs/agents

Multi-agent orchestration built on crash-safe leases (cfour + workspace-do).

## Install

```bash
pnpm add @nowarelabs/agents
```

## Quick Start

```ts
import {
  createSession,
  acquireLease,
  releaseLease,
  createHeartbeatLoop,
  createWallClock,
  runAgent,
} from "@nowarelabs/agents";

// Inject a WorkspaceDoClient that talks to your workspace-do instance.
const client = { /* ... */ };

// Run an agent task end-to-end (session, lease, heartbeat, handler, cleanup):
await runAgent(client, queue, {
  projectId: "proj-1",
  agentId: "my-agent",
  task,
  handler: async (session, task) => {
    // Do work, claim elements via acquireLease(), etc.
  },
  claimElementIds: ["element-1"],
  heartbeatMs: 30_000,
  clock: createWallClock(),
});
```

## API

### Session model

| Export | Description |
| --- | --- |
| `createSession(client, opts)` | Creates a session; derives a branch name from the task and ensures the branch exists. |
| `acquireLease(client, session, elementIds)` | Claims element ids and stores the claim id in `session.lease.claimIds`. |
| `releaseLease(client, session)` | Releases all claims held by the session's editor. |

### Heartbeat

| Export | Description |
| --- | --- |
| `createHeartbeatLoop(client, claimIds, opts)` | Creates a heartbeat loop that calls `touchClaim` at the configured interval. Returns `{ start(), stop() }`. |
| `createWallClock()` | Wall-clock using real `setTimeout`/`setInterval`. Inject a `Clock` in tests for deterministic time. |

### Task queue

| Export | Description |
| --- | --- |
| `createMemoryQueue()` | In-memory `TaskQueue` for testing. Not durable. |
| `Task` | `{ id, projectId, branch, agentId, payload, priority, deadline?, retries, maxRetries, status, failureReason? }` |
| `TaskQueue` | `enqueue`, `dequeue`, `update`, `findByAgent` |

### Reconcile

| Export | Description |
| --- | --- |
| `reconcile(client, queue, projectId)` | Detects orphan branches (branches with no live claims). |

### Agent runner

| Export | Description |
| --- | --- |
| `runAgent(client, queue, opts)` | Full loop: create session → acquire lease → heartbeat → handler → release claims → mark done. On error, requeues if retries remain. |

## Architecture

```
┌─────────────┐   inject    ┌──────────────────┐
│  runAgent   │ ──────────► │ WorkspaceDoClient│
│  reconcile  │             │ (interface)      │
│  heartbeat  │             └──────────────────┘
└─────────────┘
```

- **WorkspaceDoClient** is an interface — production binds to a real DO stub; tests provide a fake.
- **Clock** is an interface — production uses `createWallClock()`; tests inject a fake for deterministic time.
- The package imports **no node builtins** — runs on Workers.

## Exports

| Export | From |
| --- | --- |
| `createSession`, `acquireLease`, `releaseLease` | Session model |
| `createHeartbeatLoop`, `createWallClock` | Heartbeat |
| `createMemoryQueue` | Task queue |
| `reconcile` | Reconcile |
| `runAgent` | Agent runner |

## Development

```bash
pnpm vp check   # lint + format + typecheck
pnpm vp test    # unit tests
```
