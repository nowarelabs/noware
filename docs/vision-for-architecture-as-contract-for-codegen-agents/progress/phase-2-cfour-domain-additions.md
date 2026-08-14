# Phase 2 — cfour domain additions (done)

Implements Phase 2 of `08-ordered-work.md`: pure-domain additions to
`packages/cfour` from `03-cfour-spec.md` §2.1–2.5 plus `restoreViews` and the
`CfourOperation` / batch executor helper. All changes are additive — the public
API of the previous phase is unchanged.

## What was added (`packages/cfour/src/index.ts`)

- **`planMerge` → `claimBlockers`** (03.2.1). `C4MergePlan` now carries
  `claimBlockers: { elementId; holderEditorId }[]`, computed over the branch's
  touched element ids: any id that is claimed in the target workspace (by a
  non-`REGISTER_EDITOR`) and would be changed by the merge is reported, whether
  or not it is also a textual conflict. Independent of `conflicts`.
- **Proposal TTL** (03.2.2). `C4RelationshipProposal` gained `createdAt`.
  `setProposalTtl(ms, workspaceName?)` sets the instance default and supports a
  per-workspace override (mirroring claims). `expireStaleProposals(workspaceName?,
  maxAgeMs?)` deletes stale proposals and returns their ids.
- **Structured conflict resolution** (03.2.3). `C4MergeResolution` is a new
  exported `{ id: string; take: "branch" | "target" }`. `resolveMerge(plan,
  resolutions)` returns a copy of the plan with `conflicts: []` and
  `resolutions` embedded; `applyMerge` then filters the effective diff through
  the resolutions (ids resolved `take: "target"` are dropped). Throws on a
  conflict left unresolved (`no resolution`) and on an id that is not a
  conflict (`not a conflict`).
- **Per-workspace claim TTL override** (03.2.4). `setClaimTtl(ms, workspaceName?)`
  — same instance-default + per-workspace override pattern. `reset()` clears the
  override maps and the instance defaults (both TTLs default to 5 minutes).
- **View events** (03.2.5). `saveView` (add/update) and `updateViewPosition`
  (update) now emit `elementKind: "View"` with the full view payload in
  `after`. `CfourChangeEvent`/`CfourEventQuery` widened accordingly
  (`C4ElementKind | "Relationship" | "View"`).
- **`restoreViews(views, workspaceName)`** (Phase 3.1 consumer). Replaces
  `workspace.views` with shallow copies (no aliasing); emits no events, like
  `restoreClaims`.
- **`CfourOperation` + `applyOperations`** (Phase 3.6 consumer). Tuple-arg
  opcode union covering every mutation (add/update/remove for elements and
  relationships). `applyOperations(ops, workspaceName, editorId)` runs the batch
  inside `this.batch(...)` — atomic: any failure rolls back the whole batch and
  rethrows; dispatches to the public mutators so claim enforcement applies per
  op. `removeRelationship(id, workspaceName, editorId)` became a public,
  claim-enforced mutator (replaces the old `_removeRelationship`, which was
  deleted).

## Design decisions & discrepancies (for later phases)

- **`expireStaleProposals` emits NO events** — the spec says so explicitly and
  claims it matches the claims precedent, but `expireStaleClaims` actually emits
  `"release"` events. We followed the spec literally. Phase 3.9 (alarm) must
  therefore handle DB cleanup of expired proposal rows itself rather than by
  replaying events.
- `resolveMerge` does not pre-filter `branchChanges`; filtering happens in
  `applyMerge` via a private `_withResolutions` helper, so the plan object stays
  a faithful record of what the branch wanted.
- `applyMerge` now routes relationship removals through the public
  `removeRelationship` mutator (claim-enforced) instead of a private call.

## Verification

- `grep -rn "node:" packages/cfour/src` → empty (no builtin imports).
- `packages/cfour`: `vp check` clean, `vp pack` clean, 137 tests pass
  (121 baseline + 16 new).
- `packages/gen-diesel`: `vp check` clean, 137 + 18 = 155 across the two
  packages; dist rebuilt against the new cfour types.
- Full workspace: `vp test` → 41 files, 1051 tests pass (1035 + 16 new).
- `packages/cfour/src/example.ts` still runs under
  `node --experimental-strip-types`.
- Note: `vp pack` emits dist that is not oxfmt-clean in gen-diesel (pre-existing
  toolchain behavior, dist is gitignored); `vp fmt --write dist/` after packing
  keeps `vp check` green locally.
