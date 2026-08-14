# 03 — cfour Spec

`packages/cfour/src/index.ts` — the pure C4 domain kernel. After Phase 1 it must have
**zero node imports** and run anywhere (Workers, Node, tests).

## What STAYS (unchanged, minus generator removal)

- Model CRUD: `addSoftwareSystem`, `addPerson`, `addContainer`, `addComponent`,
  `addCodeElement`, `addRelationship`, `updateElement`, `updateRelationship`,
  `removeElement`, `removeRelationship`.
- Collaboration: `claim`, `release`, `releaseAllClaimsFor`, `getClaimFor`, `touchClaim`,
  `expireStaleClaims`, `proposeRelationship`, `acceptRelationship`, `rejectProposal`,
  `getProposals`.
- Branching/merge: `createBranch`, `planMerge`, `applyMerge`, `diff`,
  `C4MergePlan` (with `conflicts`/`suggestions`), `C4WorkspaceDiff`.
- Analysis: `lint`, `validate`, `findNodes`, `findRelationships`, `getSelection`,
  `getSubtree`, `getAncestors`, `getDescendants`.
- Views: `saveView`, `getSystemContextView`, `getContainerView`, `getComponentView`,
  `getCodeView`, `getTeamView`, `getFlowView`, `getFlowCatalog`, `getLegend`,
  `updateViewPosition`.
- Helpers: `flattenWorkspace`, `c4ToReactFlow`, `diffWorkspaces`, view builders.
- `refreshNode` (thin alias of `updateElement`, line 560) — stays.
- `REGISTER_EDITOR = "__system__"` reserved id, row serialization, event subscription
  (`_subscribers`, `subscribe`, events with `snapshotBefore`/`after`).

## What MOVES OUT to `@nowarelabs/gen-diesel` (Phase 1)

The whole "generator / DSL / plan-apply" block plus the node-only helpers:

- Instance methods: `registerGenerator` (~1918), `resolveGenerator` (~1927),
  `deriveRelationshipId` (~1949), `topoOrderForApply` (~2006), `planAndApply` (~2068),
  `detectDrift`, `hashFile`, `unlinkIfExists` (~1966–1977).
- DSL registration: `register` (1833), `addBuildingBlock` (1791) — these mutate the model,
  but they are DSL conveniences for codegen workflows, not core model semantics; they move
  with the DSL layer.
- Types: `Generator`, `GeneratorContext`, `GeneratorResult`, `ManifestEntry`,
  `GenerationManifest`, `ApplyOptions` (~3106–3145).
- Static `_default` proxies (~2290–2710) for all of the above.
- The static shared `_generators: Map<string, Generator>` registry.

**This is the entire consumer of `node:fs`/`node:crypto`** (except `randomUUID`). Removing it
lets cfour drop both imports.

## What gets FIXED in Phase 1 (same change, no behavior change)

- Replace `import { randomUUID } from "node:crypto"` with the Workers-safe global
  `crypto.randomUUID()` (used for claim ids at 1228 and proposal ids at 1361). Note:
  cfour currently imports `createHash, randomUUID` together; only the `randomUUID` usage
  survives the move, and it switches to the global.
- tsconfig `types: ["node"]` → `["@cloudflare/workers-types"]`.
- Remove the cfour doc-comment that still says generators live here; move that paragraph to
  the gen-diesel package docs.

## What gets ADDED (Phase 2, pure domain only)

### 2.1 `claimBlockers` on `C4MergePlan`

`planMerge` computes, for every id in the branch changes (added/modified/removed nodes and
relationships), which ones are currently claimed by another editor in the **target**
workspace (`into`). Add to `C4MergePlan`:

```ts
claimBlockers: { elementId: string; holderEditorId: string }[];
```

Must mirror `applyMerge`'s claim enforcement exactly (check `getClaimFor` on `into` for each
id the plan touches). Rationale: lets the UI/agent see *before* merging who would block the
merge. Keep `applyMerge` still throwing on races (the check is authoritative); `claimBlockers`
is advisory.

Tests: blocker reported for a claimed target element; no blocker when target id unclaimed;
blockers don't fire for ids claimed by REGISTER_EDITOR (impossible — system never claims);
blockers independent of `conflicts`.

### 2.2 Proposal TTL

`setProposalTtl(ms)`, `expireStaleProposals(workspaceName?, maxAgeMs?)` returning expired
proposal ids, plus `createdAt` on proposals. Mirror the claims TTL pattern
(`setClaimTtl`/`expireStaleClaims`), including *not* emitting events for expiry (matching the
claims precedent — the DO's alarm sweep owns persistence-side cleanup).

### 2.3 Structured conflict resolution

```ts
resolveMerge(plan: C4MergePlan, resolutions: { id: string; take: "branch" | "target" }[]): C4MergePlan
```

Returns a plan with `conflicts` cleared and the resolutions embedded so `applyMerge` can apply
it without re-planning: `take: "branch"` applies the branch-side version, `take: "target"`
keeps the target-side version. Throws on an unknown/unresolved conflict id. `applyMerge`
accepts a fully-resolved plan (`resolutions` covers every `conflict.id`).

Tests: resolve each conflict with branch/target mixes; unresolved conflict id throws; applying
a resolved plan yields the expected final workspace; merge events still fire per mutation.

### 2.4 Per-workspace claim TTL

`setClaimTtl(ms, workspaceName?)` — per-workspace override map; when present it wins over the
instance default inside `expireStaleClaims`. Tests: override applied only in that workspace;
instance default used elsewhere.

### 2.5 View events carry `after` (enabler for workspace-do view persistence)

View save/update events currently lose the new view state in the DO (`persist()` drops events
with no `after`). Emit the view payload on `saveView`/`updateViewPosition` events
(`after` = serialized view, `elementKind: "View"`) so workspace-do can upsert a `views` table.

## Acceptance criteria (Phase 1 + 2)

- `grep -rn "node:" packages/cfour/src` → empty.
- `vp check` clean under `types: ["@cloudflare/workers-types"]`.
- All cfour tests that stay pass; moved tests pass in gen-diesel; full-workspace `vp test`
  green (baseline 1034).
- Public API of everything that stays is unchanged (no renames, no signature drift).
- `example.ts` updated to the new gen-diesel usage and still runs.
