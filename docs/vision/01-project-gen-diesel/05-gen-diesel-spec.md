# 05 — gen-diesel Spec

`@nowarelabs/gen-diesel` — the **generative DSL / codegen** package. It owns the contract
between the architecture model and generated code: generators, manifests, plan/apply,
extractors, drift reports, and docs/diagram rendering. It composes cfour; it never runs
inside the DO (the DO only serves the model).

New package, scaffolded per `02-package-conventions.md`.

## Why "diesel"

The DSL registers generators and a plan/apply pipeline. The cfour doc-comment described the
two-workspace convention (`"desired"` editable vs `"applied"` snapshot). That whole pipeline
is "architecture-as-contract" — exactly what we want agents to run host-side. The name pairs
with cfour (the model) as the "engine."

## What moves in (Phase 1, wholesale from cfour)

- Pure functions over cfour types: `registerGenerator`, `resolveGenerator`,
  `topoOrderForApply`, `planAndApply`, `deriveRelationshipId`, `detectDrift`, `hashFile`,
  `unlinkIfExists`.
- DSL registration: `register`, `addBuildingBlock`.
- Types: `Generator`, `GeneratorContext`, `GeneratorResult`, `ManifestEntry`,
  `GenerationManifest`, `ApplyOptions`.
- The shared `_generators` registry (now a module-level registry in gen-diesel, still one per
  process — generators are repo-wide by design).

### API shape

`planAndApply` / `topoOrderForApply` operate on cfour types (`C4Workspace`,
`C4WorkspaceDiff`, `C4Node`) rather than being instance methods:

```ts
export interface Diesel {
  register(config: RegisterConfig, className?: string): void;
  registerGenerator(key: string, gen: Generator): void;
  resolveGenerator(kind: string, options?: ResolveOptions): Generator | undefined;
  deriveRelationshipId(sourceId: string, targetId: string): Promise<string>;
  planAndApply(opts: ApplyOptions): Promise<GenerationManifest>;
  topoOrderForApply(diff: C4WorkspaceDiff, workspaceName: string): string[];
  detectDrift(dir: CodebaseFs, opts: DriftOptions): Promise<DriftReport>;
  hashFile(fs: CodebaseFs, path: string): Promise<string>;
  unlinkIfExists(fs: CodebaseFs, path: string): Promise<void>;
}
export function createDiesel(cfour: BaseCfour): Diesel;
export const defaultDiesel: Diesel; // bound to the default model instance
```

`createDiesel(cfour)` replaces `BaseCfour.registerGenerator(...)` usage; the current static
usage becomes `defaultDiesel.planAndApply(...)`.

### Platform safety (the reason this package exists)

- Core entry (`src/index.ts`) imports **no node builtins** — it runs on Workers.
- **Web Crypto replaces node:crypto.** `deriveRelationshipId` currently does a synchronous
  `createHash("sha256")`; reimplement with `crypto.subtle.digest("SHA-256", ...)` (async,
  already fine since `planAndApply` is async). Document the signature change (sync → async)
  in the migration notes.
- **File IO is abstracted.** `hashFile`/`unlinkIfExists`/`detectDrift`/`planAndApply` take a
  `CodebaseFs` interface instead of using node:fs:

```ts
export interface CodebaseFs {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readDir(path: string): Promise<string[]>;
}
```

- A node adapter ships behind a subpath: `@nowarelabs/gen-diesel/node` exports
  `createNodeCodebaseFs()` (the only place `node:fs` appears). CLI/agents on a host use it;
  Workers hosts can provide an R2-backed adapter.
- `tsconfig` uses `types: ["@cloudflare/workers-types"]` for the core; the node adapter
  file typechecks via explicit `node:*` imports + the `@types/node` devDep (same mechanism
  as workspace-do's `node:sqlite`).

## What gets ADDED later (Phase 4)

- **Extractors** (reverse direction): `Extractor` interface + `extractWorkspace(source:
CodebaseFs, opts)` → returns a cfour `C4Workspace`; TypeScript extractor first
  (components ↔ modules, code elements ↔ exports). Enables onboarding without hand-writing
  the model.
- **Drift reports**: `reportDrift(cfour, fs)` combining `detectDrift` + `diffWorkspaces` into
  a human/agent-readable report (files changed vs model unchanged, etc.).
- **Docs / diagrams**: `renderMermaid(workspace)`, `renderPlantUml(workspace)` (pure
  renderers; `c4ToReactFlow` stays in cfour as the UI adapter).
- **Template packs**: bundled generator sets for common stacks, so agents get a sane default
  codegen contract out of the box.

## Acceptance criteria (Phase 1 + 4)

- Phase 1: moved tests pass (all generator/Dsl test blocks from cfour), example updated,
  `grep -rn "node:" packages/gen-diesel/src` empty except `node/` subpath, `vp check` + `vp
pack` clean, and cfour is node-free afterward.
- Phase 4: extractor round-trip tests (source → model → generator output), drift tests,
  renderer golden tests.
