# Phase 4 — gen-diesel extractors, drift, docs (done)

Implements Phase 4 of `08-ordered-work.md` in `packages/gen-diesel`: extractors,
structured drift reports, diagram renderers, a template pack, and a README. All
additions are additive — the existing Phase 1 API is unchanged.

## What was added (`packages/gen-diesel/src/index.ts`)

- **Extractors** (reverse direction): `Extractor` interface
  (`{ extract(source, opts?) }`), `extractWorkspace` convenience wrapper, and
  `createStubExtractor()` — a heuristic stub that reads a root directory via
  `CodebaseFs`, maps subdirectories to `SoftwareSystem`s with one `Container`
  each, and `.ts`/`.js` files at root to `Component`s under a `"root"` system.
  Ignores dotfiles and `node_modules`. `ExtractOpts` carries
  `workspaceName`/`workspaceDescription`.
- **`reportDrift`**: `DriftReport` interface (`driftedFiles: Map<string,
  string[]>`, `modelDiff: C4WorkspaceDiff`, `orphans: string[]`) and
  `reportDrift(cfour, fs, manifest)` combining per-node `detectDrift` with
  `cfour.diff("applied", "desired")`. `orphans` is reserved (empty for now).
- **Diagram renderers**: `renderMermaid(workspace)` produces a Mermaid `C4`
  diagram string; `renderPlantUml(workspace)` produces PlantUML component
  diagram markup. Both map SoftwareSystems → Systems, Containers → Containers,
  Components → Components, Relationships → Rel edges.
  `writeDiagram(content, path, fs)` writes a diagram string to disk via
  `CodebaseFs`.
- **Template packs**: `TemplatePack` interface (`{ name, register(diesel) }`)
  and `createReactNodePack()` — a minimal demo pack registering stub generators
  for `"Component:React"` and `"Container:node"` that return placeholder file
  paths without writing to disk.

## Node adapter change (`packages/gen-diesel/src/node.ts`)

- `createNodeCodebaseFs(root?)` now accepts an optional `root` path. When
  provided, all relative paths are resolved against it (e.g. `"."` maps to
  `root`). When omitted, paths resolve against the process working directory.
  This is used by extractor tests rooted at a temp directory. `node:path` added
  as an import.

## Diesel interface additions

The `Diesel` interface and `createDiesel` gained: `reportDrift(fs, manifest)`,
`renderMermaid(workspace)`, `renderPlantUml(workspace)`.

## Tests added

| Describe block | Tests | What's covered |
|---|---|---|
| Extractor round-trip | 1 | Stub extractor maps directories to systems, ignores non-source files |
| reportDrift | 3 | No drift → empty; hand-edited file → driftedFiles; model changed → modelDiff |
| renderMermaid | 2 | Systems/containers/components/rel render; empty workspace renders minimal diagram |
| renderPlantUml | 2 | Systems/containers/rel render with PlantUML syntax; empty workspace renders valid wrapper |
| writeDiagram | 1 | Writes string to disk via CodebaseFs |
| Template pack | 1 | `createReactNodePack` registers generators that resolve to correct file paths |

## Verification

- `packages/gen-diesel`: `vp check` clean, `vp pack` clean (dist formatted), 28 tests pass
  (18 baseline + 10 new).
- Full workspace: `vp test` → 41 files, **1086 tests pass** (1076 + 10 new).
- `grep -rn "node:" packages/gen-diesel/src` → only `src/node.ts` (node adapter).
- `packages/gen-diesel/README.md` written with usage reference and exports table.
- Note: `vp pack` emits dist that is not oxfmt-clean (pre-existing toolchain
  behavior, dist is gitignored); `vp fmt --write dist/` after packing keeps
  `vp check` green locally.
