# 08 — Ordered Work

The implementation plan. Future sessions execute phases **in order**. Every phase ends with
`vp check` + `vp test` green and no node builtins in `src/`. Do not merge a phase that
breaks a baseline (cfour 139 tests, workspace-do 18 tests, full-workspace 1034).

Regression strategy throughout: **tests move with code, never get deleted.** Any behavior
covered today stays covered somewhere after the move. Before/after each phase, run
`packages/<name>/node_modules/.bin/vp test`.

## Phase 1 — Extract codegen into `@nowarelabs/gen-diesel`

Goal: cfour becomes node-free; no behavior change anywhere; the codegen pipeline lives in a
Workers-safe package.

1. Scaffold `packages/gen-diesel` per `02-package-conventions.md` (pure variant, but with
   `types: ["@cloudflare/workers-types"]`; `@types/node` as devDep for the node adapter).
   Add `@nowarelabs/cfour` + `@nowarelabs/shared` as `workspace:*` deps.
2. Move generator code from `packages/cfour/src/index.ts` to `gen-diesel/src`:
   - `registerGenerator`, `resolveGenerator`, `deriveRelationshipId`, `topoOrderForApply`,
     `planAndApply`, `detectDrift`, `hashFile`, `unlinkIfExists` (~1918–1977, 2006, 2068).
   - `register` (1833), `addBuildingBlock` (1791), the `_generators` registry, static
     `_default` proxies for all of the above (~2290–2710).
   - Types `Generator`, `GeneratorContext`, `GeneratorResult`, `ManifestEntry`,
     `GenerationManifest`, `ApplyOptions` (~3106–3145).
   - Refactor to pure functions over cfour types + `createDiesel(cfour)` / `defaultDiesel`
     (see `05-gen-diesel-spec.md`).
3. `deriveRelationshipId`: swap sync `createHash("sha256")` for `crypto.subtle.digest`
   (async) — update call sites (inside gen-diesel only).
4. Abstract file IO behind `CodebaseFs`; add `@nowarelabs/gen-diesel/node` subpath with
   `createNodeCodebaseFs()` (only place `node:fs` is allowed). Set package exports for the
   subpath.
5. Update cfour: delete the moved block; drop `createHash`/`readFile`/`unlink`; switch
   `randomUUID` (1228, 1361) to global `crypto.randomUUID()`; remove the now-unused
   `node:crypto`/`node:fs/promises` imports; tsconfig `types` → `["@cloudflare/workers-types"]`;
   update the module doc-comment.
6. Move tests: cfour test blocks covering `addBuildingBlock`/`register` (~203–361),
   `registerGenerator`/`planAndApply`/`topoOrderForApply`/`detectDrift` (~2076–2360) move to
   `packages/gen-diesel/tests/index.test.ts`; update imports to gen-diesel. `refreshNode`
   tests stay in cfour.
7. Update `packages/cfour/example.ts` (and any other host code using the old statics) to
   `createDiesel`/`defaultDiesel`.
8. Write gen-diesel `README.md` (move the generator/convention prose from cfour's header).
9. Verify: `grep -rn "node:" packages/cfour/src` → empty; `grep -rn "node:" packages/gen-diesel/src`
   → only `node/index.ts`; both packages `vp check` + `vp pack` clean; all moved + remaining
   tests green; full-workspace test green.

## Phase 2 — cfour domain additions

1. `claimBlockers` on `C4MergePlan` in `planMerge` (03.2.1) + tests.
2. Proposal TTL: `setProposalTtl`, `expireStaleProposals`, `createdAt` (03.2.2) + tests.
3. `resolveMerge(plan, resolutions)` + `applyMerge` accepts resolved plans (03.2.3) + tests.
4. Per-workspace claim TTL override (03.2.4) + tests.
5. View events carry `after`/`elementKind: "View"` (03.2.5) + test that saveView/updateView
   events include the view payload.
6. Add `restoreViews(views, workspaceName)` helper (used by Phase 3.1) + test.
7. Add `CfourOperation` opcode union type (used by Phase 3.6) + a cfour `batch`-compatible
   executor helper (execution itself is workspace-do's job).
8. `vp check` + full test suite green.

## Phase 3 — workspace-do durability + RPC additions

1. Views persistence: `views` table, persist upsert, hydrate restore, view RPCs (04.3.1) +
   tests.
2. Durable event log: `events` table, append-all in persist, `queryEvents`, prune hook
   (04.3.2) + tests.
3. `listWorkspaces` / `listBranches` from tables (04.3.3) + tests.
4. `deleteWorkspace` / `deleteBranch` with branch-lineage guards (04.3.4) + tests.
5. WS subscription/replay/snapshot + filtered broadcast (04.3.5) + tests.
6. `applyBatch` atomic batch executor (04.3.6) + tests.
7. Thin query RPCs: `findNodes`, `findRelationships`, `getSelection`, `getSubtree`,
   `getAncestors`, `getDescendants`, `lint`, `validate`, `diff`,
   `releaseAllClaimsFor`, `getClaimFor` (04.3.7) + tests.
8. `resolveEditor` identity seam on `fetch` (04.3.8) + tests.
9. Alarm: also expire stale proposals (04.3.9) + test.
10. `vp check` + full test suite green.

## Phase 4 — gen-diesel extractors, drift, docs

1. `CodebaseFs`-based `extractWorkspace` + TypeScript `Extractor` (05) + round-trip tests.
2. `reportDrift` combining `detectDrift` + `diffWorkspaces` + tests.
3. `renderMermaid`, `renderPlantUml` renderers + golden tests.
4. Template packs (starter generator sets).
5. README + `vp check` green.

## Phase 5 — `@nowarelabs/agents`

1. Scaffold package per conventions.
2. Session model + branch-per-task resolution (06.1).
3. Lease/claim mapping + heartbeat loop (06.2).
4. Task queue on `jobs` (or workspace-do-hosted) (06.3).
5. `reconcile` for expired leases / orphan branches (06.4).
6. The agent loop contract (06.5) documented in README.
7. Unit tests with fake clock + fake workspace-do client; `vp check` green.

## Phase 6 — `@nowarelabs/merge-review`

1. Scaffold package per conventions.
2. Event consumption: `pollEvents` + `tailEvents` (07.1).
3. Gates: lint / validate / drift / blockers (07.2) + tests.
4. Review/approval objects (07.3) + durable persistence decision (workspace-do tables).
5. Merge policy engine + auto-merge (07.4) + matrix tests.
6. Human-in-the-loop server binding sketch (07.5).
7. `vp check` green.

## Phase 7 — product wiring (integration)

1. Multi-agent factory demo: two agents, two branches, both merged through merge-review.
2. Crash simulation: kill an agent mid-session → lease expires → task requeued → work resumes.
3. Live dashboard: WS snapshot + replay on the generated views + event log tail.
4. Drift demo: change generated code → `reportDrift` surfaces it → CI gate flags it.
5. Multi-tenant: per-project DO instantiation wired through the existing gateway/auth
   packages; `resolveEditor` hooked to verified identities.
6. Full-workspace `vp test` green; READMEs updated; commit each phase's work.

## Definition of done for the whole program

- cfour: pure domain, node-free, `types: ["@cloudflare/workers-types"]`, tests ≥ baseline.
- workspace-do: all Phase 3 additions live behind hydrate-first, claim-safe, broadcast-aware
  RPCs.
- gen-diesel / agents / merge-review: Workers-safe cores, node-only adapters on subpaths.
- Every product in `01-motivation.md` has an owning package and an acceptance path.
