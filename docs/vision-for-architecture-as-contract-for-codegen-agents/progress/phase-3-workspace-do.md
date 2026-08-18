# Phase 3 — WorkspaceDO durability & RPC surface (done)

Implements Phase 3 of `08-ordered-work.md` in `packages/workspace-do` from
`04-workspace-do-spec.md` §3.1–3.9, with one enabling addition to
`packages/cfour` (`deleteWorkspace`). The WorkspaceDO RPC surface and its
durable backing are now complete and covered by tests.

## Enabler: `packages/cfour` — `deleteWorkspace(name)`

New instance method + static forwarder. Removes the workspace's
`_workspaces`/`_claims`/`_relationshipProposals` entries and **only its own**
`_branchBase` row (derived branches and their lineage are deliberately left
intact — WorkspaceDO enforces the "refuse to delete a branch parent" guard).
Emits **no events**: WorkspaceDO broadcasts its own synthesized
`{ op: "delete" }` event, which has no `elementId` by design.

The first implementation cascaded the branch-lineage deletion; that was
reverted after test failures because the spec expects derived branches to
survive.

## WorkspaceDO additions (`packages/workspace-do/src/index.ts`)

- **Schema**: `views` table (`workspace_name`, `view_id`, `kind`, `title`,
  `description`, `scope_id`, `data`, `updated_at`, PK `(workspace_name,
  view_id)`) and `events` table (`seq INTEGER PRIMARY KEY AUTOINCREMENT`,
  `workspace_name`, `op`, `element_id`, `element_kind`, `payload`,
  `timestamp`) + `idx_events_ws_op_ts`.
- **3.1 Views**: `restoreViews` on hydrate; View events upserted in `persist`;
  `getSystemContextView`/`getContainerView`/`getComponentView`/`getCodeView`/
  `getTeamView`/`getFlowView`/`getFlowCatalog`/`getLegend` (flat `saveView`
  `data` objects), `saveView`, `updateViewPosition`; `reset` now also clears
  `views` + `branch_base` rows.
- **3.2 Event log**: every event is `appendEvent`-ed to `events` first (stamping
  `Date.now()` when the cfour event carries no timestamp — cfour listeners see
  the un-stamped event). `queryEvents` (CfourEventQuery filters: workspaceName,
  op, elementId, elementKind, since, until, limit 100, offset). `setEventLogMax`
  (`rows > 0 ? rows : null`) with `pruneEvents` keeping the newest N by seq.
  `deserializeEvent` reconstructs `Set` payloads (`pendingApprovals` →
  proposal, `elementIds`/`relationshipIds` → claim).
- **3.3 Listing**: `listWorkspaces` / `listBranches` read the SQLite tables
  (survive restart, unlike `getWorkspaceNames()`).
- **3.4 Delete**: `deleteWorkspace` (refuses when it is a branch parent,
  `/parent of an existing branch/`; deletes every table row; clears memory;
  broadcasts `{ op: "delete" }`). `deleteBranch` (leaf-only, refuses derived
  branches and workspaces with no recorded base revision —
  `/no recorded base revision/`).
- **3.5 WebSocket subscriptions**: `fetch` resolves the editor via
  `resolveEditor` (`X-Editor-Id` header, fallback `"anonymous"`). Messages
  `{ type: "subscribe", workspaceName?, since? }` → active + workspace filter,
  replying `{ type: "replay", events }` (when `since`) or
  `{ type: "snapshot", workspaceName, workspace }` (hydrating first);
  `{ type: "unsubscribe" }` → active=false. Never-subscribed sockets keep the
  legacy all-workspaces stream; `broadcast` filters per-socket
  (`skip if sub && !sub.active`, `skip if sub?.workspaceName && mismatch`).
  `webSocketClose` removes the socket.
- **3.6 `applyBatch`**: wraps cfour `applyOperations` inside `mutate` — atomic,
  claim-enforced per op, persisted on success, zero rows/events on rollback.
- **3.7 Thin query RPCs**: `findNodes`, `findRelationships`, `getSelection`,
  `getSubtree`, `getAncestors` (root-first path), `getDescendants` (leaves
  first), `lint`, `validate`, `diff`, `releaseAllClaimsFor`, `getClaimFor`.
- **3.8 `resolveEditor`**: `protected` so a subclass can expose it; header →
  value, missing → `"anonymous"`.
- **3.9 Alarm**: collects distinct `workspace_name`s from **both** the `claims`
  and `relationship_proposals` tables (not just in-memory names, which would
  skip unhydrated workspaces after a restart), runs `expireStaleClaims` +
  `expireStaleProposals`, and deletes expired proposal rows from SQLite
  directly (`proposal_pending_approvals` + `relationship_proposals`) because
  `expireStaleProposals` emits no events (see Phase 2 notes). Reschedules
  `ALARM_INTERVAL_MS`.

## Design decisions

- `setEventLogMax(0)` means "pruning off", not "empty the log".
- The `delete` event has no `elementId`; WS consumers should key off
  `op === "delete"`.
- Lazily creating a workspace broadcasts its `reset` event (cfour behavior) —
  the filtered-broadcast test accounts for it.
- `queryEventsSync`/`hydrate` are synchronous so `webSocketMessage`/`replySubscription`
  can stay sync (no `await` inside the message handler).

## Verification

- `packages/cfour`: `vp check` clean, `vp pack` clean, 140 tests pass
  (137 + 3 deleteWorkspace).
- `packages/workspace-do`: `vp check` clean, 40 tests pass (18 + 22 new).
- Full workspace: `vp test` → 41 files, **1076 tests pass** (1051 + 25).
- `packages/gen-diesel`: `vp check` clean (dist rebuilt against cfour's new
  `deleteWorkspace` types).
- Note: cfour `vp pack` emits gen-diesel dist that is not oxfmt-clean
  (pre-existing toolchain behavior, dist gitignored); `vp fmt --write dist/`
  after packing keeps `vp check` green locally.
