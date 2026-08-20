# Phase 1 — Extract codegen into `@nowarelabs/gen-diesel` (done)

Implements Phase 1 of `08-ordered-work.md`. cfour is now node-free; the codegen
pipeline lives in a Workers-safe package with a node-only adapter behind a
subpath.

## Package: `@nowarelabs/gen-diesel`

- `src/index.ts` — Workers-safe core (no `node:` imports):
  - `CodebaseFs` interface: `readFile` / `writeFile` / `deleteFile` / `exists` /
    `readDir` (byte-oriented, `Uint8Array`).
  - Registry + `registerGenerator` / `resolveGenerator` / `resetGenerators`,
    `CONTAINER_KINDS` / `CODE_ELEMENT_KINDS` / `getTechnology`, `REGISTER_EDITOR`.
  - `addBuildingBlock` (auto-creates the framework `SoftwareSystem`, guards
    duplicate containers), `register` (id = `config.id ?? className ??
"RegisteredElement"`).
  - Async `deriveRelationshipId` via `crypto.subtle.digest` (sha-256, `slice(0,8)`),
    slugified label — call sites are inside gen-diesel only.
  - `hashFile`, `unlinkIfExists`, `detectDrift`, `topoOrderForApply` (cycles →
    throws naming the chain), `assertGeneratorIsPure` (re-runs generator on an
    empty temp dir, byte-compares), `planAndApply` (validate → lint warn →
    diff → removals → topo generation → promote `desired` to `applied`).
  - `Diesel` interface + `createDiesel(cfour)` + `defaultDiesel` (bound to
    `BaseCfour.getDefault()`).
- `src/node.ts` — `createNodeCodebaseFs()`; the ONLY file in either package's
  `src/` that imports `node:*`. `deleteFile` swallows `ENOENT`. Uses a
  `/// <reference types="node" />` so the core stays workers-typed.
- `tests/index.test.ts` — the 18 moved tests (5 DSL/register + 13 pipeline),
  adapted from the recovered original with `defaultDiesel.register(...)` /
  `registerGenerator` on the Diesel instead of `BaseCfour.*` statics.
- `examples/example.ts` — end-to-end plan/apply demo: import model →
  register a pure generator → `deriveRelationshipId` → `planAndApply` (node fs)
  → idempotence no-op check → purity check → cleanup. Runnable with
  `node --experimental-strip-types examples/example.ts`.
- `README.md` — package prose + the generator/convention rules moved out of
  cfour's module header.

## Package: `@nowarelabs/cfour` (cleaned)

- Deleted: the instance generator block (`addBuildingBlock`, `register`,
  `assertGeneratorIsPure`, `_generators` field), the static `_default` proxies,
  and the generator/types block (`Generator`, `GeneratorContext`,
  `GeneratorResult`, `ManifestEntry`, `GenerationManifest`, `ApplyOptions`).
- `randomUUID()` → global `crypto.randomUUID()`; removed `node:crypto` /
  `node:fs/promises` imports; module doc-comment updated.
- Added `static getDefault(): BaseCfour` (additive) so `defaultDiesel` binds to
  the same instance the static facade uses.
- `tsconfig` `types` → `["@cloudflare/workers-types"]` (+ devDep).
- `src/example.ts` stripped of node + section 7 (points at gen-diesel example).
- Tests: removed the 18 moved tests, rewrote 3 fixtures that used
  `addBuildingBlock` as explicit `addSoftwareSystem`/`addContainer`, dropped
  node imports + `afterEach`, removed the orphaned `mulberry32`.

## Verification

| check      | cfour              | gen-diesel                                                    |
| ---------- | ------------------ | ------------------------------------------------------------- |
| `vp check` | clean (0 warnings) | clean                                                         |
| `vp test`  | 121 pass           | 18 pass                                                       |
| `vp pack`  | ok (rebuilt dist)  | emits `index.mjs` + `index.d.mts` + `node.mjs` + `node.d.mts` |

- Test-count invariant preserved: 139 original cfour tests = 121 (cfour) + 18
  (gen-diesel). Tests moved with code, none deleted.
- `grep "node:" packages/cfour/src` → empty; `packages/gen-diesel/src` → only
  `src/node.ts`.
- Full-workspace `vp test`: 1035 pass across 41 files.
- Determinism spot-checks: relationship ids `a--b--wires--5c8ad06e` and
  `a--b--Reads-customer-data--19165a70` (digest prefix of sha-256 via
  `crypto.subtle`), matching the originals; `uses-data` / `uses  data` /
  `Reads!` / `Reads?` all distinct.
- Build note: `vp pack` only bundles entries listed in `pack.entry`; the
  `"./node"` export was missing until `entry: ["src/index.ts", "src/node.ts"]`
  was added to gen-diesel's `pack` config.

## Known follow-ups (not this phase)

- `@nowarelabs/shared` is a declared dep but currently unused (kept per plan).
- Dist is not git-tracked; `@nowarelabs/cfour` must be rebuilt before
  gen-diesel resolves its new types in a fresh checkout.
