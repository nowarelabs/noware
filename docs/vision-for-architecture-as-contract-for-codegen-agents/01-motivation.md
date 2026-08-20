# 01 — Motivation

## The product

We are building a suite of products around **AI agents that build software**:

- **Multi-agent software factory** — frontend/backend/infra agents each implement parts of a
  product in parallel.
- **Agent CI/review pipeline** — every agent change goes through plan → review → merge.
- **Human-in-the-loop agent studio** — agents draft, humans approve.
- **Crash-safe agent orchestration** — agents die and restart without losing coordination
  state or blocking each other.
- **Collaborative diagram/model editors** — humans and agents edit the same model live.
- **Review & approval workflows** — cross-boundary changes need sign-off.
- **Architecture-as-code backend** — the model is a durable, queryable service.
- **Branching model evolution (git-for-architecture)** — parallel work + conflict-aware merges.
- **Drift detection / model diffing** — the model is the contract; code that drifts is caught.
- **Multi-tenant SaaS** — one isolated project model per tenant.
- **Live architecture dashboards / docs** — real-time views and generated documentation.

The unifying idea: **the C4 model is the contract**. Agents (and humans) must claim, propose,
branch, and merge against it, so nobody — especially a hallucinating model — can silently
corrupt or diverge from the architecture. Codegen is a projection of the model, not a source.

## Why cfour and workspace-do exist

- `@nowarelabs/cfour` — the C4 model kernel: workspaces, systems/containers/components/code
  elements, relationships, claims + proposals (collaboration rules), branching + merging,
  diff/lint/validate, views, row serialization. 139 tests.
- `@nowarelabs/workspace-do` — a Cloudflare Durable Object that runs one `BaseCfour` per
  project, persisting every mutation to SQLite storage, exposing the model over RPC and
  hibernatable WebSockets, with a self-scheduling claim-expiry alarm. 18 tests.

A third-party code review validated the implementation (restore\* hydration, reserved
`REGISTER_EDITOR`, claim-enforced `applyMerge`, correct per-workspace locking) and found one
real bug we fixed (reset wiped all claim junction rows DO-wide) plus smaller issues.

## Why we are restructuring now

The review surfaced gaps needed by the agent products, and we initially listed them as "add
to cfour / add to workspace-do." Two reactions:

### 1. Don't stuff everything into two packages

The monorepo convention is small, single-purpose packages (`result`, `telemetry`, `router`,
`durable_objects`, …). Codegen, agent orchestration, and review/CI are each coherent products
of their own. They should be packages that **compose** cfour + workspace-do, not features
crammed into them.

Per-package scope rule:

- **cfour** gets only what is _pure C4 domain semantics_.
- **workspace-do** gets only what needs _SQLite durability or the DO lifecycle / RPC_.
- Everything else is a new package.

### 2. The "runs on Cloudflare" rule is currently violated

cfour imports node builtins:

```ts
import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
```

- `readFile` / `unlink` / `createHash` are used only by the **generator pipeline**
  (`hashFile`, `unlinkIfExists`, `detectDrift`, `deriveRelationshipId`, `planAndApply`).
- `randomUUID` is used by core collaboration (claim + proposal ids) and has a Workers-safe
  replacement: the global `crypto.randomUUID()` (works on Workers and Node ≥ 19).

The fix is structural, not cosmetic: **move the generator pipeline to `gen-diesel`** (the
only consumer of node:fs), and switch `randomUUID` to the Web Crypto global. After that,
cfour is a pure, Workers-runnable package. `gen-diesel`'s core stays pure too; file IO is
abstracted behind a `CodebaseFs` interface with a node adapter behind a subpath export
(`@nowarelabs/gen-diesel/node`) so the main entry never imports node builtins.

## The layering decision

```
┌─────────────────────────────────────────────────────────────┐
│ merge-review (reviews, approvals, merge policy, CI gates)   │
│ agents (sessions, leases, tasks, reconciliation)            │
├─────────────────────────────────────────────────────────────┤
│ workspace-do (durability + RPC + WS for one project)        │
├─────────────────────────────────────────────────────────────┤
│ cfour (pure C4 domain: model, claims, proposals, branches)  │
├─────────────────────────────────────────────────────────────┤
│ gen-diesel (codegen / DSL / extractors / drift / docs)      │
│   → composed by agents + merge-review + host CLIs           │
└─────────────────────────────────────────────────────────────┘
```

## Design decisions kept from earlier discussions

- One DO per project, not per branch — merge atomicity requires a single `BaseCfour` instance.
- Claims = crash-safe leases (TTL + heartbeat + alarm-expiry).
- `applyMerge` enforces claims under the reserved `REGISTER_EDITOR` identity.
- Codegen writes files **outside** the DO (host/agent side); the DO serves the model
  (`exportModel`, `diff`, `lint`, `validate`, event log) instead.
- Per-workspace write lock stays in workspace-do; it is correct because the lock read/write is
  synchronous JS with no `await` between them.
