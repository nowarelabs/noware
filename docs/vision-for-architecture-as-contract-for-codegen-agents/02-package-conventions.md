# 02 — Package Conventions

Every package in this repo follows the same scaffold. New packages (`gen-diesel`,
`agents`, `merge-review`) must match it exactly. Reference implementations:
`packages/result` (pure lib), `packages/workspace-do` (workers/DO lib).

## Layout

```
packages/<name>/
  package.json
  tsconfig.json
  vite.config.ts
  src/index.ts            (single entry; multi-file src is allowed, index re-exports)
  tests/index.test.ts     (single test file; helpers may live in the same file)
  README.md
```

## `package.json`

- Name: `@nowarelabs/<name>`.
- Scripts (identical everywhere):
  ```json
  "scripts": {
    "build": "vp pack",
    "dev": "vp pack --watch",
    "test": "vp test",
    "check": "vp check",
    "prepublishOnly": "vp run build"
  }
  ```
- `"type": "module"`, `"exports": { ".": "./dist/index.mjs", "./package.json": "./package.json" }`,
  `"files": ["dist"]`, `"publishConfig": { "access": "public" }`.
- Dev deps (all packages): `@types/node`, `@typescript/native-preview`, `bumpp`, `typescript`,
  `vite-plus`.
- Runtime deps: `"workspace:*"` refs to internal packages only (e.g.
  `"@nowarelabs/shared": "workspace:*"`). No external runtime deps unless unavoidable.

## `tsconfig.json`

Two variants, both strict (`target: esnext`, `lib: ["es2023"]`, `module: nodenext`,
`moduleResolution: nodenext`, `strict`, `noUnusedLocals`, `declaration`, `noEmit`,
`allowImportingTsExtensions`, `esModuleInterop`, `isolatedModules`, `verbatimModuleSyntax`,
`skipLibCheck`). The **only** difference is `types`:

- **Workers-safe packages** (workspace-do, and new packages' cores): `"types": ["@cloudflare/workers-types"]`.
  This is what guarantees the code compiles only against Worker-available globals
  (`crypto`, `Response`, …) and forbids node-only globals (`process`, `Buffer`) from leaking
  into `src/`.
- **Pure/other packages** (result, shared): `"types": ["node"]`.

cfour changes from `"types": ["node"]` → `"types": ["@cloudflare/workers-types"]` in
Phase 1 (after the node imports are gone).

## `vite.config.ts`

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: { dts: { tsgo: true }, exports: true },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: {},
});
```

## Testing

- `tests/index.test.ts`, imports from `"vite-plus/test"` and `"../src/index.ts"`.
- Helpers live in the same file (workspace-do merged `helpers.ts` into its test file).
- Run with the package's own binary, from the package dir:
  `/Users/vanceworks/Code/nomo/packages/<name>/node_modules/.bin/vp check|test|fmt|pack`.
- Do NOT run `vp fmt`/`vp test` from the monorepo root with another package's binary — it
  reformats the whole workspace (collateral churn).

## Cloudflare runtime rule (hard)

- `src/` must import **no node builtins** (`node:*`), and must not rely on node-only globals.
- Web Crypto replaces `node:crypto`: use the global `crypto.randomUUID()` /
  `crypto.subtle.digest()` (available on Workers and Node ≥ 19). `crypto.subtle.digest` is
  async — design for that.
- Node-only adapters go behind a subpath export, e.g. `@nowarelabs/gen-diesel/node`. The main
  entry stays pure. `@types/node` remains a devDep so explicit `node:*` imports in *tests* and
  *adapter subpaths* typecheck even when `"node"` is not in `types` (types array only controls
  ambient globals; explicit imports still resolve).
- Verify with: `grep -rn "node:" <pkg>/src` must be empty, plus `vp check`.

## README

Follow the style of the richer packages (`telemetry`): title, one-paragraph intro, "How it
works", "Usage Reference" with code blocks, "Exports" table, "Development" (`vp install`,
`vp test`, `vp pack`, `vp check`).
