// ============================================================
// Example — the plan/apply codegen pipeline
// ============================================================
// The C4 workspace is the single source of truth for generated code.
// This demo: load a model into the "desired" workspace, register pure
// generators, run planAndApply through a node CodebaseFs, verify
// idempotence, then clean up. Nothing outside the pipeline writes files.

/// <reference types="node" />

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseCfour, type C4Workspace } from "@nowarelabs/cfour";
import { defaultDiesel } from "../src/index.ts";
import { createNodeCodebaseFs } from "../src/node.ts";

const workspace: C4Workspace = {
  name: "Online Banking System",
  description: "Allows customers to view account balances and make payments.",
  people: [],
  softwareSystems: [
    {
      id: "banking-system",
      kind: "SoftwareSystem",
      name: "Internet Banking System",
      description: "Allows customers to view account info and make payments.",
      containers: [
        {
          id: "api",
          kind: "Container",
          systemId: "banking-system",
          name: "API Application",
          description: "Provides internet banking via a JSON/HTTPS API.",
          technology: "Java / Spring Boot",
          components: [
            {
              id: "accounts-controller",
              kind: "Component",
              containerId: "api",
              name: "Accounts Controller",
              description: "Exposes account summary endpoints.",
              technology: "Spring MVC @RestController",
            },
          ],
        },
        {
          id: "db",
          kind: "Container",
          systemId: "banking-system",
          name: "Database",
          description: "Stores user credentials, audit logs, and account data.",
          technology: "Oracle 12c",
        },
      ],
    },
  ],
  relationships: [],
};

const generatedDir = await mkdtemp(join(tmpdir(), "gen-diesel-example-"));
console.log(`[planAndApply] writing generated files under ${generatedDir}`);

// The default Diesel is bound to cfour's shared default instance — the same
// instance the BaseCfour.* static facade delegates to. Use createDiesel(cfour)
// with an explicit instance when you need isolation.
const diesel = defaultDiesel;

// Load the example model into the "desired" workspace (the editable one).
BaseCfour.import(JSON.stringify(workspace), "desired");

// A pure generator: the same context always yields byte-identical output.
// No Date.now(), no Math.random(), no ambient reads inside the body —
// determinism is what makes re-apply idempotent.
diesel.registerGenerator("Container:Java / Spring Boot", async (ctx) => {
  const file = join(generatedDir, `${ctx.node.id}.java`);
  const header = ctx.ancestors.map((a) => `// depends-on: ${a.name}`).join("\n");
  const className = ctx.node.name.replace(/\s+/g, "");
  await writeFile(
    file,
    ["// GENERATED — do not edit.", header, `public final class ${className} {}`, ""].join("\n"),
  );
  return { filesWritten: [file], filesDeleted: [] };
});

// Deterministic ids: re-deriving a relationship id always yields the same
// value, so regenerating the same logical edge never duplicates it.
console.log(
  `[planAndApply] relationship id: ${await diesel.deriveRelationshipId(
    "api",
    "db",
    "Reads from and writes to",
  )}`,
);

// Plan + apply: validate, diff "applied" vs "desired", generate in
// dependency (topological) order, then promote "desired" to "applied".
const fs = createNodeCodebaseFs();
const manifest = await diesel.planAndApply(fs, {});
console.log(`[planAndApply] manifest entries: ${Object.keys(manifest).length}`);

// Idempotence: a second run with no mutations writes nothing new.
const secondManifest = await diesel.planAndApply(fs, manifest);
console.log(
  `[planAndApply] second apply is a no-op: ${
    JSON.stringify(secondManifest) === JSON.stringify(manifest)
  }`,
);

// Dev-only purity self-check for generator authors and tests.
const apiContainer = BaseCfour.findNodes({ technology: "Spring Boot" }, "desired").find(
  (n) => n.kind === "Container",
)!;
const resolvedGen = diesel.resolveGenerator(apiContainer)!;
await diesel.assertGeneratorIsPure(fs, resolvedGen, {
  node: apiContainer,
  ancestors: BaseCfour.getAncestors(apiContainer.id, "desired"),
  relationships: BaseCfour.findRelationships({ sourceId: apiContainer.id }, "desired"),
});
console.log("[planAndApply] generator purity: verified");

// Clean up the demo's generated files.
await rm(generatedDir, { recursive: true, force: true });
