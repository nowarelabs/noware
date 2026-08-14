# @nowarelabs/gen-diesel

The codegen (generator) pipeline for the C4 model. Given a "desired" workspace
of [`@nowarelabs/cfour`](https://github.com/nowarelabs/noware) and a set of pure
generators, `planAndApply` derives, plans, and applies a diff — writing files
through a `CodebaseFs` adapter instead of touching the real filesystem.

The C4 workspace is the single source of truth for generated code. Generators
never read the filesystem; they compute output purely from their node's
`GeneratorContext` (the node, its ancestors, and its relationships). The
pipeline diffs `desired` against `applied`, generates in topological
(dependency) order, and promotes `desired` to `applied` only after a successful
apply.

The core entry (`@nowarelabs/gen-diesel`) is Workers-safe and never imports
node builtins. Code that needs a real filesystem lives behind the
`@nowarelabs/gen-diesel/node` subpath.

## How it works

- **Pure generators.** Register a generator for a node key — `"Container:Java / Spring Boot"`,
  `"SoftwareSystem"`, etc. — via `registerGenerator`. Output must be
  deterministic: the same `GeneratorContext` must always yield byte-identical
  files, so re-apply is a no-op. `assertGeneratorIsPure` re-runs the generator
  in an empty temp dir and compares bytes for tests and CI.
- **Deterministic ids.** `deriveRelationshipId(sourceId, targetId, label)`
  slugifies the label and appends a stable sha-256 digest, so the same logical
  edge always produces the same id and regeneration never duplicates it.
- **Plan/apply.** `planAndApply(cfour, fs, options?)` validates, lints, diffs,
  removes files for deleted nodes, runs generators in topological order,
  records every write/delete in a `GenerationManifest`, then promotes. Second
  run with no mutations is a no-op.
- **Convention matching.** Only `"implements"`, `"depends"`, `"wires"`,
  `"uses"`, `"calls"`, and `"part-of"` count as link semantics for child →
  ancestor derivation; anything else is ignored.
- **Register.** `register` installs a component node with an id from its config
  (`config.id ?? className ?? "RegisteredElement"`) and runs generators on
  registered components.

## Usage

```typescript
import { BaseCfour } from "@nowarelabs/cfour";
import { defaultDiesel } from "@nowarelabs/gen-diesel";
import { createNodeCodebaseFs } from "@nowarelabs/gen-diesel/node";

BaseCfour.import(modelJson, "desired");

const fs = createNodeCodebaseFs();

defaultDiesel.registerGenerator("Container:Java / Spring Boot", async (ctx) => {
  const file = `src/${ctx.node.id}.java`;
  await fs.writeFile(file, new TextEncoder().encode(`public final class ...`));
  return { filesWritten: [file], filesDeleted: [] };
});

const manifest = await defaultDiesel.planAndApply(fs, {});
```

`defaultDiesel` is bound to cfour's shared default instance — the same one the
`BaseCfour.*` static facade delegates to. Use `createDiesel(cfour)` with an
explicit `BaseCfour` when you need isolation (e.g. tests).

## Development

- Install dependencies: `vp install`
- Run the unit tests: `vp test`
- Build the library: `vp pack`
- Run the end-to-end example: `node --experimental-strip-types examples/example.ts`
