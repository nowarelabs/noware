# Changelog

## 0.1.0 — Architecture as Contract for Codegen Agents

First release of the C4 model-backed architecture system. The C4 model becomes the
single source of truth: agents and humans claim, propose, branch, and merge against it,
so nobody can silently corrupt or diverge from the architecture.

### New packages

- **`@nowarelabs/cfour`** — Pure C4 domain kernel. Workspaces, elements (systems,
  containers, components, code), relationships, views, claims + proposals (crash-safe
  leases), branching + merging with conflict resolution, lint, validate, diff, row
  serialization. 140 tests.

- **`@nowarelabs/workspace-do`** — Cloudflare Durable Object wrapping `BaseCfour`. SQLite
  persistence, RPC surface (thin query + mutation + branch + claim + merge), hibernatable
  WebSocket subscriptions with replay/snapshot, alarm-based claim + proposal expiry. 40
  tests.

- **`@nowarelabs/gen-diesel`** — Codegen pipeline extracted from cfour. `Extractor`
  interface, `reportDrift`, `renderMermaid`/`renderPlantUml`, `writeDiagram`,
  `TemplatePack` (React + Node stubs), `createNodeCodebaseFs` (node-only subpath). 28
  tests.

- **`@nowarelabs/agents`** — Multi-agent orchestration. Session model (branch-per-task),
  claim ↔ lease mapping, heartbeat loop, `TaskQueue` (in-memory), `reconcile` (orphan
  branch detection), `runAgent` (full lifecycle). 23 unit + 4 integration tests.

- **`@nowarelabs/merge-review`** — Review/approval pipeline. Event consumption
  (`pollEvents`), four gates (lint, validate, drift, blockers) with fail-fast `runGates`,
  `Review` + `ReviewStore`, declarative `MergePolicy` with auto-merge via `tryMerge`. 32
  tests.

### Integration demos (Phase 7)

- Multi-agent factory: two agents on separate branches merged through merge-review.
- Crash simulation: agent crash → lease expiry → task requeue → resume.
- Drift detection: code drifts → `reportDrift` detects → gate blocks merge.
- Live event consumption: events produced and consumed via `pollEvents`.

### Design principles

- **Workers-safe**: all core packages have `types: ["@cloudflare/workers-types"]`, no node
  builtins in `src/`. Node-only adapters live on subpaths (`gen-diesel/node`).
- **Injected clients**: every package that needs workspace-do or cfour takes an injected
  interface — tests provide fakes, production binds to real DO stubs.
- **Crash-safe by default**: claims are leases with TTL + heartbeat + alarm expiry. An
  agent crash automatically frees its resources.
- **The model is the contract**: codegen is a projection of the model, not a source. Drift
  between model and code is detected and flagged.
