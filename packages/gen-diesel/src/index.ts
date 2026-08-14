import {
  BaseCfour,
  type C4CodeElementKind,
  type C4ElementKind,
  type C4Node,
  type C4Relationship,
  type C4WorkspaceDiff,
} from "@nowarelabs/cfour";

/**
 * gen-diesel — the generative DSL / codegen layer over the cfour C4 model.
 *
 * The C4 workspace is the single source of truth for code generation. This
 * package owns the contract between the architecture model and generated
 * code: the generator registry, the plan/apply pipeline (mirroring
 * `terraform plan`/`terraform apply`), drift detection, and the DSL
 * registration conveniences (`register`, `addBuildingBlock`).
 *
 * Everything here is a pure function over cfour types — the package composes
 * cfour and never runs inside the Durable Object (the DO only serves the
 * model). The core entry imports **no node builtins** so it runs on Workers;
 * file IO is abstracted behind the `CodebaseFs` interface and a node adapter
 * ships behind the `@nowarelabs/gen-diesel/node` subpath.
 *
 * ## Two-workspace convention
 *
 *   - "desired" — the editable workspace. Humans (via GUI), scripts, and
 *     agents mutate ONLY this one, always inside `BaseCfour.batch(...)`.
 *   - "applied" — a snapshot of what was last successfully generated to
 *     disk. Only `planAndApply` is allowed to write to it, via
 *     `resetWorkspace` + `import(export(...))`, exactly as cfour's own
 *     import/export methods already support.
 *
 * Nothing outside this package ever writes generated files directly; all
 * writes flow through `planAndApply`.
 */

/**
 * Editor id used for system-level model construction that has no human
 * editor in scope: `addBuildingBlock` and `register`. Claim enforcement in
 * cfour treats it like any other editor id.
 */
const REGISTER_EDITOR = "__system__";

const CONTAINER_KINDS = new Set<C4ElementKind>(["Container", "Queue", "Topic"]);

const CODE_ELEMENT_KINDS = new Set<C4ElementKind>([
  "Class",
  "Interface",
  "AbstractClass",
  "Enum",
  "Function",
  "Table",
  "Object",
]);

// ----------------------------------------------------------------
// File IO — platform-agnostic abstraction (the reason this package exists)
// ----------------------------------------------------------------

/**
 * The file-system surface a host provides to the pipeline. Implemented for
 * node by `createNodeCodebaseFs()` behind the `@nowarelabs/gen-diesel/node`
 * subpath; a Workers host can back it with R2. `deleteFile` must tolerate an
 * already-missing file (treat it as a no-op); `exists` lets `unlinkIfExists`
 * avoid racy delete-then-catch paths.
 */
export interface CodebaseFs {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readDir(path: string): Promise<string[]>;
}

function getTechnology(el: C4Node): string | undefined {
  if (CONTAINER_KINDS.has(el.kind)) return (el as { technology?: string }).technology;
  if (el.kind === "Component") return (el as { technology?: string }).technology;
  if (CODE_ELEMENT_KINDS.has(el.kind)) return (el as { technology?: string }).technology;
  return undefined;
}

// ----------------------------------------------------------------
// Generator types
// ----------------------------------------------------------------

/** Context handed to a generator for a single node during `planAndApply`. */
export interface GeneratorContext {
  node: C4Node;
  ancestors: C4Node[];
  relationships: C4Relationship[];
}

/**
 * Result of running a generator for one node.
 * `filesWritten` are absolute paths to files the generator wrote (or updated);
 * `filesDeleted` are absolute paths to files it removed.
 */
export interface GeneratorResult {
  filesWritten: string[]; // absolute paths
  filesDeleted: string[];
}

/**
 * A code generator for a single C4 node.
 * MUST be pure: the same `GeneratorContext` always yields byte-identical
 * output — see the purity contract on `registerGenerator`.
 */
export type Generator = (ctx: GeneratorContext) => Promise<GeneratorResult>;

/** Tracks which files a node owns on disk and their hash at generation time. */
export interface ManifestEntry {
  elementId: string;
  files: Record<string, string>; // path -> sha256 hash at generation time
}

/** The full generation manifest: node id -> its owned files. */
export type GenerationManifest = Record<string, ManifestEntry>;

/** Callback options for `planAndApply`. */
export interface ApplyOptions {
  onDrift?: (elementId: string, driftedFiles: string[]) => "overwrite" | "skip";
}

/** Configuration for the `register` DSL convenience. */
export interface RegisterConfig {
  id?: string;
  name?: string;
  description?: string;
  technology?: string;
  parentId?: string; // containerId or componentId
  kind?: C4ElementKind;
  workspaceName?: string;
}

// ----------------------------------------------------------------
// Registry — module-level, one per process, shared by every Diesel
// ----------------------------------------------------------------
// Deliberately a single registry shared by every `BaseCfour` subclass and
// every Diesel instance — one global architecture model, one global
// generator registry. Generator keys must be unique repo-wide. Reset it with
// `resetGenerators()` (used for test isolation).

const _generators: Map<string, Generator> = new Map();

/** Empties the shared generator registry. Used for test isolation. */
export function resetGenerators(): void {
  _generators.clear();
}

/**
 * Registers a generator for a C4 element kind, optionally narrowed by
 * technology or stereotype.
 *
 * Key format: `"<C4ElementKind>"` (e.g. `"Component"`), or
 * `"<C4ElementKind>:<technology>"` (e.g. `"Component:React"`), or
 * `"<C4ElementKind>:<stereotype>"` (e.g. `"Class:entity"`). See
 * `resolveGenerator` for the resolution order.
 *
 * **PURITY CONTRACT — READ CAREFULLY.** Generator bodies MUST be pure:
 * the same `GeneratorContext` must always produce byte-identical
 * `GeneratorResult` content. No `Date.now()`, `Math.random()`,
 * `crypto.randomUUID()`, or ambient reads (clock, env vars, network, other
 * files) inside generator bodies. This is the single biggest risk to the
 * idempotence guarantee of `planAndApply` — drift detection and
 * skip-on-unchanged behavior assume that regenerating a node rewrites
 * exactly the same bytes. Use `assertGeneratorIsPure` in tests to verify
 * this contract.
 */
export function registerGenerator(key: string, gen: Generator): void {
  _generators.set(key, gen);
}

/**
 * Resolves the most specific generator registered for a node.
 * Resolution order: stereotype match (when the node has a `stereotype`) >
 * technology match (when the node has a `technology`) > bare kind match.
 */
export function resolveGenerator(node: C4Node): Generator | undefined {
  if ("stereotype" in node && node.stereotype) {
    const gen = _generators.get(`${node.kind}:${node.stereotype}`);
    if (gen) return gen;
  }
  const technology = getTechnology(node);
  if (technology) {
    const gen = _generators.get(`${node.kind}:${technology}`);
    if (gen) return gen;
  }
  return _generators.get(node.kind);
}

/**
 * Derives a stable, readable, injective relationship id from its endpoints
 * and label. The label is slugified (spaces -> hyphens, punctuation dropped)
 * and a short sha256 digest of the full label is appended, so labels that
 * slugify to the same string ("uses-data" vs "uses  data", "Reads!" vs
 * "Reads?") never collide. Regenerating the same logical relationship from a
 * script/DSL always produces the same id, avoiding duplicate relationships
 * on re-apply.
 *
 * Uses the Web Crypto global (`crypto.subtle.digest`), so it is async and
 * runs on Workers and Node ≥ 19. The digest is identical to node's
 * `createHash("sha256")`.
 */
export async function deriveRelationshipId(
  sourceId: string,
  destinationId: string,
  label: string,
): Promise<string> {
  const slug = label
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
  const digest = (await sha256Hex(label.trim())).slice(0, 8);
  const tail = slug ? `${slug}--${digest}` : digest;
  return `${sourceId}--${destinationId}--${tail}`;
}

/** sha256 hex digest of a UTF-8 string via the Web Crypto global. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns the sha256 hex digest of a file's contents, or `""` when the file
 * does not exist. Only a missing file maps to `""` — any other read error
 * (permission, I/O) propagates so drift is never mistaken for a hand-edit.
 */
export async function hashFile(fs: CodebaseFs, path: string): Promise<string> {
  let data: Uint8Array;
  try {
    data = await fs.readFile(path);
  } catch (e) {
    if ((e as { code?: string })?.code === "ENOENT") return "";
    throw e;
  }
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Best-effort delete: ignores already-missing files, surfaces other errors. */
export async function unlinkIfExists(fs: CodebaseFs, path: string): Promise<void> {
  if (!(await fs.exists(path))) return;
  await fs.deleteFile(path);
}

/**
 * Returns the list of paths whose current on-disk hash no longer matches the
 * manifest's recorded hash (i.e. hand-edited since last generation).
 * Deleted files are reported as drift (missing files hash to `""`).
 */
export async function detectDrift(fs: CodebaseFs, entry: ManifestEntry): Promise<string[]> {
  const drifted: string[] = [];
  for (const [path, recordedHash] of Object.entries(entry.files)) {
    const currentHash = await hashFile(fs, path);
    if (currentHash !== recordedHash) drifted.push(path);
  }
  return drifted;
}

/**
 * Returns the touched nodes (added + modified) from a diff in topological
 * order for apply: when a relationship's endpoints are BOTH touched, the
 * destination is generated before the source.
 *
 * Throws a clear `Error` naming the cycle when the touched subgraph contains
 * a dependency cycle — that means the architecture graph itself is invalid
 * and must fail loudly rather than being silently reordered.
 */
export function topoOrderForApply(
  cfour: Pick<BaseCfour, "findRelationships">,
  diffResult: C4WorkspaceDiff,
  workspaceName = "desired",
): C4Node[] {
  const touched = new Map<string, C4Node>();
  for (const node of diffResult.nodes.added) touched.set(node.id, node);
  for (const mod of diffResult.nodes.modified) touched.set(mod.after.id, mod.after);

  const dependsOn = new Map<string, Set<string>>();
  for (const id of touched.keys()) dependsOn.set(id, new Set());

  for (const rel of cfour.findRelationships({}, workspaceName)) {
    if (touched.has(rel.sourceId) && touched.has(rel.destinationId)) {
      dependsOn.get(rel.sourceId)!.add(rel.destinationId);
    }
  }

  const order: C4Node[] = [];
  const state = new Map<string, 1 | 2>(); // 1 = in-progress, 2 = done
  const path: string[] = [];

  const visit = (id: string) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const cycleStart = path.indexOf(id);
      const cycle = [...path.slice(cycleStart), id];
      throw new Error(`Dependency cycle detected among touched nodes: ${cycle.join(" -> ")}`);
    }
    state.set(id, 1);
    path.push(id);
    for (const dep of dependsOn.get(id)!) visit(dep);
    path.pop();
    state.set(id, 2);
    order.push(touched.get(id)!);
  };

  for (const id of touched.keys()) visit(id);
  return order;
}

/**
 * Main generator pipeline — mirrors `terraform plan`/`terraform apply`.
 *
 * Reads "desired" and "applied" workspaces and the provided manifest to
 * regenerate the touched nodes in dependency order, then — only after every
 * step succeeds — promotes "desired" to "applied". If anything throws, the
 * `"applied"` workspace and the returned manifest are left untouched so the
 * next call retries against the same diff.
 *
 * KNOWN LIMITATION (transactionality): file writes/deletes in steps 3–4 are
 * applied to disk immediately and are not rolled back on a mid-run failure
 * — the manifest/caller only sees a consistent picture when the function
 * returns. Aborted runs self-heal on retry: removals re-attempt `deleteFile`
 * on an already-missing file and it is a no-op, and regenerated nodes are
 * pure, so a retry rewrites byte-identical content.
 *
 * Steps: validate ("desired") → diff ("applied" vs "desired") → remove files
 * for removed nodes → regenerate added/modified nodes in topological order
 * (honoring drift + `onDrift`) → commit.
 *
 * @param cfour    The cfour model instance holding the "desired"/"applied"
 *   workspaces.
 * @param fs       The host file-system adapter the pipeline reads/writes
 *   through (generators write through whatever fs they captured).
 * @param manifest The current `GenerationManifest` (persist it externally
 *   between runs — it is returned updated and must be stored by the caller).
 * @param options  Drift-handling callback.
 * @returns The updated manifest reflecting what is now on disk.
 */
export async function planAndApply(
  cfour: BaseCfour,
  fs: CodebaseFs,
  manifest: GenerationManifest,
  options?: ApplyOptions,
): Promise<GenerationManifest> {
  // 1. Validate — hard stop on errors, warn-only on lint.
  const validation = cfour.validate("desired");
  const errors = validation.filter((v) => v.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `planAndApply aborted: "desired" workspace failed validation.\n${errors
        .map((e) => `  - [${e.id}] ${e.message}`)
        .join("\n")}`,
    );
  }
  for (const warning of cfour.lint(undefined, "desired")) {
    console.warn(`[planAndApply:lint] ${warning.message}`);
  }

  // 2. Plan.
  const diff = cfour.diff("applied", "desired");
  const n = diff.nodes;
  const r = diff.relationships;
  console.log(
    `[planAndApply] nodes +${n.added.length} ~${n.modified.length} -${n.removed.length}; ` +
      `relationships +${r.added.length} ~${r.modified.length} -${r.removed.length}`,
  );

  const nextManifest: GenerationManifest = { ...manifest };

  // 3. Apply removals first — delete every file a removed node owns.
  for (const node of diff.nodes.removed) {
    const entry = nextManifest[node.id];
    if (!entry) continue;
    for (const path of Object.keys(entry.files)) {
      await unlinkIfExists(fs, path);
    }
    delete nextManifest[node.id];
  }

  // 4. Apply additions/modifications in dependency order.
  for (const node of topoOrderForApply(cfour, diff, "desired")) {
    const existing = nextManifest[node.id];
    if (existing) {
      const driftedFiles = await detectDrift(fs, existing);
      if (driftedFiles.length > 0) {
        const decision = options?.onDrift?.(node.id, driftedFiles) ?? "skip";
        if (decision === "skip") {
          console.warn(
            `[planAndApply] Skipping ${node.id}: drifted files: ${driftedFiles.join(", ")}`,
          );
          continue;
        }
      }
    }

    const gen = resolveGenerator(node);
    if (!gen) {
      console.warn(
        `[planAndApply] No generator for ${node.kind} "${node.id}"; skipping (partial coverage allowed)`,
      );
      continue;
    }

    const result = await gen({
      node,
      ancestors: cfour.getAncestors(node.id, "desired"),
      relationships: cfour.findRelationships({ sourceId: node.id }, "desired"),
    });

    const files: Record<string, string> = {};
    for (const path of result.filesWritten) {
      files[path] = await hashFile(fs, path);
    }

    // Remove files the generator explicitly deleted, plus files this node
    // used to own but no longer writes (output set shrank). Without this,
    // old files drop out of the manifest but linger on disk as orphans.
    for (const path of result.filesDeleted) {
      await unlinkIfExists(fs, path);
    }
    const previousFiles = existing ? Object.keys(existing.files) : [];
    for (const path of previousFiles) {
      if (!(path in files)) await unlinkIfExists(fs, path);
    }

    nextManifest[node.id] = { elementId: node.id, files };
  }

  // 5. Commit — promote "desired" to "applied" only after everything above
  //    succeeded. On throw, "applied" remains the previous snapshot.
  cfour.resetWorkspace("applied");
  cfour.import(cfour.export("desired"), "applied");

  // 6. Return the updated manifest.
  return nextManifest;
}

/**
 * Dev-only helper for tests: runs `gen(ctx)` twice with the identical context
 * and throws a clear `Error` if the two runs differ in the set of written
 * paths or in the content of any written file — verifying the purity
 * contract required by `registerGenerator`.
 */
export async function assertGeneratorIsPure(
  fs: CodebaseFs,
  gen: Generator,
  ctx: GeneratorContext,
): Promise<void> {
  const first = await gen(ctx);

  // Snapshot the first run's output BEFORE running again — the second run
  // overwrites the same files on disk, so comparing after both runs would
  // compare each file with itself.
  const firstContent = new Map<string, Uint8Array | null>();
  for (const path of first.filesWritten) {
    firstContent.set(path, await fs.readFile(path).catch(() => null));
  }

  const second = await gen(ctx);

  const listsEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((p, i) => p === b[i]);

  if (!listsEqual(first.filesWritten, second.filesWritten)) {
    throw new Error(
      `Generator is not pure: filesWritten differs between runs.\n` +
        `  first:  ${first.filesWritten.join(", ")}\n` +
        `  second: ${second.filesWritten.join(", ")}`,
    );
  }
  if (!listsEqual(first.filesDeleted, second.filesDeleted)) {
    throw new Error(
      `Generator is not pure: filesDeleted differs between runs.\n` +
        `  first:  ${first.filesDeleted.join(", ")}\n` +
        `  second: ${second.filesDeleted.join(", ")}`,
    );
  }

  for (const path of first.filesWritten) {
    const secondContent = await fs.readFile(path).catch(() => null);
    if (!bytesEqual(firstContent.get(path) ?? null, secondContent)) {
      throw new Error(`Generator is not pure: content of "${path}" differs between runs.`);
    }
  }
}

function bytesEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ----------------------------------------------------------------
// DSL registration conveniences
// ----------------------------------------------------------------

/**
 * Helper to register a framework "Building Block" as a Container.
 * If the "Framework" system doesn't exist, it is created.
 */
export function addBuildingBlock(
  cfour: BaseCfour,
  packageId: string,
  name: string,
  description?: string,
  technology?: string,
  workspaceName = "default",
): void {
  const ws = cfour.getWorkspace(workspaceName);
  let frameworkSystem = ws.softwareSystems.find((s) => s.id === "framework");
  if (!frameworkSystem) {
    cfour.addSoftwareSystem(
      {
        id: "framework",
        name: "Framework",
        description: "The core application framework building blocks.",
      },
      workspaceName,
    );
    frameworkSystem = ws.softwareSystems.find((s) => s.id === "framework")!;
  }

  // Check if container already exists to avoid duplicates during hot-reloading
  const existing = frameworkSystem.containers?.find((c) => c.id === packageId);
  if (existing) return;

  cfour.addContainer(
    {
      id: packageId,
      name,
      description,
      technology,
      systemId: "framework",
    },
    workspaceName,
    REGISTER_EDITOR,
  );
}

/**
 * Automatically registers a subclass as a Component or Code Element.
 * `className` provides the class name for id/name inference (pass it when
 * calling outside a static block where `this.name` is unavailable).
 */
export function register(cfour: BaseCfour, config: RegisterConfig, className?: string): void {
  const workspaceName = config.workspaceName || "default";
  const id = config.id || className || "RegisteredElement";
  const name = config.name || className || "RegisteredElement";

  // Try to infer parent and kind
  if (config.kind === "Component" || (!config.kind && config.parentId)) {
    cfour.addComponent(
      {
        id,
        name,
        description: config.description,
        technology: config.technology,
        containerId: config.parentId!,
      },
      workspaceName,
      REGISTER_EDITOR,
    );
  } else if (config.kind && CODE_ELEMENT_KINDS.has(config.kind)) {
    cfour.addCodeElement(
      {
        id,
        name,
        description: config.description,
        technology: config.technology,
        componentId: config.parentId!,
        kind: config.kind as C4CodeElementKind,
      },
      workspaceName,
      REGISTER_EDITOR,
    );
  }
}

// ----------------------------------------------------------------
// Diesel — a curried façade over a cfour model instance
// ----------------------------------------------------------------

/**
 * A codegen session bound to one cfour model instance. Replaces the old
 * `BaseCfour.registerGenerator(...)` / `BaseCfour.planAndApply(...)` statics:
 * the pipeline is host-side code that composes the model, never a method on
 * the model itself.
 */
export interface Diesel {
  /** Registers a subclass/class as a Component or Code Element in the model. */
  register(config: RegisterConfig, className?: string): void;
  /** Registers a framework "Building Block" Container in the model. */
  addBuildingBlock(
    packageId: string,
    name: string,
    description?: string,
    technology?: string,
    workspaceName?: string,
  ): void;
  /** Registers a generator for a C4 element kind, optionally narrowed. */
  registerGenerator(key: string, gen: Generator): void;
  /** Resolves the most specific generator for a node (stereotype > tech > kind). */
  resolveGenerator(node: C4Node): Generator | undefined;
  /** Stable, readable, injective relationship id (async sha256 via Web Crypto). */
  deriveRelationshipId(sourceId: string, destinationId: string, label: string): Promise<string>;
  /** Touched nodes in dependency order for apply (throws on cycles). */
  topoOrderForApply(diff: C4WorkspaceDiff, workspaceName?: string): C4Node[];
  /** Runs the full validate → diff → generate → commit pipeline. */
  planAndApply(
    fs: CodebaseFs,
    manifest: GenerationManifest,
    options?: ApplyOptions,
  ): Promise<GenerationManifest>;
  /** Paths whose on-disk hash drifted from the manifest record. */
  detectDrift(fs: CodebaseFs, entry: ManifestEntry): Promise<string[]>;
  /** sha256 hex digest of a file, or `""` when it does not exist. */
  hashFile(fs: CodebaseFs, path: string): Promise<string>;
  /** Best-effort delete: ignores already-missing files. */
  unlinkIfExists(fs: CodebaseFs, path: string): Promise<void>;
  /** Verifies a generator is pure by running it twice. */
  assertGeneratorIsPure(fs: CodebaseFs, gen: Generator, ctx: GeneratorContext): Promise<void>;
}

/**
 * Binds the gen-diesel pipeline to a specific cfour model instance (e.g. one
 * per project, or one per editor session). Generators are repo-wide by
 * design: the shared registry is module-level, so every Diesel sees the same
 * generators.
 */
export function createDiesel(cfour: BaseCfour): Diesel {
  return {
    register: (config, className) => register(cfour, config, className),
    addBuildingBlock: (packageId, name, description, technology, workspaceName) =>
      addBuildingBlock(cfour, packageId, name, description, technology, workspaceName),
    registerGenerator,
    resolveGenerator,
    deriveRelationshipId,
    topoOrderForApply: (diff, workspaceName) => topoOrderForApply(cfour, diff, workspaceName),
    planAndApply: (fs, manifest, options) => planAndApply(cfour, fs, manifest, options),
    detectDrift,
    hashFile,
    unlinkIfExists,
    assertGeneratorIsPure,
  };
}

/**
 * The default Diesel, bound to cfour's shared default model instance — the
 * instance the `BaseCfour.*` static facade delegates to. Prefer
 * `createDiesel(cfour)` with an explicit instance when you need isolation.
 */
export const defaultDiesel: Diesel = createDiesel(BaseCfour.getDefault());
