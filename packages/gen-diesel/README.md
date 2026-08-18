# @nowarelabs/gen-diesel

The **generative DSL / codegen** package. It owns the contract between the C4 architecture model (`@nowarelabs/cfour`) and generated code: generators, manifests, plan/apply, extractors, drift reports, and diagram rendering.

The core entry imports **no node builtins** and runs on Cloudflare Workers. File IO is abstracted behind the `CodebaseFs` interface; a node adapter ships behind `@nowarelabs/gen-diesel/node`.

## How it works

`gen-diesel` sits between the architecture model and the filesystem:

1. **Register generators** — one per C4 element kind (optionally narrowed by technology or stereotype).
2. **`planAndApply`** — validates "desired", diffs against "applied", regenerates touched nodes in dependency order, and commits on success.
3. **Drift detection** — compares manifest hashes against disk to find hand-edited files.
4. **Extractors** — reverse direction: read a source tree and produce a C4 workspace.
5. **Report drift** — combines file-level hash checks with the model diff into a structured report.
6. **Diagram renderers** — pure functions that render Mermaid or PlantUML markup from a workspace.
7. **Template packs** — bundled generator sets for common stacks.

## Usage Reference

### Plan and apply

```ts
import { createDiesel } from "@nowarelabs/gen-diesel";
import { createNodeCodebaseFs } from "@nowarelabs/gen-diesel/node";
import { BaseCfour } from "@nowarelabs/cfour";

const cfour = BaseCfour.getDefault();
const diesel = createDiesel(cfour);
const fs = createNodeCodebaseFs("/path/to/project");

// Register a generator
diesel.registerGenerator("Component:React", async (ctx) => {
  const path = `src/components/${ctx.node.id}.tsx`;
  const content = `export function ${ctx.node.name}() { return null; }`;
  // ...write file...
  return { filesWritten: [path], filesDeleted: [] };
});

// Run the pipeline
const manifest = await diesel.planAndApply(fs, {});
```

### Extract a workspace from source

```ts
import { createStubExtractor, extractWorkspace } from "@nowarelabs/gen-diesel";
import { createNodeCodebaseFs } from "@nowarelabs/gen-diesel/node";

const fs = createNodeCodebaseFs("/path/to/project");
const ws = await extractWorkspace(fs, createStubExtractor(), {
  workspaceName: "my-project",
});
```

### Report drift

```ts
const report = await diesel.reportDrift(fs, manifest);
console.log(report.driftedFiles); // Map<elementId, filePath[]>
console.log(report.modelDiff);    // C4WorkspaceDiff
```

### Render diagrams

```ts
import { renderMermaid, renderPlantUml, writeDiagram } from "@nowarelabs/gen-diesel";

const ws = cfour.getWorkspace();
await writeDiagram(renderMermaid(ws), "docs/architecture.mmd", fs);
await writeDiagram(renderPlantUml(ws), "docs/architecture.puml", fs);
```

### Template packs

```ts
import { createReactNodePack } from "@nowarelabs/gen-diesel";

createReactNodePack().register(diesel);
// Now "Component:React" and "Container:node" generators are available
```

## Exports

| Export | Description |
|---|---|
| `createDiesel(cfour)` | Binds the pipeline to a cfour model instance |
| `defaultDiesel` | Diesel bound to cfour's shared default instance |
| `planAndApply(cfour, fs, manifest, opts?)` | Full validate → diff → generate → commit pipeline |
| `topoOrderForApply(cfour, diff, workspace?)` | Touched nodes in dependency order |
| `registerGenerator(key, gen)` | Register a generator for a C4 element kind |
| `resolveGenerator(node)` | Resolve the most specific generator for a node |
| `deriveRelationshipId(src, dst, label)` | Stable, injective relationship id (async sha256) |
| `detectDrift(fs, entry)` | Paths whose on-disk hash drifted from manifest |
| `reportDrift(cfour, fs, manifest)` | Structured drift report (files + model diff) |
| `hashFile(fs, path)` | SHA-256 hex digest of a file |
| `unlinkIfExists(fs, path)` | Best-effort file delete |
| `extractWorkspace(fs, extractor, opts?)` | Reverse: source tree → C4 workspace |
| `createStubExtractor()` | Heuristic stub extractor for demos/testing |
| `renderMermaid(workspace)` | Mermaid C4 diagram markup string |
| `renderPlantUml(workspace)` | PlantUML component diagram markup string |
| `writeDiagram(content, path, fs)` | Write diagram string to disk |
| `createReactNodePack()` | Minimal React + Node template pack |
| `register(cfour, config, className?)` | DSL: register a component/code element |
| `addBuildingBlock(cfour, id, name, ...)` | DSL: register a framework building block |
| `resetGenerators()` | Clear the shared generator registry (test helper) |
| `assertGeneratorIsPure(fs, gen, ctx)` | Verify a generator satisfies the purity contract |
| `createNodeCodebaseFs(root?)` | Node adapter for `CodebaseFs` (subpath `gen-diesel/node`) |

## Development

```sh
vp install
vp test          # run tests
vp pack          # build dist
vp check         # lint + format + typecheck
```
