/// <reference types="node" />

import { describe, expect, test, beforeEach, afterEach } from "vite-plus/test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseCfour, type C4Node, type C4Relationship } from "@nowarelabs/cfour";
import {
  defaultDiesel,
  resetGenerators,
  type Generator,
  type GeneratorContext,
} from "../src/index.ts";
import { createNodeCodebaseFs } from "../src/node.ts";

// ----------------------------------------------------------------
// Moved from packages/cfour/tests/index.test.ts — the generative DSL and
// plan/apply pipeline now live in @nowarelabs/gen-diesel. Tests moved with
// the code (regression strategy: tests move with code, never get deleted).
// ----------------------------------------------------------------

/**
 * Deterministic PRNG (mulberry32) used to drive reproducible property tests:
 * the same seed always yields the same sequence, so a failing property test
 * can be replayed exactly.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("gen-diesel — DSL registration conveniences", () => {
  beforeEach(() => {
    BaseCfour.resetWorkspace(); // Resets "default"
    BaseCfour.getWorkspaceNames().forEach((name) => {
      if (name !== "default") BaseCfour.resetWorkspace(name);
    });
  });

  test("addBuildingBlock should create a framework system and containers", () => {
    BaseCfour.resetWorkspace();
    defaultDiesel.addBuildingBlock("pkg-auth", "Authentication", "Handles login", "TypeScript");

    const ws = BaseCfour.getWorkspace();
    const framework = ws.softwareSystems.find((s) => s.id === "framework");
    expect(framework).toBeDefined();
    expect(framework?.containers![0].id).toBe("pkg-auth");
  });

  test("packages can register themselves as building blocks via static initialization", () => {
    BaseCfour.resetWorkspace();

    // Simulate 'adapters' package registration
    class AdaptersPackage {
      static {
        defaultDiesel.addBuildingBlock(
          "pkg-adapters",
          "Adapters",
          "Infrastructure adapters",
          "TypeScript",
        );
      }
    }
    void AdaptersPackage; // side-effectful static block must still run

    // Simulate 'domains' package registration
    class DomainsPackage {
      static {
        defaultDiesel.addBuildingBlock("pkg-domains", "Domains", "Domain logic", "TypeScript");
      }
    }
    void DomainsPackage; // side-effectful static block must still run

    const ws = BaseCfour.getWorkspace();
    const framework = ws.softwareSystems.find((s) => s.id === "framework");

    expect(framework).toBeDefined();
    expect(framework?.containers?.length).toBe(2);
    const containerIds = framework?.containers?.map((c) => c.id);
    expect(containerIds).toContain("pkg-adapters");
    expect(containerIds).toContain("pkg-domains");
  });

  test("should support easy auto-registration via static register method", () => {
    BaseCfour.resetWorkspace();
    defaultDiesel.addBuildingBlock("pkg-web", "Web", "Frontend", "React");

    class LoginService {
      static {
        defaultDiesel.register(
          {
            parentId: "pkg-web",
            description: "Handles user login",
            technology: "JWT",
          },
          "LoginService",
        );
      }
    }
    void LoginService; // side-effectful static block must still run

    const ws = BaseCfour.getWorkspace();
    const component = ws.softwareSystems[0].containers![0].components![0];
    expect(component.id).toBe("LoginService"); // inferred from class name
    expect(component.description).toBe("Handles user login");
  });

  test("should avoid duplicate container registration", () => {
    BaseCfour.resetWorkspace();
    defaultDiesel.addBuildingBlock("pkg-dup", "Duplicate", "Desc", "Tech");
    defaultDiesel.addBuildingBlock("pkg-dup", "Duplicate", "Desc", "Tech");

    const ws = BaseCfour.getWorkspace();
    const framework = ws.softwareSystems.find((s) => s.id === "framework");
    expect(framework?.containers?.length).toBe(1);
  });

  test("register should target specific workspace", () => {
    BaseCfour.resetWorkspace("SpecificWS");
    defaultDiesel.addBuildingBlock("pkg-web", "Web", "Frontend", "React", "SpecificWS");

    class CustomService {
      static {
        defaultDiesel.register(
          {
            parentId: "pkg-web",
            workspaceName: "SpecificWS",
            description: "Custom service in specific workspace",
          },
          "CustomService",
        );
      }
    }
    void CustomService; // side-effectful static block must still run

    const ws = BaseCfour.getWorkspace("SpecificWS");
    const component = ws.softwareSystems[0].containers![0].components![0];
    expect(component.id).toBe("CustomService");

    const defaultWs = BaseCfour.getWorkspace("default");
    expect(defaultWs.softwareSystems.length).toBe(0);
  });
});

describe("Plan/Apply Generator Pipeline", () => {
  let tmp: string;
  const fs = createNodeCodebaseFs();

  beforeEach(() => {
    BaseCfour.reset();
    resetGenerators();
  });

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "gen-diesel-pa-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  /** Deterministic generator that writes fixed content to a single path. */
  function fixedGen(path: string, content: string): Generator {
    return async (_ctx) => {
      await writeFile(path, content);
      return { filesWritten: [path], filesDeleted: [] };
    };
  }

  /** sha256 of a file's current bytes — the "ground truth" mirror of `hashFile`. */
  async function diskHash(path: string): Promise<string> {
    return createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  }

  /** Seeds a minimal "desired" workspace with one node of every kind. */
  function seedDesired() {
    BaseCfour.resetWorkspace("desired", "Apply Fixture");
    BaseCfour.batch(() => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1", description: "system" }, "desired");
      BaseCfour.addContainer(
        { id: "con1", name: "C1", systemId: "sys1", technology: "node", description: "api" },
        "desired",
        "local",
      );
      BaseCfour.addComponent(
        { id: "comp1", name: "P1", containerId: "con1", technology: "ts", description: "impl" },
        "desired",
        "local",
      );
    });
  }

  test("idempotence — apply(apply(m)) ≡ apply(m), with zero writes on the second run", async () => {
    const p = join(tmp, "comp1.ts");
    seedDesired();
    let invocations = 0;
    defaultDiesel.registerGenerator("Component:ts", (ctx) => {
      invocations++;
      return fixedGen(p, "export const value = 1;")(ctx);
    });

    const m1 = await defaultDiesel.planAndApply(fs, {});
    expect(invocations).toBe(1);
    expect(m1.comp1).toBeDefined();

    // Property: a second apply with no intervening mutation is a no-op —
    // no generator runs and the manifest is a fixed point.
    const m2 = await defaultDiesel.planAndApply(fs, m1);
    expect(invocations).toBe(1);
    expect(JSON.stringify(m2)).toBe(JSON.stringify(m1));

    // Invariant: every hash recorded in the manifest matches the bytes
    // actually on disk (the manifest is a faithful snapshot).
    for (const entry of Object.values(m2)) {
      for (const [path, recorded] of Object.entries(entry.files)) {
        expect(await diskHash(path)).toBe(recorded);
      }
    }
  });

  test("topo order is a permutation of the touched set and satisfies the dependency invariant", () => {
    const rand = mulberry32(0xc4f);
    for (let trial = 0; trial < 30; trial++) {
      BaseCfour.resetWorkspace("desired");
      const ids = Array.from({ length: 8 }, (_, i) => `n${i}`);

      // Build a random DAG: an edge i -> j is only allowed when j < i, which
      // guarantees acyclicity by construction — the invariant must then hold.
      const rels: C4Relationship[] = [];
      for (let i = 1; i < ids.length; i++) {
        for (let j = 0; j < i; j++) {
          if (rand() < 0.35) {
            rels.push({
              id: `r${i}-${j}`,
              kind: "Relationship",
              sourceId: ids[i],
              destinationId: ids[j],
              description: "d",
            });
          }
        }
      }

      BaseCfour.batch(() => {
        BaseCfour.addSoftwareSystem({ id: "sys", name: "S", description: "d" }, "desired");
        BaseCfour.addContainer(
          { id: "con", name: "C", systemId: "sys", description: "d" },
          "desired",
          "local",
        );
        for (const id of ids) {
          BaseCfour.addComponent(
            { id, name: id, containerId: "con", description: "d" },
            "desired",
            "local",
          );
        }
        for (const r of rels) BaseCfour.addRelationship(r, "desired", "local");
      });

      const order = defaultDiesel.topoOrderForApply(
        BaseCfour.diff("applied", "desired"),
        "desired",
      );

      // Bijection: the order contains exactly the touched set, no more, no less.
      const expected = ["sys", "con", ...ids].sort();
      expect(order.map((n) => n.id).sort()).toEqual(expected);

      // Invariant: for every relationship whose endpoints are both touched,
      // the destination is generated before the source.
      const pos = new Map(order.map((n, i) => [n.id, i]));
      for (const r of rels) {
        expect(pos.get(r.destinationId)!).toBeLessThan(pos.get(r.sourceId)!);
      }
    }
  });

  test("a dependency cycle among touched nodes throws, naming it, before any generator runs", async () => {
    const p = join(tmp, "cycle.txt");
    BaseCfour.resetWorkspace("desired");
    BaseCfour.batch(() => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1", description: "d" }, "desired");
      BaseCfour.addContainer(
        { id: "con1", name: "C1", systemId: "sys1", description: "d" },
        "desired",
        "local",
      );
      BaseCfour.addComponent(
        { id: "a", name: "A", containerId: "con1", description: "d" },
        "desired",
        "local",
      );
      BaseCfour.addComponent(
        { id: "b", name: "B", containerId: "con1", description: "d" },
        "desired",
        "local",
      );
      BaseCfour.addComponent(
        { id: "c", name: "C", containerId: "con1", description: "d" },
        "desired",
        "local",
      );
      BaseCfour.addRelationship(
        { id: "ab", kind: "Relationship", sourceId: "a", destinationId: "b", description: "d" },
        "desired",
        "local",
      );
      BaseCfour.addRelationship(
        { id: "bc", kind: "Relationship", sourceId: "b", destinationId: "c", description: "d" },
        "desired",
        "local",
      );
      BaseCfour.addRelationship(
        { id: "ca", kind: "Relationship", sourceId: "c", destinationId: "a", description: "d" },
        "desired",
        "local",
      );
    });

    let invocations = 0;
    defaultDiesel.registerGenerator("Component", async () => {
      invocations++;
      await writeFile(p, "should never be written");
      return { filesWritten: [p], filesDeleted: [] };
    });

    // Fails loudly (not silently reordered), names the participants…
    await expect(defaultDiesel.planAndApply(fs, {})).rejects.toThrow(/cycle/i);
    await expect(defaultDiesel.planAndApply(fs, {})).rejects.toThrow(/a|b|c/);

    // …and no generator ever ran, so nothing was written.
    expect(invocations).toBe(0);
    await expect(readFile(p, "utf8")).rejects.toThrow(/ENOENT/);

    // Atomicity corollary: "applied" was never promoted, so a retry sees the
    // same diff.
    expect(BaseCfour.getWorkspace("applied").softwareSystems.length).toBe(0);
  });

  test("removing a node deletes exactly the files in its manifest entry", async () => {
    const p1 = join(tmp, "comp1.ts");
    const p2 = join(tmp, "comp1.spec.ts");
    const pCon = join(tmp, "con1.js");
    seedDesired();
    defaultDiesel.registerGenerator("Component:ts", async () => {
      await writeFile(p1, "impl");
      await writeFile(p2, "spec");
      return { filesWritten: [p1, p2], filesDeleted: [] };
    });
    // con1 also owns files, so we can prove removal is scoped per-node.
    defaultDiesel.registerGenerator("Container:node", (ctx) =>
      fixedGen(pCon, `module.exports = "${ctx.node.id}";`)(ctx),
    );

    const m1 = await defaultDiesel.planAndApply(fs, {});
    expect(m1.comp1?.files[p1]).toBeDefined();
    expect(m1.comp1?.files[p2]).toBeDefined();
    expect(m1.con1?.files[pCon]).toBeDefined();

    BaseCfour.removeElement("comp1", "desired", "local");
    const m2 = await defaultDiesel.planAndApply(fs, m1);

    // comp1's owned files are gone and its manifest entry is gone…
    expect(m2.comp1).toBeUndefined();
    await expect(readFile(p1, "utf8")).rejects.toThrow(/ENOENT/);
    await expect(readFile(p2, "utf8")).rejects.toThrow(/ENOENT/);

    // …while an unrelated node's files and manifest entry are untouched.
    expect(m2.con1).toBeDefined();
    expect(m2.con1?.files[pCon]).toBe(m1.con1?.files[pCon]);
    expect(await readFile(pCon, "utf8")).toBe('module.exports = "con1";');
  });

  test("a generator's filesDeleted are honored — files are removed and the manifest forgets them", async () => {
    const pLegacy = join(tmp, "comp1.legacy.ts");
    const pCurrent = join(tmp, "comp1.ts");
    seedDesired();
    defaultDiesel.registerGenerator("Component:ts", async () => {
      await writeFile(pCurrent, "current");
      await writeFile(pLegacy, "legacy");
      return { filesWritten: [pCurrent, pLegacy], filesDeleted: [] };
    });
    const m1 = await defaultDiesel.planAndApply(fs, {});
    expect(m1.comp1?.files[pLegacy]).toBeDefined();

    // The generator stops writing pLegacy and signals it as deleted.
    BaseCfour.updateElement("comp1", { name: "v2" }, "desired", "local");
    defaultDiesel.registerGenerator("Component:ts", async () => {
      await writeFile(pCurrent, "current-v2");
      return { filesWritten: [pCurrent], filesDeleted: [pLegacy] };
    });
    const m2 = await defaultDiesel.planAndApply(fs, m1);

    expect(m2.comp1?.files[pCurrent]).toBeDefined();
    expect(m2.comp1?.files[pLegacy]).toBeUndefined();
    await expect(readFile(pLegacy, "utf8")).rejects.toThrow(/ENOENT/);
    expect(await readFile(pCurrent, "utf8")).toBe("current-v2");
  });

  test("a shrinking output set prunes orphaned files even when filesDeleted is empty", async () => {
    const p1 = join(tmp, "comp1.ts");
    const p2 = join(tmp, "comp1.spec.ts");
    seedDesired();
    defaultDiesel.registerGenerator("Component:ts", async () => {
      await writeFile(p1, "impl");
      await writeFile(p2, "spec");
      return { filesWritten: [p1, p2], filesDeleted: [] };
    });
    const m1 = await defaultDiesel.planAndApply(fs, {});
    expect(m1.comp1?.files[p1]).toBeDefined();
    expect(m1.comp1?.files[p2]).toBeDefined();

    // Output set shrinks; the generator forgets to mention filesDeleted.
    BaseCfour.updateElement("comp1", { name: "v2" }, "desired", "local");
    defaultDiesel.registerGenerator("Component:ts", async () => {
      await writeFile(p1, "impl-v2");
      return { filesWritten: [p1], filesDeleted: [] };
    });
    const m2 = await defaultDiesel.planAndApply(fs, m1);

    // The stale file is pruned from disk AND from the manifest.
    expect(m2.comp1?.files[p1]).toBeDefined();
    expect(m2.comp1?.files[p2]).toBeUndefined();
    await expect(readFile(p2, "utf8")).rejects.toThrow(/ENOENT/);
    expect(await readFile(p1, "utf8")).toBe("impl-v2");
  });

  test("a validation error in desired blocks every write and leaves applied untouched", async () => {
    const p = join(tmp, "x.txt");
    seedDesired();
    BaseCfour.addRelationship(
      { id: "dangling", kind: "Relationship", sourceId: "ghost", destinationId: "comp1" },
      "desired",
      "local",
    );

    let invocations = 0;
    defaultDiesel.registerGenerator("Component", async () => {
      invocations++;
      await writeFile(p, "x");
      return { filesWritten: [p], filesDeleted: [] };
    });

    await expect(defaultDiesel.planAndApply(fs, {})).rejects.toThrow(/failed validation/i);
    expect(invocations).toBe(0);
    await expect(readFile(p, "utf8")).rejects.toThrow(/ENOENT/);
    expect(BaseCfour.getWorkspace("applied").softwareSystems.length).toBe(0);
  });

  test("a throwing generator aborts before commit — applied stays at the previous snapshot", async () => {
    const p = join(tmp, "comp1.ts");
    seedDesired();
    defaultDiesel.registerGenerator("Component:ts", (ctx) => fixedGen(p, "v1")(ctx));
    const m1 = await defaultDiesel.planAndApply(fs, {});

    const appliedBefore = JSON.stringify(BaseCfour.getWorkspace("applied"));

    // Mutate desired, then make generation fail mid-apply.
    BaseCfour.updateElement("comp1", { name: "v2" }, "desired", "local");
    defaultDiesel.registerGenerator("Component:ts", async () => {
      throw new Error("boom");
    });
    await expect(defaultDiesel.planAndApply(fs, m1)).rejects.toThrow("boom");

    // Invariant: the commit never ran, so "applied" is byte-identical.
    expect(JSON.stringify(BaseCfour.getWorkspace("applied"))).toBe(appliedBefore);

    // And the diff is still pending: a retry with a working generator
    // succeeds against the very same diff.
    defaultDiesel.registerGenerator("Component:ts", (ctx) => fixedGen(p, "v2")(ctx));
    const m2 = await defaultDiesel.planAndApply(fs, m1);
    expect(m2.comp1?.files[p]).toBeDefined();
    expect(await readFile(p, "utf8")).toBe("v2");
  });

  test("hand-edited files are detected by hash mismatch and onDrift is honored", async () => {
    const p = join(tmp, "comp1.ts");
    seedDesired();
    defaultDiesel.registerGenerator("Component:ts", (ctx) => fixedGen(p, "generated")(ctx));
    const m1 = await defaultDiesel.planAndApply(fs, {});

    // Hand-edit the generated file and touch the node so the next apply
    // regenerates it.
    await writeFile(p, "HAND-EDITED");
    BaseCfour.updateElement("comp1", { name: "v2" }, "desired", "local");

    const driftCalls: Array<[string, string[]]> = [];
    const m2 = await defaultDiesel.planAndApply(fs, m1, {
      onDrift: (id, files) => {
        driftCalls.push([id, files]);
        return "skip";
      },
    });
    // onDrift sees exactly the drifted path and its "skip" is honored.
    expect(driftCalls).toEqual([["comp1", [p]]]);
    expect(await readFile(p, "utf8")).toBe("HAND-EDITED");
    expect(m2.comp1?.files[p]).toBe(m1.comp1?.files[p]);

    // Re-touch + re-edit, then apply with "overwrite": bytes are restored and
    // the manifest is updated to match the new disk state.
    await writeFile(p, "HAND-EDITED-2");
    BaseCfour.updateElement("comp1", { name: "v3" }, "desired", "local");
    const m3 = await defaultDiesel.planAndApply(fs, m2, { onDrift: () => "overwrite" });
    expect(await readFile(p, "utf8")).toBe("generated");
    expect(m3.comp1?.files[p]).toBe(await diskHash(p));
  });

  test("nodes without a registered generator are skipped, yet the apply still commits", async () => {
    seedDesired();
    const manifest = await defaultDiesel.planAndApply(fs, {});
    expect(manifest).toEqual({});

    // "applied" was promoted anyway, so the next apply sees an empty diff.
    const diff = BaseCfour.diff("applied", "desired");
    expect(diff.nodes.added.length).toBe(0);
    expect(diff.nodes.modified.length).toBe(0);
  });

  test("resolveGenerator picks stereotype > technology > bare kind", () => {
    const kindGen: Generator = async () => ({ filesWritten: [], filesDeleted: [] });
    const techGen: Generator = async () => ({ filesWritten: [], filesDeleted: [] });
    const stereoGen: Generator = async () => ({ filesWritten: [], filesDeleted: [] });
    defaultDiesel.registerGenerator("Class", kindGen);
    defaultDiesel.registerGenerator("Class:TypeScript", techGen);
    defaultDiesel.registerGenerator("Class:<<entity>>", stereoGen);

    const full: C4Node = {
      id: "c1",
      name: "C1",
      kind: "Class",
      componentId: "x",
      technology: "TypeScript",
      stereotype: "<<entity>>",
    };
    expect(defaultDiesel.resolveGenerator(full)).toBe(stereoGen);
    expect(defaultDiesel.resolveGenerator({ ...full, stereotype: undefined } as C4Node)).toBe(
      techGen,
    );
    expect(
      defaultDiesel.resolveGenerator({
        ...full,
        stereotype: undefined,
        technology: undefined,
      } as C4Node),
    ).toBe(kindGen);
  });

  test("deriveRelationshipId is deterministic, slugified, and injective across labels", async () => {
    // Readable, address-like prefix plus a label digest.
    await expect(defaultDiesel.deriveRelationshipId("a", "b", "wires")).resolves.toBe(
      "a--b--wires--5c8ad06e",
    );
    // Determinism: identical inputs always map to the identical id.
    await expect(defaultDiesel.deriveRelationshipId("a", "b", "wires")).resolves.toBe(
      await defaultDiesel.deriveRelationshipId("a", "b", "wires"),
    );
    // Spaces in the label are slugified.
    await expect(defaultDiesel.deriveRelationshipId("a", "b", "Reads customer data")).resolves.toBe(
      "a--b--Reads-customer-data--19165a70",
    );
    // Injectivity across labels: distinct labels never collide for one endpoint pair.
    const labels = ["implements", "depends", "wires", "uses", "calls", "part-of"];
    const ids = await Promise.all(
      labels.map((l) => defaultDiesel.deriveRelationshipId("a", "b", l)),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("a--b--"))).toBe(true);
    // Labels that slugify identically still get distinct ids.
    const near = await Promise.all([
      defaultDiesel.deriveRelationshipId("a", "b", "uses-data"),
      defaultDiesel.deriveRelationshipId("a", "b", "uses  data"),
      defaultDiesel.deriveRelationshipId("a", "b", "Reads!"),
      defaultDiesel.deriveRelationshipId("a", "b", "Reads?"),
    ]);
    expect(new Set(near).size).toBe(near.length);
  });

  test("assertGeneratorIsPure enforces the purity contract at the content level", async () => {
    const ctx: GeneratorContext = {
      node: { id: "c1", name: "C1", kind: "Component", containerId: "x" } as C4Node,
      ancestors: [],
      relationships: [],
    };
    const p = join(tmp, "pure.txt");

    await expect(
      defaultDiesel.assertGeneratorIsPure(fs, fixedGen(p, "constant"), ctx),
    ).resolves.toBeUndefined();

    let n = 0;
    const impure: Generator = async () => {
      await writeFile(p, `content-${n++}`);
      return { filesWritten: [p], filesDeleted: [] };
    };
    await expect(defaultDiesel.assertGeneratorIsPure(fs, impure, ctx)).rejects.toThrow(/not pure/i);
  });
});
