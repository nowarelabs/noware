# 04 — workspace-do Spec

`packages/workspace-do/src/index.ts` (833 lines) — one Durable Object per project. Scope
rule: **only what needs SQLite durability, the DO lifecycle/RPC, or WebSocket delivery.**
Anything that is pure domain logic goes to cfour; anything bigger goes to a new package.

## What it has today

`SCHEMA` (workspaces, elements, relationships, claims, claim_elements,
claim_relationships, proposals, approvals, branch_base), `hydrate()`, event-driven
`persist()`, `runForWorkspace`/`runForWorkspaces`/`mutate` (per-workspace lock),
`alarm()` (per-workspace `expireStaleClaims` sweeps awaited in `Promise.all`), hibernatable
WebSocket `fetch`/`webSocketMessage` broadcast, `getWorkspace`, `claim`/`touchClaim`/
`expireStaleClaims`, `planMerge`/`applyMerge`, `createBranch`, `diff`/`lint`/`validate`,
`exportModel`, proposal endpoints, `requestChange` → `getChanges`. 18 tests.

## What gets ADDED (Phase 3)

All additions delegate to cfour inside `runForWorkspace` and persist naturally.

### 3.1 Views persistence (fixes: layouts lost on restart)

- `SCHEMA` + `views` table: `(workspace_name, view_id, kind, title, description, scope_id,
data TEXT, updated_at, PK(workspace_name, view_id))`.
- `persist()`: handle the cfour 2.5 view events (`op: "add"|"update"`, `elementKind:
"View"`, `after` = view) → upsert.
- `hydrate()`: load views → cfour `restoreViews(views, workspaceName)` (add this small
  cfour helper, mirroring `restoreClaims`).
- RPCs (delegate + hydrate-first): `getSystemContextView`, `getContainerView`,
  `getComponentView`, `getCodeView`, `getTeamView`, `getFlowView`, `getFlowCatalog`,
  `getLegend`, `saveView`, `updateViewPosition`.
- Tests: save a view, restart, view present; two views in one workspace; two workspaces
  don't leak.

### 3.2 Durable event log (fixes: history is ephemeral; enables CI + audit + replay)

- `SCHEMA` + `events` table: `(seq INTEGER PRIMARY KEY AUTOINCREMENT, workspace_name, op,
element_id, element_kind, payload TEXT, timestamp INTEGER)`; index on
  `(workspace_name, op, timestamp)`.
- `persist()` appends **every** event (including view + proposal events) with the full
  payload JSON.
- RPC `queryEvents(filter: CfourEventQuery)` — reuse the existing `CfourEventQuery` type
  (workspaceName, op, elementId, elementKind, since, until, limit, offset).
- Pruning hook: `setEventLogMax(rows)` (drop oldest by `seq`), default off.
- Broadcast behavior unchanged (broadcast still fires from memory).
- Tests: each mutation produces a row; `queryEvents` filters by op/elementId/since/limit;
  rows survive restart; pruning caps the table.

### 3.3 Durable listing (fixes: empty after restart)

- `listWorkspaces()` → rows from `workspaces` table
  `(workspace_name, title, description, created_at, updated_at)`.
- `listBranches()` → rows from `branch_base` `(branch_name, parent_name, created_at)`.
- (Replaces relying on `getWorkspaceNames()`, which is memory-only and empty after restart.)
- Tests: after restart both lists are correct.

### 3.4 `deleteWorkspace` / `deleteBranch`

- `deleteWorkspace(name)`: refuse if another workspace's `branch_base` references it as
  parent (or cascade-delete the branch lineage — pick refusal for v1); delete all rows for
  that workspace across every table (nodes, relationships, claims + junctions, proposals +
  approvals, branch_base, views, events); broadcast a synthesized `{ op: "delete" }` event.
- `deleteBranch(name)`: only a leaf branch (no `branch_base` row points to it) may be
  deleted; removes its branch_base row and its workspace rows.
- Tests: delete workspace; delete blocked when branches derive from it; leaf branch delete.

### 3.5 WebSocket subscription + replay (enables live dashboards + CI tails)

Control messages: `{ type: "subscribe", workspaceName?, since? }`,
`{ type: "unsubscribe" }`. Per-socket subscription set:

- `subscribe` with `since` → reply `{ type: "replay", events }` from the events table,
  then stream live events.
- `subscribe` without `since` → reply `{ type: "snapshot", workspaceName, workspace }`
  (full `getWorkspace`), then stream live.
- Broadcast delivers only to sockets subscribed to that workspace (or all, when no filter —
  preserve current behavior as the default).
- Tests: subscribe+replay after a gap; snapshot on fresh connect; filtered broadcast
  delivery; unsubscribe stops delivery.

### 3.6 `applyBatch` — atomic multi-op mutation (agent primitive)

- cfour (Phase 2) exports an opcode union type:
  `CfourOperation` = `{ op: "addPerson" | "addSoftwareSystem" | "addContainer" |
"addComponent" | "addCodeElement" | "addRelationship" | "updateElement" |
"updateRelationship" | "removeElement" | "removeRelationship"; args: [...] }` — a typed
  discriminated union, not `unknown[]`.
- workspace-do `applyBatch(workspaceName, editorId, ops)` → runs inside
  `runForWorkspace` + `cfour.batch(...)`: atomic, claim-enforced, rolled back on any error.
- Emits each mutation event (batch does not suppress events).
- Tests: batch applies all ops; mid-batch failure rolls back everything; claims enforced per
  op; persisted + restart-correct.

### 3.7 Thin RPC exposures (query surface for agents/reviews)

- Collaboration: `releaseAllClaimsFor(editorId, workspaceName?)`, `getClaimFor(elementId,
workspaceName?)` — release events persist naturally.
- Queries: `findNodes`, `findRelationships`, `getSelection`, `getSubtree`, `getAncestors`,
  `getDescendants` (hydrate-first delegates).
- Analysis: `lint`, `validate`, `diff(wsA, wsB)`.
- Tests: representative subset + serialization round-trip over RPC.

### 3.8 Identity seam (`resolveEditor`)

- `protected resolveEditor(request: Request): string` — used by the `fetch` entrypoint
  (WebSocket upgrade + any HTTP JSON-RPC path), reading `X-Editor-Id` by default, returning
  `"anonymous"` otherwise.
- Document the limitation: DO RPC cannot see original request headers, so RPC calls keep
  taking an explicit `editorId`; production gateways must verify and mint that id. Real
  auth/session verification belongs to gateway/auth packages, not workspace-do.
- Tests: default header mapping + fallback.

### 3.9 Alarm extension

If cfour 2.2 lands: `alarm()` also runs `expireStaleProposals` per workspace (same
`Promise.all` pattern). No event emission for expired proposals (matches claims precedent).

## Acceptance criteria (Phase 3)

- All 18 existing tests still pass; new tests added per item above.
- `vp check` clean under `types: ["@cloudflare/workers-types"]`; no node builtins in `src/`.
- Every new RPC is hydrate-first (correct across restarts), every mutation is claim-safe,
  every broadcast is filtered per subscription.
