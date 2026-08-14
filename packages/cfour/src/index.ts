import type {
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";

/**
 * cfour — a single-module C4 architecture model kernel.
 *
 * This file is intentionally one module: the C4 model (workspaces, systems,
 * containers, components, code elements, relationships) lives here alongside
 * its mutation semantics, claim/proposal collaboration rules, branch diffing
 * and merging, generator-driven code synthesis (plan/apply), and persistence
 * helpers. Keeping the model, its invariants, and its workflows co-located is
 * what lets them share private state without leaking it through a public API
 * surface.
 *
 * The public entry point is `BaseCfour`, a per-instance model behind a static
 * facade: instantiate `new BaseCfour()` (or a subclass) for an isolated model,
 * or call the static methods directly, which delegate to a shared default
 * instance. Mutating methods take a workspace name plus an `editorId`; when a
 * selection is claimed, the claim is enforced — an editor may only modify
 * elements they hold. Cross-editor relationship edits go through
 * `proposeRelationship` / `acceptRelationship` joint approval. Branches
 * (`createBranch`, `planMerge`, `applyMerge`) and generators
 * (`registerGenerator`, `planAndApply`) build on the same diff primitives.
 *
 * Pure helpers (`flattenWorkspace`, `c4ToReactFlow`, `diffWorkspaces`,
 * `deriveRelationshipId`, view builders) are exported alongside the class.
 */

/**
 * Editor id used for system-level model construction that has no human
 * editor in scope: `register`, `addBuildingBlock` and `applyMerge` node
 * additions. Claim enforcement treats it like any other editor id.
 */
const REGISTER_EDITOR = "__system__";

export class BaseCfour {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseCfour>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseCfour>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseCfour>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  /**
   * Resets every piece of mutable state on this instance back to its initial
   * value: workspaces, claims, relationship proposals, branch bases, the
   * event log, and the generator registry. Listeners, storage adapters and
   * the event-log cap are left alone. Use `BaseCfour.reset()` (the static
   * facade) for test isolation, or call it on your own instance to tear a
   * model down.
   */
  reset(): void {
    this._workspaces = new Map([
      [
        "default",
        {
          name: "Default Workspace",
          people: [],
          softwareSystems: [],
          relationships: [],
          views: [],
        },
      ],
    ]);
    this._batchDepth = 0;
    this._batchQueue = [];
    this._batchSnapshots = [];
    this._eventLog = [];
    this._claims = new Map();
    this._relationshipProposals = new Map();
    this._branchBase = new Map();
    this._claimTtlMs = 5 * 60 * 1000;
    this._generators = new Map();
  }

  private _workspaces: Map<string, C4Workspace> = new Map([
    [
      "default",
      { name: "Default Workspace", people: [], softwareSystems: [], relationships: [], views: [] },
    ],
  ]);

  private _listeners: Set<(event: CfourChangeEvent) => void> = new Set();
  private _batchDepth = 0;
  private _batchQueue: CfourChangeEvent[] = [];
  // One lazily-populated snapshot map per active batch level: each level
  // clones a workspace the first time it is accessed at that level, so it
  // can restore it on failure (undefined = workspace didn't exist yet).
  private _batchSnapshots: Map<string, C4Workspace | undefined>[] = [];
  private _storage: CfourStorage | null = null;
  private _eventLog: CfourChangeEvent[] = [];
  private _eventLogMax = 1000;
  private _eventStorage: CfourEventStorage | null = null;
  private _claims: Map<string, Map<string, C4Claim>> = new Map(); // workspaceName -> claimId -> claim
  private _relationshipProposals: Map<string, Map<string, C4RelationshipProposal>> = new Map(); // workspaceName -> proposalId -> proposal
  private _branchBase: Map<string, { parent: string; baseSnapshot: string }> = new Map(); // branchName -> parent + JSON snapshot at branch time
  private _claimTtlMs = 5 * 60 * 1000; // default; overridable via setClaimTtl

  /**
   * Subscribes to fine-grained workspace change events.
   *
   * **Synchronous & blocking**: listeners are called in registration order
   * before the mutating method returns. The callback must not be async.
   *
   * This is a deliberate design choice: `BaseCfour` exposes a synchronous
   * static API (`addComponent()` returns `void`, not `Promise<void>`).
   * Making listeners async would require every mutation to become async,
   * breaking all existing callers. Instead, listeners that need to perform
   * slow work (LLM calls, remote file writes, etc.) should dispatch it
   * asynchronously and return immediately.
   *
   * **Recommended pattern for async work:**
   * ```ts
   * // Queue async work per-node so rapid mutations coalesce naturally.
   * const pending = new Map<string, Promise<void>>();
   *
   * BaseCfour.subscribe((event) => {
   *   const key = event.elementId ?? event.op;
   *   const prev = pending.get(key) ?? Promise.resolve();
   *   pending.set(key, prev.then(() => handleAsyncWork(event)));
   * });
   * ```
   *
   * This pattern ensures:
   * - The listener returns immediately (never blocks the mutation call).
   * - Async work for the same node is serialized (no race conditions).
   * - Rapid mutations to the same node naturally coalesce (each new
   *   event chains onto the previous promise, so only the latest state
   *   is processed).
   *
   * Returns an unsubscribe function.
   */
  subscribe(listener: (event: CfourChangeEvent) => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(event: CfourChangeEvent) {
    if (this._batchDepth > 0) {
      this._batchQueue.push(event);
      return;
    }
    this._logEvent(event);
    for (const listener of this._listeners) {
      listener(event);
    }
  }

  private _logEvent(event: CfourChangeEvent) {
    const stamped = { ...event, timestamp: Date.now() };
    this._eventLog.push(stamped);
    if (this._eventLog.length > this._eventLogMax) {
      this._eventLog.splice(0, this._eventLog.length - this._eventLogMax);
    }
    if (this._eventStorage) {
      this._eventStorage.append(stamped).catch((e) => {
        // Fire-and-forget persistence: don't block the mutation, but never
        // let a failing event-history adapter fail silently.
        console.warn(
          `[cfour] failed to persist change event to storage: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    }
  }

  /**
   * Executes `fn` inside an atomic transaction: change notifications are
   * deferred until the callback completes, and every workspace mutation made
   * inside the callback is rolled back if it throws. Notifications are
   * flushed in order when the outermost batch completes.
   *
   * Nested calls to `batch` share the outermost flush, but each level takes
   * its own snapshot: an inner failure rolls back only the mutations made
   * since that inner call began (and rethrows, aborting the outer callback),
   * so outer mutations are never left dangling with events wiped.
   *
   * COST NOTE: snapshots are lazy per level — a workspace is cloned (via
   * `structuredClone`) only on its first access at that level, and only
   * if the level may need to roll back. A batch touching only `"desired"`
   * never clones `"applied"`. A read counts as access, so prefer ONE
   * `batch()` per logical step over per-mutation calls.
   *
   * ```ts
   * BaseCfour.batch(() => {
   *   addComponent({ ... })
   *   addComponent({ ... })
   *   // notifications are deferred
   * })
   * // -> two events emitted here, in order
   * ```
   */
  batch(fn: () => void) {
    const level = new Map<string, C4Workspace | undefined>();
    this._batchSnapshots.push(level);
    const queueStart = this._batchQueue.length;
    this._batchDepth++;
    try {
      fn();
    } catch (e) {
      // Roll back workspace mutations and discard only the events queued
      // since this batch began — a failed batch must not leave silent state
      // drift between the workspace and anything persisting off the event
      // stream (a caught inner failure keeps the outer batch's events).
      this._restoreLevel(level);
      this._batchQueue.length = queueStart;
      throw e;
    } finally {
      this._batchDepth--;
      this._batchSnapshots.pop();
      if (this._batchDepth === 0) {
        const events = this._batchQueue.splice(0);
        for (const event of events) {
          this._logEvent(event);
          for (const listener of this._listeners) {
            listener(event);
          }
        }
      } else {
        // Promote this level's baselines into the parent level so the parent
        // can still roll back a workspace it only touched through a nested
        // batch (parent's own earlier snapshot wins where both exist).
        const parent = this._batchSnapshots[this._batchSnapshots.length - 1];
        if (parent) {
          for (const [name, snap] of level) {
            if (!parent.has(name)) parent.set(name, snap);
          }
        }
      }
    }
  }

  /** Records a pre-mutation snapshot of `name` on first access at this level. */
  private _captureLazySnapshot(name: string, current: C4Workspace | undefined) {
    if (this._batchDepth > 0) {
      const level = this._batchSnapshots[this._batchSnapshots.length - 1];
      if (level && !level.has(name)) {
        level.set(name, current === undefined ? undefined : structuredClone(current));
      }
    }
  }

  private _restoreLevel(level: Map<string, C4Workspace | undefined>) {
    for (const [name, snap] of level) {
      if (snap === undefined) this._workspaces.delete(name);
      else this._workspaces.set(name, snap);
    }
  }

  /** Resets a specific C4 workspace or the default one. */
  resetWorkspace(workspaceName = "default", title?: string, description?: string) {
    // Snapshot before overwriting so a failed batch can bring the old
    // content back (or, for a never-seen name, drop the fresh workspace).
    this._captureLazySnapshot(workspaceName, this._workspaces.get(workspaceName));
    this._workspaces.set(workspaceName, {
      name: title || (workspaceName === "default" ? "Framework Workspace" : workspaceName),
      description,
      people: [],
      softwareSystems: [],
      relationships: [],
      views: [],
    });
    this._claims.delete(workspaceName);
    this._relationshipProposals.delete(workspaceName);
    this._branchBase.delete(workspaceName);
    this._notify({ op: "reset", workspaceName });
  }

  /** Returns a specific C4 workspace or the default one. */
  getWorkspace(name = "default"): C4Workspace {
    const ws = this._workspaces.get(name);
    if (!ws) {
      // Lazy initialization if workspace doesn't exist
      this.resetWorkspace(name);
      return this._workspaces.get(name)!;
    }
    // Mutators fetch the live reference here before mutating it, so the
    // snapshot taken now captures pre-mutation state for the batch rollback.
    this._captureLazySnapshot(name, ws);
    return ws;
  }

  /** Returns all workspace names. */
  getWorkspaceNames(): string[] {
    return Array.from(this._workspaces.keys());
  }

  /** Adds a Person to the workspace. */
  addPerson(person: Omit<C4Person, "kind">, workspaceName = "default") {
    this.getWorkspace(workspaceName).people.push({ ...person, kind: "Person" });
    this._notify({
      op: "add",
      workspaceName,
      elementId: person.id,
      elementKind: "Person",
      path: [],
    });
  }

  /** Adds a Software System to the workspace. */
  addSoftwareSystem(system: Omit<C4SoftwareSystem, "kind">, workspaceName = "default") {
    this.getWorkspace(workspaceName).softwareSystems.push({ ...system, kind: "SoftwareSystem" });
    this._notify({
      op: "add",
      workspaceName,
      elementId: system.id,
      elementKind: "SoftwareSystem",
      path: [],
    });
  }

  /** Adds a Container to a Software System. */
  addContainer(
    container: Omit<C4Container, "kind"> & { kind?: "Container" | "Queue" | "Topic" },
    workspaceName = "default",
    editorId: string,
  ) {
    const ws = this.getWorkspace(workspaceName);
    const system = ws.softwareSystems.find((s) => s.id === container.systemId);
    if (!system) {
      throw new Error(
        `Software System with id "${container.systemId}" not found in workspace "${workspaceName}".`,
      );
    }
    this._assertClaimAllows(container.systemId, editorId, workspaceName, "element");
    system.containers = system.containers || [];
    system.containers.push({ ...container, kind: container.kind ?? "Container" });
    this._absorbCreatedElement(container.systemId, container.id, editorId, workspaceName);
    this._notify({
      op: "add",
      workspaceName,
      elementId: container.id,
      elementKind: container.kind ?? "Container",
      path: [container.systemId],
    });
  }

  /** Adds a Queue to a Software System (specialized container). */
  addQueue(queue: Omit<C4Container, "kind">, workspaceName = "default", editorId: string) {
    this.addContainer({ ...queue, kind: "Queue" }, workspaceName, editorId);
  }

  /** Adds a Topic to a Software System (specialized container). */
  addTopic(topic: Omit<C4Container, "kind">, workspaceName = "default", editorId: string) {
    this.addContainer({ ...topic, kind: "Topic" }, workspaceName, editorId);
  }

  /** Adds a Component to a Container. */
  addComponent(component: Omit<C4Component, "kind">, workspaceName = "default", editorId: string) {
    const ws = this.getWorkspace(workspaceName);
    let container: C4Container | undefined;
    let systemId = "";
    for (const system of ws.softwareSystems) {
      container = system.containers?.find((c) => c.id === component.containerId);
      if (container) {
        systemId = system.id;
        break;
      }
    }

    if (!container) {
      throw new Error(
        `Container with id "${component.containerId}" not found in workspace "${workspaceName}".`,
      );
    }

    this._assertClaimAllows(component.containerId, editorId, workspaceName, "element");
    container.components = container.components || [];
    container.components.push({ ...component, kind: "Component" });
    this._absorbCreatedElement(component.containerId, component.id, editorId, workspaceName);
    this._notify({
      op: "add",
      workspaceName,
      elementId: component.id,
      elementKind: "Component",
      path: [systemId, container.id],
    });
  }

  /** Adds a Code Element to a Component. */
  addCodeElement(
    codeElement: Omit<C4CodeElement, "kind"> & { kind?: C4CodeElementKind },
    workspaceName = "default",
    editorId: string,
  ) {
    const ws = this.getWorkspace(workspaceName);
    let component: C4Component | undefined;
    let systemId = "";
    let containerId = "";
    for (const system of ws.softwareSystems) {
      for (const container of system.containers ?? []) {
        component = container.components?.find((c) => c.id === codeElement.componentId);
        if (component) {
          systemId = system.id;
          containerId = container.id;
          break;
        }
      }
      if (component) break;
    }

    if (!component) {
      throw new Error(
        `Component with id "${codeElement.componentId}" not found in workspace "${workspaceName}".`,
      );
    }

    this._assertClaimAllows(codeElement.componentId, editorId, workspaceName, "element");
    component.codeElements = component.codeElements || [];
    component.codeElements.push({
      ...codeElement,
      kind: codeElement.kind ?? "Class",
    } as C4CodeElement);
    this._absorbCreatedElement(codeElement.componentId, codeElement.id, editorId, workspaceName);
    this._notify({
      op: "add",
      workspaceName,
      elementId: codeElement.id,
      elementKind: codeElement.kind ?? "Class",
      path: [systemId, containerId, component.id],
    });
  }

  /**
   * Adds a Relationship between any two elements. The caller must hold any
   * claim that covers either endpoint; a relationship spanning two different
   * editors' claims requires joint approval via proposeRelationship().
   */
  addRelationship(rel: C4Relationship, workspaceName = "default", editorId: string) {
    const sourceClaim = this.getClaimFor(rel.sourceId, workspaceName);
    const destinationClaim = this.getClaimFor(rel.destinationId, workspaceName);
    const sourceEditor = sourceClaim?.editorId;
    const destinationEditor = destinationClaim?.editorId;
    if (sourceEditor && destinationEditor && sourceEditor !== destinationEditor) {
      throw new Error(
        `Relationship "${rel.id}" spans claims held by editors "${sourceEditor}" and "${destinationEditor}" in workspace "${workspaceName}". Use proposeRelationship() to request joint approval instead.`,
      );
    }
    if (sourceEditor && sourceEditor !== editorId) {
      throw new Error(
        `Element "${rel.sourceId}" is claimed by editor "${sourceEditor}" in workspace "${workspaceName}".`,
      );
    }
    if (destinationEditor && destinationEditor !== editorId) {
      throw new Error(
        `Element "${rel.destinationId}" is claimed by editor "${destinationEditor}" in workspace "${workspaceName}".`,
      );
    }
    this._addRelationshipRaw(rel, workspaceName);
  }

  /**
   * Appends a relationship without claim enforcement. Reachable only from
   * `acceptRelationship`, the deliberate joint-approval escape hatch: once
   * every required claim holder has approved a proposal, the relationship is
   * materialized even though it crosses their claims. Nothing else should
   * call this.
   */
  private _addRelationshipRaw(rel: C4Relationship, workspaceName: string) {
    this.getWorkspace(workspaceName).relationships.push(rel);
    this._notify({
      op: "add",
      workspaceName,
      elementId: rel.id,
      elementKind: "Relationship",
      path: [],
    });
  }

  /** Updates an existing relationship's properties. */
  updateRelationship(
    id: string,
    patch: Partial<Omit<C4Relationship, "id" | "kind">>,
    workspaceName = "default",
    editorId: string,
  ) {
    const ws = this.getWorkspace(workspaceName);
    this._assertClaimAllows(id, editorId, workspaceName, "relationship");
    const rel = ws.relationships.find((r) => r.id === id);
    if (rel) {
      const before = snapshotNode(rel as any as C4Node);
      Object.assign(rel, patch);
      const changes = getObjectChanges(before, rel);
      this._notify({
        op: "update",
        workspaceName,
        elementId: id,
        elementKind: "Relationship",
        path: [],
        before: before as any,
        after: snapshotNode(rel as any as C4Node),
        changes,
      });
    }
  }

  /** Updates an existing element's properties. */
  updateElement(
    id: string,
    patch: Partial<Omit<C4Node, "id" | "kind">>,
    workspaceName = "default",
    editorId: string,
  ) {
    const ws = this.getWorkspace(workspaceName);
    this._assertClaimAllows(id, editorId, workspaceName, "element");
    // Single tree walk yields both the node and its ancestry path.
    const found = findNodeWithAncestry(ws, id);
    if (found) {
      const before = snapshotNode(found.node);
      Object.assign(found.node, patch);
      const changes = getObjectChanges(before, found.node);
      this._notify({
        op: "update",
        workspaceName,
        elementId: id,
        elementKind: found.node.kind,
        path: found.path,
        before,
        after: snapshotNode(found.node),
        changes,
      });
    }
  }

  /**
   * Refreshes a node's metadata from external data (e.g. after re-scanning a file).
   * Semantically identical to `updateElement` — provided as a named alias
   * for codebase-reconciliation workflows where "refresh from source of truth"
   * reads more clearly than "update".
   */
  refreshNode(
    id: string,
    data: Partial<Omit<C4Node, "id" | "kind">>,
    workspaceName = "default",
    editorId: string,
  ) {
    this.updateElement(id, data, workspaceName, editorId);
  }

  /** Removes an element and all its children/relationships. */
  removeElement(id: string, workspaceName = "default", editorId: string) {
    const ws = this.getWorkspace(workspaceName);
    this._assertClaimAllows(id, editorId, workspaceName, "element");

    // Capture before state and collect full subtree
    const found = findNodeWithAncestry(ws, id);
    const descendants = found ? collectDescendants(found.node) : [];

    // Collect all node ids in the removal set (target + descendants)
    const removedIds = new Set<string>([id, ...descendants.map((d) => d.id)]);

    // Collect relationships that touch any removed node
    const removedRelationships = ws.relationships.filter(
      (r) => removedIds.has(r.sourceId) || removedIds.has(r.destinationId),
    );

    // Remove from people
    ws.people = ws.people.filter((p) => !removedIds.has(p.id));

    // Remove from systems/containers/components/code
    ws.softwareSystems = ws.softwareSystems.filter((s) => !removedIds.has(s.id));
    for (const system of ws.softwareSystems) {
      if (system.containers) {
        system.containers = system.containers.filter((c) => !removedIds.has(c.id));
        for (const container of system.containers) {
          if (container.components) {
            container.components = container.components.filter((cp) => !removedIds.has(cp.id));
            for (const component of container.components) {
              if (component.codeElements) {
                component.codeElements = component.codeElements.filter(
                  (ce) => !removedIds.has(ce.id),
                );
              }
            }
          }
        }
      }
    }

    // Remove associated relationships
    ws.relationships = ws.relationships.filter(
      (r) => !removedIds.has(r.sourceId) && !removedIds.has(r.destinationId),
    );

    // Purge the removed ids from every claim, auto-releasing claims left empty.
    this._purgeRemovedFromClaims(
      removedIds,
      new Set(removedRelationships.map((r) => r.id)),
      workspaceName,
    );

    this._notify({
      op: "remove",
      workspaceName,
      elementId: id,
      elementKind: found?.node.kind,
      path: found?.path,
      removedDescendants:
        descendants.length > 0 || removedRelationships.length > 0
          ? { nodes: descendants, relationships: removedRelationships }
          : undefined,
    });
  }

  // ── View Builders (Drilling) ───────────────────────────────

  /** Gets a System Context view for a system in the registry. */
  getSystemContextView(systemId: string, workspaceName = "default") {
    return buildSystemContextView(this.getWorkspace(workspaceName), systemId);
  }

  /** Gets a Container view for a system in the registry. */
  getContainerView(systemId: string, workspaceName = "default") {
    return buildContainerView(this.getWorkspace(workspaceName), systemId);
  }

  /** Gets a Component view for a container in the registry. */
  getComponentView(containerId: string, workspaceName = "default") {
    return buildComponentView(this.getWorkspace(workspaceName), containerId);
  }

  /** Gets a Code view for a component in the registry. */
  getCodeView(componentId: string, workspaceName = "default") {
    return buildCodeView(this.getWorkspace(workspaceName), componentId);
  }

  /** Gets a Team view for a specific team in the registry. */
  getTeamView(teamName: string, workspaceName = "default") {
    return buildTeamView(this.getWorkspace(workspaceName), teamName);
  }

  /**
   * Gets a Flow view (ephemeral viewpoint) for specific tags (e.g. 'internet', 'pci').
   * Useful for security audits (CISO) or network flow analysis.
   */
  getFlowView(tag: string, title?: string, workspaceName = "default") {
    return buildFlowView(this.getWorkspace(workspaceName), tag, title);
  }

  /**
   * Generates a structured catalog of network flows for a given tag.
   * Returns a list of relationships with source/destination names and tech.
   */
  getFlowCatalog(
    tag: string,
    workspaceName = "default",
  ): Array<{
    id: string;
    source: string;
    destination: string;
    description: string;
    technology: string;
  }> {
    const ws = this.getWorkspace(workspaceName);
    const flat = flattenWorkspace(ws);
    const nodeMap = buildNodeMap(flat);

    return ws.relationships
      .filter((r) => r.tags?.includes(tag))
      .map((r) => ({
        id: r.id,
        source: nodeMap.get(r.sourceId)?.name ?? r.sourceId,
        destination: nodeMap.get(r.destinationId)?.name ?? r.destinationId,
        description: r.description || "Relationship",
        technology: r.technology || "Unknown",
      }));
  }

  /** Diffs two workspaces in the registry. */
  diff(workspaceNameA: string, workspaceNameB: string): C4WorkspaceDiff {
    return diffWorkspaces(this.getWorkspace(workspaceNameA), this.getWorkspace(workspaceNameB));
  }

  /**
   * Generates a legend for a given view.
   * Scans all elements and relationships in the view to identify unique kinds and technologies.
   */
  getLegend(
    view: C4View,
    workspaceName = "default",
  ): {
    elements: Array<{ kind: C4ElementKind; technology?: string; icon?: string }>;
    relationships: Array<{
      description: string;
      technology?: string;
      lineStyle: "solid" | "dashed";
    }>;
  } {
    const ws = this.getWorkspace(workspaceName);
    const flat = flattenWorkspace(ws);
    const nodeMap = buildNodeMap(flat);
    const relMap = new Map(flat.relationships.map((r) => [r.id, r]));

    const elementLegend = new Map<
      string,
      { kind: C4ElementKind; technology?: string; icon?: string }
    >();
    for (const ve of view.elements) {
      const node = nodeMap.get(ve.elementId);
      if (node) {
        const key = `${node.kind}-${getTechnology(node) || ""}-${node.icon || ""}`;
        elementLegend.set(key, {
          kind: node.kind,
          technology: getTechnology(node),
          icon: node.icon,
        });
      }
    }

    const relationshipLegend = new Map<
      string,
      { description: string; technology?: string; lineStyle: "solid" | "dashed" }
    >();
    for (const vr of view.relationships) {
      const rel = relMap.get(vr.relationshipId);
      if (rel) {
        const lineStyle =
          rel.codeRelationshipKind === "Implements" ||
          rel.codeRelationshipKind === "Depends" ||
          rel.codeRelationshipKind === "Realizes"
            ? "dashed"
            : "solid";
        const key = `${rel.description}-${rel.technology || ""}-${lineStyle}`;
        relationshipLegend.set(key, {
          description: rel.description || "Relationship",
          technology: rel.technology,
          lineStyle,
        });
      }
    }

    return {
      elements: Array.from(elementLegend.values()),
      relationships: Array.from(relationshipLegend.values()),
    };
  }

  /**
   * Lints a view or workspace against the Software Architecture Diagram Review Checklist.
   * Returns a list of checklist violations.
   */
  lint(
    view?: C4View,
    workspaceName = "default",
  ): Array<{ check: string; message: string; category: "General" | "Elements" | "Relationships" }> {
    const ws = this.getWorkspace(workspaceName);
    const violations: Array<{
      check: string;
      message: string;
      category: "General" | "Elements" | "Relationships";
    }> = [];

    // General Checks
    if (view) {
      if (!view.title) {
        violations.push({
          category: "General",
          check: "Does the diagram have a title?",
          message: `View "${view.id}" is missing a title.`,
        });
      }
      if (!view.description) {
        violations.push({
          category: "General",
          check: "Do you understand the diagram scope?",
          message: `View "${view.id}" is missing a description explaining its scope.`,
        });
      }
    }

    const flat = view
      ? {
          nodes: flattenWorkspace(ws).nodes.filter((n) =>
            view.elements.some((ve) => ve.elementId === n.id),
          ),
          relationships: ws.relationships.filter((r) =>
            view.relationships.some((vr) => vr.relationshipId === r.id),
          ),
        }
      : flattenWorkspace(ws);

    // Elements Checks
    for (const node of flat.nodes) {
      if (!node.description) {
        violations.push({
          category: "Elements",
          check: "Do you understand what every element does?",
          message: `Element "${node.name}" (${node.id}) is missing a description.`,
        });
      }
      if (!getTechnology(node) && node.kind !== "Person" && node.kind !== "SoftwareSystem") {
        violations.push({
          category: "Elements",
          check: "Do you understand the technology choices?",
          message: `Element "${node.name}" is missing technology details.`,
        });
      }
    }

    // Relationship Checks
    for (const rel of flat.relationships) {
      if (!rel.description) {
        violations.push({
          category: "Relationships",
          check: "Does every arrow have a label?",
          message: `Relationship "${rel.id}" is missing a descriptive label.`,
        });
      }
      if (!rel.technology) {
        violations.push({
          category: "Relationships",
          check: "Do you understand the technology choices?",
          message: `Relationship from "${rel.sourceId}" to "${rel.destinationId}" is missing technology/protocol details.`,
        });
      }
    }

    return violations;
  }

  /** Updates a node position in a specific view. */
  updateViewPosition(
    viewId: string,
    elementId: string,
    x: number,
    y: number,
    workspaceName = "default",
  ) {
    const ws = this.getWorkspace(workspaceName);
    let view = ws.views?.find((v) => v.id === viewId);

    if (!view) {
      // Create view if it doesn't exist (e.g. first time dragging in a generated view)
      // We might need more context here to build a proper view, but for now we'll assume it exists
      return;
    }

    let ve = view.elements.find((e) => e.elementId === elementId);
    if (!ve) {
      ve = { elementId, x, y };
      view.elements.push(ve);
    } else {
      ve.x = x;
      ve.y = y;
    }

    this._notify({
      op: "update",
      workspaceName,
      elementId: viewId,
      path: [],
    });
  }

  /** Persists a view to the workspace. */
  saveView(view: C4View, workspaceName = "default") {
    const ws = this.getWorkspace(workspaceName);
    ws.views = ws.views || [];
    const idx = ws.views.findIndex((v) => v.id === view.id);
    const isNew = idx < 0;
    if (isNew) {
      ws.views.push(view);
    } else {
      ws.views[idx] = view;
    }
    this._notify({
      op: isNew ? "add" : "update",
      workspaceName,
      elementId: view.id,
      path: [],
    });
  }

  // ── Persistence ───────────────────────────────────────────

  /** Exports a workspace to a JSON string. */
  export(workspaceName = "default"): string {
    return JSON.stringify(this.getWorkspace(workspaceName), null, 2);
  }

  /** Imports a workspace from a JSON string. */
  import(json: string, workspaceName = "default") {
    // Bypasses getWorkspace, so capture the pre-import content explicitly
    // to keep a failed batch able to restore it.
    this._captureLazySnapshot(workspaceName, this._workspaces.get(workspaceName));
    const ws = JSON.parse(json) as C4Workspace;
    this._workspaces.set(workspaceName, ws);
    this._notify({ op: "import", workspaceName });
  }

  // ── Storage — platform-agnostic persistence ────────────────

  /** Configures the storage adapter used by snapshot helpers. */
  setStorage(storage: CfourStorage) {
    this._storage = storage;
  }

  /** Serialises the workspace and persists it via the storage adapter. */
  async saveSnapshot(workspaceName = "default"): Promise<void> {
    if (!this._storage)
      throw new Error("No storage adapter configured. Call BaseCfour.setStorage() first.");
    const json = this.export(workspaceName);
    await this._storage.put(`workspace:${workspaceName}`, json);
  }

  /** Loads a workspace from storage and imports it (triggers an "import" event). */
  async loadSnapshot(workspaceName = "default"): Promise<void> {
    if (!this._storage)
      throw new Error("No storage adapter configured. Call BaseCfour.setStorage() first.");
    const json = await this._storage.get(`workspace:${workspaceName}`);
    if (json) {
      this.import(json, workspaceName);
    }
  }

  /** Deletes a persisted workspace snapshot. */
  async deleteSnapshot(workspaceName = "default"): Promise<void> {
    if (!this._storage)
      throw new Error("No storage adapter configured. Call BaseCfour.setStorage() first.");
    await this._storage.delete(`workspace:${workspaceName}`);
  }

  /** Lists all persisted workspace snapshot keys. */
  async listSnapshots(): Promise<string[]> {
    if (!this._storage)
      throw new Error("No storage adapter configured. Call BaseCfour.setStorage() first.");
    const keys = await this._storage.list("workspace:");
    return keys.map((k) => k.replace(/^workspace:/, ""));
  }

  // ── Query Engine ──────────────────────────────────────────

  /**
   * Queries nodes based on filters.
   * Example: findNodes({ kind: 'Container', technology: 'React' })
   */
  findNodes(
    filter: {
      kind?: C4ElementKind;
      technology?: string;
      owner?: string;
      tags?: string[];
      search?: string; // search in name/description
    },
    workspaceName = "default",
  ): C4Node[] {
    const ws = this.getWorkspace(workspaceName);
    const flat = flattenWorkspace(ws);

    return flat.nodes.filter((node) => {
      if (filter.kind && node.kind !== filter.kind) return false;
      if (filter.owner && node.owner !== filter.owner) return false;
      if (filter.technology) {
        const tech = getTechnology(node);
        if (!tech?.toLowerCase().includes(filter.technology.toLowerCase())) return false;
      }
      if (filter.tags && filter.tags.length > 0) {
        if (!node.tags || !filter.tags.every((t) => node.tags!.includes(t))) return false;
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        const inName = node.name.toLowerCase().includes(search);
        const inDesc = node.description?.toLowerCase().includes(search) ?? false;
        if (!inName && !inDesc) return false;
      }
      return true;
    });
  }

  /**
   * Queries relationships based on filters.
   * Example: findRelationships({ sourceId: 'comp1' })
   */
  findRelationships(
    filter: {
      sourceId?: string;
      destinationId?: string;
      technology?: string;
      tags?: string[];
      interactionStyle?: "sync" | "async";
      search?: string;
    },
    workspaceName = "default",
  ): C4Relationship[] {
    const ws = this.getWorkspace(workspaceName);
    return ws.relationships.filter((rel) => {
      if (filter.sourceId && rel.sourceId !== filter.sourceId) return false;
      if (filter.destinationId && rel.destinationId !== filter.destinationId) return false;
      if (filter.technology) {
        if (!rel.technology?.toLowerCase().includes(filter.technology.toLowerCase())) return false;
      }
      if (filter.interactionStyle && rel.interactionStyle !== filter.interactionStyle) return false;
      if (filter.tags && filter.tags.length > 0) {
        if (!rel.tags || !filter.tags.every((t) => rel.tags!.includes(t))) return false;
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        const inDesc = rel.description?.toLowerCase().includes(search) ?? false;
        const inTech = rel.technology?.toLowerCase().includes(search) ?? false;
        if (!inDesc && !inTech) return false;
      }
      return true;
    });
  }

  // ── Graph Traversal ───────────────────────────────────────

  /**
   * Returns the ancestry of a node from root down to (but not including) the node itself.
   * For a CodeElement in sys1/con1/comp1, returns [sys1, con1, comp1].
   */
  getAncestors(id: string, workspaceName = "default"): C4Node[] {
    const ws = this.getWorkspace(workspaceName);
    const found = findNodeWithAncestry(ws, id);
    if (!found) return [];
    const nodeMap = buildNodeMap(flattenWorkspace(ws));
    return found.path.map((ancestorId) => nodeMap.get(ancestorId)!).filter(Boolean);
  }

  /**
   * Returns all descendants of a node in leaves-first order.
   * For a SoftwareSystem, returns its containers, then their components, then code elements.
   */
  getDescendants(id: string, workspaceName = "default"): C4Node[] {
    const ws = this.getWorkspace(workspaceName);
    const found = findNodeWithAncestry(ws, id);
    if (!found) return [];
    return collectDescendants(found.node);
  }

  // ── Collaborative Editing (Selections & Claims) ───────

  /**
   * Returns the structural subtree rooted at `rootId`: the root element
   * itself, every descendant (via getDescendants), and every relationship
   * whose source AND destination both fall inside that combined set. Throws
   * if rootId does not exist.
   */
  getSubtree(rootId: string, workspaceName = "default"): C4Selection {
    const ws = this.getWorkspace(workspaceName);
    if (!findNodeWithAncestry(ws, rootId)) {
      throw new Error(`Element with id "${rootId}" not found in workspace "${workspaceName}".`);
    }
    const elementIds = [rootId, ...this.getDescendants(rootId, workspaceName).map((n) => n.id)];
    return {
      elementIds,
      relationshipIds: this._internalRelationshipIds(ws.relationships, new Set(elementIds)),
    };
  }

  /**
   * Returns every node matching `query` (same filter semantics as
   * findNodes), plus every relationship whose source AND destination both
   * fall inside the matched set. Nodes that match but have no internal
   * relationships are still included, contributing nothing to
   * relationshipIds.
   */
  getSelection(query: SelectionQuery, workspaceName = "default"): C4Selection {
    const ws = this.getWorkspace(workspaceName);
    const elementIds = this.findNodes(query, workspaceName).map((n) => n.id);
    return {
      elementIds,
      relationshipIds: this._internalRelationshipIds(ws.relationships, new Set(elementIds)),
    };
  }

  /**
   * Claims a selection for exclusive editing by `editorId`. The reserved
   * system identity `REGISTER_EDITOR` cannot be claimed — it is used by
   * system-level operations (`register`, `addBuildingBlock`, `applyMerge`),
   * so an external claim under that id would silently intersect with them.
   * Throws if any element or relationship id in the selection is already
   * covered by an existing active claim in this workspace (regardless of who
   * holds it — re-claiming your own overlapping scope must also throw;
   * release and re-claim explicitly instead). Returns the created C4Claim.
   * Emits a "claim" event with `payload` set to the created claim.
   */
  claim(selection: C4Selection, editorId: string, workspaceName = "default"): C4Claim {
    if (editorId === REGISTER_EDITOR) {
      throw new Error(
        `Editor id "${REGISTER_EDITOR}" is reserved for system-level operations and cannot be claimed.`,
      );
    }
    const claims = this._claimsFor(workspaceName);
    const conflicting = new Map<string, C4Claim>();
    for (const claim of claims.values()) {
      for (const id of claim.elementIds) {
        if (!conflicting.has(id)) conflicting.set(id, claim);
      }
      for (const id of claim.relationshipIds) {
        if (!conflicting.has(id)) conflicting.set(id, claim);
      }
    }

    const overlapping = new Set<C4Claim>();
    for (const id of [...selection.elementIds, ...selection.relationshipIds]) {
      const holder = conflicting.get(id);
      if (holder) overlapping.add(holder);
    }

    if (overlapping.size > 0) {
      const holders = Array.from(overlapping)
        .map((c) => `"${c.id}" (editor "${c.editorId}")`)
        .join(", ");
      throw new Error(
        `Cannot claim selection in workspace "${workspaceName}": selection overlaps claim ${holders}. Release and re-claim explicitly.`,
      );
    }

    const now = Date.now();
    const claim: C4Claim = {
      id: randomUUID(),
      editorId,
      workspaceName,
      elementIds: new Set(selection.elementIds),
      relationshipIds: new Set(selection.relationshipIds),
      createdAt: now,
      lastSeenAt: now,
    };
    claims.set(claim.id, claim);
    this._notify({ op: "claim", workspaceName, payload: claim });
    return claim;
  }

  /**
   * Releases a claim early. No-op if the claim id is unknown (already
   * expired or released). Emits a "release" event with `payload` set to the
   * released claim.
   */
  release(claimId: string, workspaceName = "default"): void {
    const claims = this._claimsFor(workspaceName);
    const claim = claims.get(claimId);
    if (!claim) return;
    claims.delete(claimId);
    this._notify({ op: "release", workspaceName, payload: claim });
  }

  /**
   * Releases every claim currently held by `editorId` in a workspace — for
   * clean disconnect handling by the host application. Emits one "release"
   * event per claim released.
   */
  releaseAllClaimsFor(editorId: string, workspaceName = "default"): void {
    const claims = this._claimsFor(workspaceName);
    for (const [claimId, claim] of claims) {
      if (claim.editorId === editorId) {
        claims.delete(claimId);
        this._notify({ op: "release", workspaceName, payload: claim });
      }
    }
  }

  /**
   * Refreshes a claim's lastSeenAt to the current time, so it is not reaped
   * by expireStaleClaims. Throws if the claim id is unknown. Host
   * applications call this on whatever heartbeat cadence their own transport
   * uses — this library does not run its own timers.
   */
  touchClaim(claimId: string, workspaceName = "default"): void {
    const claim = this._claimsFor(workspaceName).get(claimId);
    if (!claim) {
      throw new Error(`Claim with id "${claimId}" not found in workspace "${workspaceName}".`);
    }
    claim.lastSeenAt = Date.now();
  }

  /**
   * Releases every claim in `workspaceName` whose lastSeenAt is older than
   * `maxAgeMs` (defaults to the value set via setClaimTtl). Returns the ids
   * of the claims that were released. The host application is responsible
   * for calling this periodically from its own scheduler — this library
   * never calls it automatically.
   */
  expireStaleClaims(workspaceName = "default", maxAgeMs?: number): string[] {
    const threshold = maxAgeMs ?? this._claimTtlMs;
    const now = Date.now();
    const expired: string[] = [];
    const claims = this._claimsFor(workspaceName);
    for (const [claimId, claim] of claims) {
      if (now - claim.lastSeenAt > threshold) {
        claims.delete(claimId);
        expired.push(claimId);
        this._notify({ op: "release", workspaceName, payload: claim });
      }
    }
    return expired;
  }

  /** Sets the default staleness threshold used by expireStaleClaims when no
   * explicit maxAgeMs is passed. */
  setClaimTtl(ms: number): void {
    this._claimTtlMs = ms;
  }

  /** Returns all currently active claims in a workspace. */
  getClaims(workspaceName = "default"): C4Claim[] {
    return Array.from(this._claimsFor(workspaceName).values());
  }

  /** Returns the active claim covering `elementId`, if any. */
  getClaimFor(elementId: string, workspaceName = "default"): C4Claim | undefined {
    for (const claim of this._claimsFor(workspaceName).values()) {
      if (claim.elementIds.has(elementId) || claim.relationshipIds.has(elementId)) {
        return claim;
      }
    }
    return undefined;
  }

  // ── Relationship Joint-Claim Proposals ────────────────

  /**
   * Proposes a relationship whose endpoints are claimed by two or more
   * different editors, at least one of which is not `proposerId`. Returns
   * the created C4RelationshipProposal; the relationship does NOT exist in
   * the workspace yet. `pendingApprovals` is the set of distinct editorIds
   * (other than proposerId) who own a claim covering either endpoint — every
   * one of them must call acceptRelationship before the relationship is
   * actually created. Throws if the relationship doesn't actually cross a
   * claim boundary requiring another editor's approval (use addRelationship
   * directly in that case). Emits a "proposeRelationship" event with
   * `payload` set to the created proposal.
   */
  proposeRelationship(
    rel: C4Relationship,
    proposerId: string,
    workspaceName = "default",
  ): C4RelationshipProposal {
    const sourceClaim = this.getClaimFor(rel.sourceId, workspaceName);
    const destinationClaim = this.getClaimFor(rel.destinationId, workspaceName);
    const pendingApprovals = new Set<string>();
    if (sourceClaim && sourceClaim.editorId !== proposerId)
      pendingApprovals.add(sourceClaim.editorId);
    if (destinationClaim && destinationClaim.editorId !== proposerId) {
      pendingApprovals.add(destinationClaim.editorId);
    }

    if (pendingApprovals.size === 0) {
      throw new Error(
        `Relationship "${rel.id}" does not cross a claim boundary in workspace "${workspaceName}"; use addRelationship() directly.`,
      );
    }

    const proposal: C4RelationshipProposal = {
      id: randomUUID(),
      relationship: rel,
      workspaceName,
      proposerId,
      pendingApprovals,
      createdAt: Date.now(),
    };
    this._proposalsFor(workspaceName).set(proposal.id, proposal);
    this._notify({ op: "proposeRelationship", workspaceName, payload: proposal });
    return proposal;
  }

  /**
   * Records `accepterId`'s approval of a pending proposal. Throws if
   * `accepterId` is not in the proposal's `pendingApprovals`, or if the
   * proposal id is unknown. Once every required approval has been recorded,
   * the relationship is created via the same path `addRelationship` uses
   * (so it raises the same validation and emits the normal "add" event for
   * the relationship), the proposal is deleted, and this method additionally
   * emits an "acceptRelationship" event with `payload` set to the
   * now-completed proposal.
   */
  acceptRelationship(proposalId: string, accepterId: string, workspaceName = "default"): void {
    const proposals = this._proposalsFor(workspaceName);
    const proposal = proposals.get(proposalId);
    if (!proposal) {
      throw new Error(
        `Relationship proposal with id "${proposalId}" not found in workspace "${workspaceName}".`,
      );
    }
    if (!proposal.pendingApprovals.has(accepterId)) {
      throw new Error(
        `Editor "${accepterId}" is not required to approve proposal "${proposalId}" in workspace "${workspaceName}".`,
      );
    }
    proposal.pendingApprovals.delete(accepterId);
    if (proposal.pendingApprovals.size === 0) {
      proposals.delete(proposalId);
      this._addRelationshipRaw(proposal.relationship, workspaceName);
      this._notify({ op: "acceptRelationship", workspaceName, payload: proposal });
    }
  }

  /**
   * Withdraws a pending proposal. Callable by the original proposer or by
   * any editor still listed in pendingApprovals. Throws if the proposal id
   * is unknown or the caller has no standing to reject it. Emits a
   * "rejectRelationship" event with `payload` set to the withdrawn proposal.
   */
  rejectRelationship(proposalId: string, editorId: string, workspaceName = "default"): void {
    const proposals = this._proposalsFor(workspaceName);
    const proposal = proposals.get(proposalId);
    if (!proposal) {
      throw new Error(
        `Relationship proposal with id "${proposalId}" not found in workspace "${workspaceName}".`,
      );
    }
    const hasStanding = editorId === proposal.proposerId || proposal.pendingApprovals.has(editorId);
    if (!hasStanding) {
      throw new Error(
        `Editor "${editorId}" has no standing to reject proposal "${proposalId}" in workspace "${workspaceName}".`,
      );
    }
    proposals.delete(proposalId);
    this._notify({ op: "rejectRelationship", workspaceName, payload: proposal });
  }

  /** Returns all pending relationship proposals in a workspace. */
  getRelationshipProposals(workspaceName = "default"): C4RelationshipProposal[] {
    return Array.from(this._proposalsFor(workspaceName).values());
  }

  // ── Branching & Merging ───────────────────────────────

  /**
   * Creates a new named workspace `newBranch` as a copy of `from`'s current
   * state, and records that state as the base revision for future
   * planMerge/applyMerge calls involving this branch. Throws if `newBranch`
   * already exists. Emits a "branch" event with `payload: { branch: newBranch, from }`.
   */
  branchWorkspace(from: string, newBranch: string): void {
    if (this._workspaces.has(newBranch)) {
      throw new Error(`Workspace with name "${newBranch}" already exists.`);
    }
    const snapshot = this.export(from);
    this._branchBase.set(newBranch, { parent: from, baseSnapshot: snapshot });
    this._captureLazySnapshot(newBranch, undefined);
    this._workspaces.set(newBranch, JSON.parse(snapshot) as C4Workspace);
    this._notify({ op: "branch", workspaceName: newBranch, payload: { branch: newBranch, from } });
  }

  /**
   * Computes a three-way comparison between `branch` and `into`, using the
   * base revision recorded when `branch` was created (NOT into's current
   * state) as the common ancestor — so changes made to `into` since the
   * branch point are correctly distinguished from changes made on `branch`.
   * `conflicts` lists every node/relationship id that changed on both sides
   * since the base revision. Throws if `branch` has no recorded base
   * revision (i.e. was never created via branchWorkspace).
   */
  planMerge(branch: string, into: string): C4MergePlan {
    const base = this._branchBase.get(branch);
    if (!base) {
      throw new Error(
        `Branch "${branch}" has no recorded base revision. Create it with branchWorkspace() before planning a merge.`,
      );
    }
    const baseWorkspace = JSON.parse(base.baseSnapshot) as C4Workspace;
    const branchChanges = diffWorkspaces(baseWorkspace, this.getWorkspace(branch));
    const targetChanges = diffWorkspaces(baseWorkspace, this.getWorkspace(into));

    const touchedIds = (diff: C4WorkspaceDiff): Set<string> => {
      const ids = new Set<string>();
      for (const node of diff.nodes.added) ids.add(node.id);
      for (const mod of diff.nodes.modified) ids.add(mod.id);
      for (const node of diff.nodes.removed) ids.add(node.id);
      for (const rel of diff.relationships.added) ids.add(rel.id);
      for (const mod of diff.relationships.modified) ids.add(mod.id);
      for (const rel of diff.relationships.removed) ids.add(rel.id);
      return ids;
    };

    const branchTouched = touchedIds(branchChanges);
    const targetTouched = touchedIds(targetChanges);
    const conflicts = Array.from(branchTouched).filter((id) => targetTouched.has(id));

    return { branch, into, branchChanges, targetChanges, conflicts };
  }

  /**
   * Applies `plan.branchChanges` onto workspace `into`. Throws immediately,
   * without applying anything, if `plan.conflicts` is non-empty — callers
   * must resolve conflicts (by editing one of the two workspaces and calling
   * planMerge again) before this will proceed. Applies each added, modified,
   * and removed node/relationship in `branchChanges` by dispatching through
   * the SAME public mutators used everywhere else in this file
   * (addPerson/addSoftwareSystem/addContainer/addComponent/addCodeElement/
   * addRelationship for additions; updateElement/updateRelationship for
   * modifications, applying only the fields listed in each diff entry's
   * `changes` array; removeElement for removals, guarding against an id that
   * was already removed via cascade) — do not hand-roll direct array
   * mutation. Wraps the whole operation in `this.batch(...)` so it is
   * atomic and rolls back cleanly if any step throws. Emits a "merge" event
   * with `payload` set to the applied plan after everything succeeds.
   *
   * Claim enforcement is honored here exactly like an interactive edit: the
   * plan applies under the reserved system identity `REGISTER_EDITOR`, so a
   * caller-supplied `C4MergePlan` cannot smuggle changes past active claims —
   * any change touching an element or relationship covered by someone else's
   * claim throws and the whole merge rolls back.
   */
  applyMerge(plan: C4MergePlan, into: string): void {
    if (plan.conflicts.length > 0) {
      throw new Error(
        `Cannot apply merge into "${into}": conflicting changes on: ${plan.conflicts.join(
          ", ",
        )}. Resolve conflicts and call planMerge() again before applyMerge().`,
      );
    }

    this.batch(() => {
      const added = [...plan.branchChanges.nodes.added].sort(
        (a, b) => KIND_DEPTH[a.kind] - KIND_DEPTH[b.kind],
      );
      for (const node of added) this._applyNodeAddition(node, into);
      for (const rel of plan.branchChanges.relationships.added) {
        this.addRelationship(rel, into, REGISTER_EDITOR);
      }
      for (const mod of plan.branchChanges.nodes.modified) {
        const patch: Record<string, any> = {};
        for (const key of mod.changes) patch[key] = (mod.after as any)[key];
        this.updateElement(mod.id, patch, into, REGISTER_EDITOR);
      }
      for (const mod of plan.branchChanges.relationships.modified) {
        const patch: Record<string, any> = {};
        for (const key of mod.changes) patch[key] = (mod.after as any)[key];
        this.updateRelationship(mod.id, patch, into, REGISTER_EDITOR);
      }
      for (const node of plan.branchChanges.nodes.removed) {
        if (findNodeWithAncestry(this.getWorkspace(into), node.id)) {
          this.removeElement(node.id, into, REGISTER_EDITOR);
        }
      }
      for (const rel of plan.branchChanges.relationships.removed) {
        const ws = this.getWorkspace(into);
        if (ws.relationships.some((r) => r.id === rel.id)) {
          this._assertClaimAllows(rel.id, REGISTER_EDITOR, into, "relationship");
          this._removeRelationship(into, rel.id);
        }
      }
      this._notify({ op: "merge", workspaceName: into, payload: plan });
    });
  }

  private _internalRelationshipIds(relationships: C4Relationship[], idSet: Set<string>): string[] {
    return relationships
      .filter((rel) => idSet.has(rel.sourceId) && idSet.has(rel.destinationId))
      .map((rel) => rel.id);
  }

  private _claimsFor(workspaceName: string): Map<string, C4Claim> {
    let map = this._claims.get(workspaceName);
    if (!map) {
      map = new Map();
      this._claims.set(workspaceName, map);
    }
    return map;
  }

  private _proposalsFor(workspaceName: string): Map<string, C4RelationshipProposal> {
    let map = this._relationshipProposals.get(workspaceName);
    if (!map) {
      map = new Map();
      this._relationshipProposals.set(workspaceName, map);
    }
    return map;
  }

  /**
   * Throws if `elementId` (or, when kind is "relationship", relationshipId)
   * is covered by an active claim held by an editor other than `editorId`.
   * Throws when `editorId` differs from the editor holding a claim on `id`.
   */
  private _assertClaimAllows(
    id: string,
    editorId: string,
    workspaceName: string,
    kind: "element" | "relationship",
  ): void {
    for (const claim of this._claimsFor(workspaceName).values()) {
      const covered =
        kind === "relationship" ? claim.relationshipIds.has(id) : claim.elementIds.has(id);
      if (covered && claim.editorId !== editorId) {
        const label = kind === "relationship" ? "Relationship" : "Element";
        throw new Error(
          `${label} with id "${id}" is claimed by editor "${claim.editorId}" in workspace "${workspaceName}".`,
        );
      }
    }
  }

  /** Absorbs a newly created element's id into the editor's claim on its parent. */
  private _absorbCreatedElement(
    parentId: string,
    createdId: string,
    editorId: string,
    workspaceName: string,
  ): void {
    const holder = this.getClaimFor(parentId, workspaceName);
    if (holder && holder.editorId === editorId) {
      holder.elementIds.add(createdId);
    }
  }

  /** Purges removed ids from every claim, auto-releasing claims left empty. */
  private _purgeRemovedFromClaims(
    removedIds: Set<string>,
    removedRelationshipIds: Set<string>,
    workspaceName: string,
  ): void {
    const claims = this._claims.get(workspaceName);
    if (!claims) return;
    for (const [claimId, claim] of claims) {
      for (const id of removedIds) claim.elementIds.delete(id);
      for (const id of removedRelationshipIds) claim.relationshipIds.delete(id);
      if (claim.elementIds.size === 0 && claim.relationshipIds.size === 0) {
        claims.delete(claimId);
        this._notify({ op: "release", workspaceName, payload: claim });
      }
    }
  }

  private _applyNodeAddition(node: C4Node, workspaceName: string): void {
    switch (node.kind) {
      case "Person":
        this.addPerson(node, workspaceName);
        break;
      case "SoftwareSystem":
        this.addSoftwareSystem(node, workspaceName);
        break;
      case "Container":
      case "Queue":
      case "Topic":
        this.addContainer(node as C4Container, workspaceName, REGISTER_EDITOR);
        break;
      case "Component":
        this.addComponent(node as C4Component, workspaceName, REGISTER_EDITOR);
        break;
      default:
        this.addCodeElement(node as C4CodeElement, workspaceName, REGISTER_EDITOR);
        break;
    }
  }

  private _removeRelationship(workspaceName: string, id: string): void {
    const ws = this.getWorkspace(workspaceName);
    ws.relationships = ws.relationships.filter((r) => r.id !== id);
    this._notify({
      op: "remove",
      workspaceName,
      elementId: id,
      elementKind: "Relationship",
      path: [],
    });
  }

  // ── Event History ─────────────────────────────────────────

  /** Configures the persistent event storage adapter. Pass `null` to detach it. */
  setEventStorage(storage: CfourEventStorage | null) {
    this._eventStorage = storage;
  }

  /** Returns the configured event storage adapter, if any. */
  getEventStorage(): CfourEventStorage | null {
    return this._eventStorage;
  }

  /**
   * Returns all logged events (newest last).
   * When an event storage adapter is configured, reads from it (async).
   * Otherwise reads from the in-memory ring buffer.
   */
  async getEventHistory(): Promise<CfourChangeEvent[]> {
    if (this._eventStorage) {
      return this._eventStorage.query({});
    }
    return [...this._eventLog];
  }

  /**
   * Returns the last `n` events.
   * When an event storage adapter is configured, reads from it (async).
   */
  async getRecentEvents(n: number): Promise<CfourChangeEvent[]> {
    if (this._eventStorage) {
      return this._eventStorage.query({ limit: n });
    }
    return this._eventLog.slice(-n);
  }

  /**
   * Queries the event history with filters.
   * Delegates to the event storage adapter when configured, otherwise filters the in-memory log.
   */
  async queryEventHistory(filter: CfourEventQuery): Promise<CfourChangeEvent[]> {
    if (this._eventStorage) {
      return this._eventStorage.query(filter);
    }
    let results = [...this._eventLog];
    if (filter.workspaceName)
      results = results.filter((e) => e.workspaceName === filter.workspaceName);
    if (filter.op) results = results.filter((e) => e.op === filter.op);
    if (filter.elementId) results = results.filter((e) => e.elementId === filter.elementId);
    if (filter.elementKind) results = results.filter((e) => e.elementKind === filter.elementKind);
    if (filter.since) results = results.filter((e) => (e.timestamp ?? 0) >= filter.since!);
    if (filter.until) results = results.filter((e) => (e.timestamp ?? 0) <= filter.until!);
    if (filter.offset) results = results.slice(filter.offset);
    if (filter.limit) results = results.slice(0, filter.limit);
    return results;
  }

  /**
   * Clears the in-memory event log and the persistent event storage (if configured).
   */
  async clearEventHistory(): Promise<void> {
    this._eventLog.length = 0;
    if (this._eventStorage) {
      await this._eventStorage.clear();
    }
  }

  /** Sets the maximum number of events retained in the in-memory log. Trims if current log exceeds the new limit. */
  setEventLogMax(max: number) {
    this._eventLogMax = max;
    if (this._eventLog.length > max) {
      this._eventLog.splice(0, this._eventLog.length - max);
    }
  }

  // ── Validation Engine ─────────────────────────────────────

  /**
   * Validates the integrity of the workspace.
   * Returns a list of errors found (dangling relationships, etc).
   */
  validate(
    workspaceName = "default",
  ): Array<{ id: string; message: string; severity: "error" | "warning" }> {
    const ws = this.getWorkspace(workspaceName);
    const flat = flattenWorkspace(ws);
    const nodeIds = new Set(flat.nodes.map((n) => n.id));
    const errors: Array<{ id: string; message: string; severity: "error" | "warning" }> = [];

    // Check relationships
    for (const rel of ws.relationships) {
      if (!nodeIds.has(rel.sourceId)) {
        errors.push({
          id: rel.id,
          message: `Dangling relationship: Source node "${rel.sourceId}" not found.`,
          severity: "error",
        });
      }
      if (!nodeIds.has(rel.destinationId)) {
        errors.push({
          id: rel.id,
          message: `Dangling relationship: Destination node "${rel.destinationId}" not found.`,
          severity: "error",
        });
      }
    }

    // Check for "empty" systems/containers
    for (const system of ws.softwareSystems) {
      if (!system.containers || system.containers.length === 0) {
        errors.push({
          id: system.id,
          message: `Software System "${system.name}" has no containers.`,
          severity: "warning",
        });
      }
    }

    return errors;
  }

  /**
   * Helper to register a framework "Building Block" as a Container.
   * If the "Framework" system doesn't exist, it is created.
   */
  addBuildingBlock(
    packageId: string,
    name: string,
    description?: string,
    technology?: string,
    workspaceName = "default",
  ) {
    const ws = this.getWorkspace(workspaceName);
    let frameworkSystem = ws.softwareSystems.find((s) => s.id === "framework");
    if (!frameworkSystem) {
      this.addSoftwareSystem(
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

    this.addContainer(
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
   * This can be called in a static block or via class metadata.
   */
  register(
    config: {
      id?: string;
      name?: string;
      description?: string;
      technology?: string;
      parentId?: string; // containerId or componentId
      kind?: C4ElementKind;
      workspaceName?: string;
    },
    className = this.constructor.name,
  ) {
    const workspaceName = config.workspaceName || "default";
    const id = config.id || className;
    const name = config.name || className;

    // Try to infer parent and kind
    if (config.kind === "Component" || (!config.kind && config.parentId)) {
      this.addComponent(
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
      this.addCodeElement(
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

  // ── Plan/Apply Generator Pipeline ─────────────────────────
  //
  // Two-workspace convention:
  //   - "desired" — the editable workspace. Humans (via GUI), scripts, and
  //     agents mutate ONLY this one, always inside `BaseCfour.batch(...)`.
  //   - "applied" — a snapshot of what was last successfully generated to
  //     disk. Only `planAndApply` is allowed to write to it, via
  //     `resetWorkspace` + `import(export(...))`, exactly as the existing
  //     import/export methods already support.
  //
  // The C4 workspace is the single source of truth for code generation.
  // Nothing outside this class ever writes generated files directly; all
  // writes flow through `planAndApply`, mirroring `terraform plan/apply`.

  // NOTE: deliberately a single static map shared by EVERY `BaseCfour`
  // subclass — one global architecture model, one global generator registry.
  // Unlike `beforeHooks`/`afterHooks` (which use `Object.hasOwn(this, ...)`
  // for per-subclass isolation), generator keys must be unique repo-wide, so
  // two subclasses share the same registry by design.
  private _generators: Map<string, Generator> = new Map();

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
  registerGenerator(key: string, gen: Generator): void {
    this._generators.set(key, gen);
  }

  /**
   * Resolves the most specific generator registered for a node.
   * Resolution order: stereotype match (when the node has a `stereotype`) >
   * technology match (when the node has a `technology`) > bare kind match.
   */
  resolveGenerator(node: C4Node): Generator | undefined {
    if ("stereotype" in node && node.stereotype) {
      const gen = this._generators.get(`${node.kind}:${node.stereotype}`);
      if (gen) return gen;
    }
    const technology = getTechnology(node);
    if (technology) {
      const gen = this._generators.get(`${node.kind}:${technology}`);
      if (gen) return gen;
    }
    return this._generators.get(node.kind);
  }

  /**
   * Derives a stable, readable, injective relationship id from its endpoints
   * and label. The label is slugified (spaces -> hyphens, punctuation dropped)
   * and a short sha256 digest of the full label is appended, so labels that
   * slugify to the same string ("uses-data" vs "uses  data", "Reads!" vs
   * "Reads?") never collide. Regenerating the same logical relationship from a
   * script/DSL always produces the same id, avoiding duplicate relationships
   * on re-apply.
   */
  deriveRelationshipId(sourceId: string, destinationId: string, label: string): string {
    const slug = label
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");
    const digest = createHash("sha256").update(label.trim()).digest("hex").slice(0, 8);
    const tail = slug ? `${slug}--${digest}` : digest;
    return `${sourceId}--${destinationId}--${tail}`;
  }

  /**
   * Returns the sha256 hex digest of a file's contents, or `""` when the file
   * does not exist. Only a missing file maps to `""` — any other read error
   * (permission, I/O) propagates so drift is never mistaken for a hand-edit.
   */
  async hashFile(path: string): Promise<string> {
    try {
      const data = await readFile(path);
      return createHash("sha256").update(data).digest("hex");
    } catch (e) {
      if ((e as { code?: string })?.code === "ENOENT") return "";
      throw e;
    }
  }

  /** Best-effort delete: ignores already-missing files, surfaces other errors. */
  async unlinkIfExists(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (e) {
      if ((e as { code?: string })?.code !== "ENOENT") throw e;
    }
  }

  /**
   * Returns the list of paths whose current on-disk hash no longer matches the
   * manifest's recorded hash (i.e. hand-edited since last generation).
   * Deleted files are reported as drift (missing files hash to `""`).
   */
  async detectDrift(entry: ManifestEntry): Promise<string[]> {
    const drifted: string[] = [];
    for (const [path, recordedHash] of Object.entries(entry.files)) {
      const currentHash = await this.hashFile(path);
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
  topoOrderForApply(diffResult: C4WorkspaceDiff, workspaceName = "desired"): C4Node[] {
    const touched = new Map<string, C4Node>();
    for (const node of diffResult.nodes.added) touched.set(node.id, node);
    for (const mod of diffResult.nodes.modified) touched.set(mod.after.id, mod.after);

    const dependsOn = new Map<string, Set<string>>();
    for (const id of touched.keys()) dependsOn.set(id, new Set());

    for (const rel of this.findRelationships({}, workspaceName)) {
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
   * returns. Aborted runs self-heal on retry: removals re-attempt `unlink`
   * and hit the swallowed `ENOENT`, and regenerated nodes are pure, so a
   * retry rewrites byte-identical content.
   *
   * Steps: validate ("desired") → diff ("applied" vs "desired") → remove files
   * for removed nodes → regenerate added/modified nodes in topological order
   * (honoring drift + `onDrift`) → commit.
   *
   * @param manifest The current `GenerationManifest` (persist it externally
   *   between runs — it is returned updated and must be stored by the caller).
   * @param options  Drift-handling callback.
   * @returns The updated manifest reflecting what is now on disk.
   */
  async planAndApply(
    manifest: GenerationManifest,
    options?: ApplyOptions,
  ): Promise<GenerationManifest> {
    // 1. Validate — hard stop on errors, warn-only on lint.
    const validation = this.validate("desired");
    const errors = validation.filter((v) => v.severity === "error");
    if (errors.length > 0) {
      throw new Error(
        `planAndApply aborted: "desired" workspace failed validation.\n${errors
          .map((e) => `  - [${e.id}] ${e.message}`)
          .join("\n")}`,
      );
    }
    for (const warning of this.lint(undefined, "desired")) {
      console.warn(`[planAndApply:lint] ${warning.message}`);
    }

    // 2. Plan.
    const diff = this.diff("applied", "desired");
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
        await this.unlinkIfExists(path);
      }
      delete nextManifest[node.id];
    }

    // 4. Apply additions/modifications in dependency order.
    for (const node of this.topoOrderForApply(diff, "desired")) {
      const existing = nextManifest[node.id];
      if (existing) {
        const driftedFiles = await this.detectDrift(existing);
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

      const gen = this.resolveGenerator(node);
      if (!gen) {
        console.warn(
          `[planAndApply] No generator for ${node.kind} "${node.id}"; skipping (partial coverage allowed)`,
        );
        continue;
      }

      const result = await gen({
        node,
        ancestors: this.getAncestors(node.id, "desired"),
        relationships: this.findRelationships({ sourceId: node.id }, "desired"),
      });

      const files: Record<string, string> = {};
      for (const path of result.filesWritten) {
        files[path] = await this.hashFile(path);
      }

      // Remove files the generator explicitly deleted, plus files this node
      // used to own but no longer writes (output set shrank). Without this,
      // old files drop out of the manifest but linger on disk as orphans.
      for (const path of result.filesDeleted) {
        await this.unlinkIfExists(path);
      }
      const previousFiles = existing ? Object.keys(existing.files) : [];
      for (const path of previousFiles) {
        if (!(path in files)) await this.unlinkIfExists(path);
      }

      nextManifest[node.id] = { elementId: node.id, files };
    }

    // 5. Commit — promote "desired" to "applied" only after everything above
    //    succeeded. On throw, "applied" remains the previous snapshot.
    this.resetWorkspace("applied");
    this.import(this.export("desired"), "applied");

    // 6. Return the updated manifest.
    return nextManifest;
  }

  /**
   * Dev-only helper for tests: runs `gen(ctx)` twice with the identical context
   * and throws a clear `Error` if the two runs differ in the set of written
   * paths or in the content of any written file — verifying the purity
   * contract required by `registerGenerator`.
   */
  async assertGeneratorIsPure(gen: Generator, ctx: GeneratorContext): Promise<void> {
    const first = await gen(ctx);

    // Snapshot the first run's output BEFORE running again — the second run
    // overwrites the same files on disk, so comparing after both runs would
    // compare each file with itself.
    const firstContent = new Map<string, string | null>();
    for (const path of first.filesWritten) {
      firstContent.set(path, await readFile(path, "utf8").catch(() => null));
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
      const secondContent = await readFile(path, "utf8").catch(() => null);
      if (firstContent.get(path) !== secondContent) {
        throw new Error(`Generator is not pure: content of "${path}" differs between runs.`);
      }
    }
  }

  // ── Static facade ────────────────────────────────────────
  // One shared model per process by default: every `BaseCfour.x()` static
  // delegates to this single default instance, preserving the classic
  // "one architecture model" behavior. Create your own instance with
  // `new BaseCfour()` when you need an isolated model (e.g. per editor).
  //
  // Forwarder signatures are derived from the instance methods via
  // `Parameters`/`ReturnType`, so they can never drift out of sync.

  private static _default = new BaseCfour();

  static reset(): void {
    BaseCfour._default.reset();
  }

  static subscribe(
    ...args: Parameters<_CFourInstance["subscribe"]>
  ): ReturnType<_CFourInstance["subscribe"]> {
    return BaseCfour._default.subscribe(...args);
  }

  static batch(...args: Parameters<_CFourInstance["batch"]>): ReturnType<_CFourInstance["batch"]> {
    return BaseCfour._default.batch(...args);
  }

  static resetWorkspace(
    ...args: Parameters<_CFourInstance["resetWorkspace"]>
  ): ReturnType<_CFourInstance["resetWorkspace"]> {
    return BaseCfour._default.resetWorkspace(...args);
  }

  static getWorkspace(
    ...args: Parameters<_CFourInstance["getWorkspace"]>
  ): ReturnType<_CFourInstance["getWorkspace"]> {
    return BaseCfour._default.getWorkspace(...args);
  }

  static getWorkspaceNames(
    ...args: Parameters<_CFourInstance["getWorkspaceNames"]>
  ): ReturnType<_CFourInstance["getWorkspaceNames"]> {
    return BaseCfour._default.getWorkspaceNames(...args);
  }

  static addPerson(
    ...args: Parameters<_CFourInstance["addPerson"]>
  ): ReturnType<_CFourInstance["addPerson"]> {
    return BaseCfour._default.addPerson(...args);
  }

  static addSoftwareSystem(
    ...args: Parameters<_CFourInstance["addSoftwareSystem"]>
  ): ReturnType<_CFourInstance["addSoftwareSystem"]> {
    return BaseCfour._default.addSoftwareSystem(...args);
  }

  static addContainer(
    ...args: Parameters<_CFourInstance["addContainer"]>
  ): ReturnType<_CFourInstance["addContainer"]> {
    return BaseCfour._default.addContainer(...args);
  }

  static addQueue(
    ...args: Parameters<_CFourInstance["addQueue"]>
  ): ReturnType<_CFourInstance["addQueue"]> {
    return BaseCfour._default.addQueue(...args);
  }

  static addTopic(
    ...args: Parameters<_CFourInstance["addTopic"]>
  ): ReturnType<_CFourInstance["addTopic"]> {
    return BaseCfour._default.addTopic(...args);
  }

  static addComponent(
    ...args: Parameters<_CFourInstance["addComponent"]>
  ): ReturnType<_CFourInstance["addComponent"]> {
    return BaseCfour._default.addComponent(...args);
  }

  static addCodeElement(
    ...args: Parameters<_CFourInstance["addCodeElement"]>
  ): ReturnType<_CFourInstance["addCodeElement"]> {
    return BaseCfour._default.addCodeElement(...args);
  }

  static addRelationship(
    ...args: Parameters<_CFourInstance["addRelationship"]>
  ): ReturnType<_CFourInstance["addRelationship"]> {
    return BaseCfour._default.addRelationship(...args);
  }

  static updateRelationship(
    ...args: Parameters<_CFourInstance["updateRelationship"]>
  ): ReturnType<_CFourInstance["updateRelationship"]> {
    return BaseCfour._default.updateRelationship(...args);
  }

  static updateElement(
    ...args: Parameters<_CFourInstance["updateElement"]>
  ): ReturnType<_CFourInstance["updateElement"]> {
    return BaseCfour._default.updateElement(...args);
  }

  static refreshNode(
    ...args: Parameters<_CFourInstance["refreshNode"]>
  ): ReturnType<_CFourInstance["refreshNode"]> {
    return BaseCfour._default.refreshNode(...args);
  }

  static removeElement(
    ...args: Parameters<_CFourInstance["removeElement"]>
  ): ReturnType<_CFourInstance["removeElement"]> {
    return BaseCfour._default.removeElement(...args);
  }

  static getSystemContextView(
    ...args: Parameters<_CFourInstance["getSystemContextView"]>
  ): ReturnType<_CFourInstance["getSystemContextView"]> {
    return BaseCfour._default.getSystemContextView(...args);
  }

  static getContainerView(
    ...args: Parameters<_CFourInstance["getContainerView"]>
  ): ReturnType<_CFourInstance["getContainerView"]> {
    return BaseCfour._default.getContainerView(...args);
  }

  static getComponentView(
    ...args: Parameters<_CFourInstance["getComponentView"]>
  ): ReturnType<_CFourInstance["getComponentView"]> {
    return BaseCfour._default.getComponentView(...args);
  }

  static getCodeView(
    ...args: Parameters<_CFourInstance["getCodeView"]>
  ): ReturnType<_CFourInstance["getCodeView"]> {
    return BaseCfour._default.getCodeView(...args);
  }

  static getTeamView(
    ...args: Parameters<_CFourInstance["getTeamView"]>
  ): ReturnType<_CFourInstance["getTeamView"]> {
    return BaseCfour._default.getTeamView(...args);
  }

  static getFlowView(
    ...args: Parameters<_CFourInstance["getFlowView"]>
  ): ReturnType<_CFourInstance["getFlowView"]> {
    return BaseCfour._default.getFlowView(...args);
  }

  static getFlowCatalog(
    ...args: Parameters<_CFourInstance["getFlowCatalog"]>
  ): ReturnType<_CFourInstance["getFlowCatalog"]> {
    return BaseCfour._default.getFlowCatalog(...args);
  }

  static diff(...args: Parameters<_CFourInstance["diff"]>): ReturnType<_CFourInstance["diff"]> {
    return BaseCfour._default.diff(...args);
  }

  static getLegend(
    ...args: Parameters<_CFourInstance["getLegend"]>
  ): ReturnType<_CFourInstance["getLegend"]> {
    return BaseCfour._default.getLegend(...args);
  }

  static lint(...args: Parameters<_CFourInstance["lint"]>): ReturnType<_CFourInstance["lint"]> {
    return BaseCfour._default.lint(...args);
  }

  static updateViewPosition(
    ...args: Parameters<_CFourInstance["updateViewPosition"]>
  ): ReturnType<_CFourInstance["updateViewPosition"]> {
    return BaseCfour._default.updateViewPosition(...args);
  }

  static saveView(
    ...args: Parameters<_CFourInstance["saveView"]>
  ): ReturnType<_CFourInstance["saveView"]> {
    return BaseCfour._default.saveView(...args);
  }

  static export(
    ...args: Parameters<_CFourInstance["export"]>
  ): ReturnType<_CFourInstance["export"]> {
    return BaseCfour._default.export(...args);
  }

  static import(
    ...args: Parameters<_CFourInstance["import"]>
  ): ReturnType<_CFourInstance["import"]> {
    return BaseCfour._default.import(...args);
  }

  static setStorage(
    ...args: Parameters<_CFourInstance["setStorage"]>
  ): ReturnType<_CFourInstance["setStorage"]> {
    return BaseCfour._default.setStorage(...args);
  }

  static saveSnapshot(
    ...args: Parameters<_CFourInstance["saveSnapshot"]>
  ): ReturnType<_CFourInstance["saveSnapshot"]> {
    return BaseCfour._default.saveSnapshot(...args);
  }

  static loadSnapshot(
    ...args: Parameters<_CFourInstance["loadSnapshot"]>
  ): ReturnType<_CFourInstance["loadSnapshot"]> {
    return BaseCfour._default.loadSnapshot(...args);
  }

  static deleteSnapshot(
    ...args: Parameters<_CFourInstance["deleteSnapshot"]>
  ): ReturnType<_CFourInstance["deleteSnapshot"]> {
    return BaseCfour._default.deleteSnapshot(...args);
  }

  static listSnapshots(
    ...args: Parameters<_CFourInstance["listSnapshots"]>
  ): ReturnType<_CFourInstance["listSnapshots"]> {
    return BaseCfour._default.listSnapshots(...args);
  }

  static findNodes(
    ...args: Parameters<_CFourInstance["findNodes"]>
  ): ReturnType<_CFourInstance["findNodes"]> {
    return BaseCfour._default.findNodes(...args);
  }

  static findRelationships(
    ...args: Parameters<_CFourInstance["findRelationships"]>
  ): ReturnType<_CFourInstance["findRelationships"]> {
    return BaseCfour._default.findRelationships(...args);
  }

  static getAncestors(
    ...args: Parameters<_CFourInstance["getAncestors"]>
  ): ReturnType<_CFourInstance["getAncestors"]> {
    return BaseCfour._default.getAncestors(...args);
  }

  static getDescendants(
    ...args: Parameters<_CFourInstance["getDescendants"]>
  ): ReturnType<_CFourInstance["getDescendants"]> {
    return BaseCfour._default.getDescendants(...args);
  }

  static getSubtree(
    ...args: Parameters<_CFourInstance["getSubtree"]>
  ): ReturnType<_CFourInstance["getSubtree"]> {
    return BaseCfour._default.getSubtree(...args);
  }

  static getSelection(
    ...args: Parameters<_CFourInstance["getSelection"]>
  ): ReturnType<_CFourInstance["getSelection"]> {
    return BaseCfour._default.getSelection(...args);
  }

  static claim(...args: Parameters<_CFourInstance["claim"]>): ReturnType<_CFourInstance["claim"]> {
    return BaseCfour._default.claim(...args);
  }

  static release(
    ...args: Parameters<_CFourInstance["release"]>
  ): ReturnType<_CFourInstance["release"]> {
    return BaseCfour._default.release(...args);
  }

  static releaseAllClaimsFor(
    ...args: Parameters<_CFourInstance["releaseAllClaimsFor"]>
  ): ReturnType<_CFourInstance["releaseAllClaimsFor"]> {
    return BaseCfour._default.releaseAllClaimsFor(...args);
  }

  static touchClaim(
    ...args: Parameters<_CFourInstance["touchClaim"]>
  ): ReturnType<_CFourInstance["touchClaim"]> {
    return BaseCfour._default.touchClaim(...args);
  }

  static expireStaleClaims(
    ...args: Parameters<_CFourInstance["expireStaleClaims"]>
  ): ReturnType<_CFourInstance["expireStaleClaims"]> {
    return BaseCfour._default.expireStaleClaims(...args);
  }

  static setClaimTtl(
    ...args: Parameters<_CFourInstance["setClaimTtl"]>
  ): ReturnType<_CFourInstance["setClaimTtl"]> {
    return BaseCfour._default.setClaimTtl(...args);
  }

  static getClaims(
    ...args: Parameters<_CFourInstance["getClaims"]>
  ): ReturnType<_CFourInstance["getClaims"]> {
    return BaseCfour._default.getClaims(...args);
  }

  static getClaimFor(
    ...args: Parameters<_CFourInstance["getClaimFor"]>
  ): ReturnType<_CFourInstance["getClaimFor"]> {
    return BaseCfour._default.getClaimFor(...args);
  }

  static proposeRelationship(
    ...args: Parameters<_CFourInstance["proposeRelationship"]>
  ): ReturnType<_CFourInstance["proposeRelationship"]> {
    return BaseCfour._default.proposeRelationship(...args);
  }

  static acceptRelationship(
    ...args: Parameters<_CFourInstance["acceptRelationship"]>
  ): ReturnType<_CFourInstance["acceptRelationship"]> {
    return BaseCfour._default.acceptRelationship(...args);
  }

  static rejectRelationship(
    ...args: Parameters<_CFourInstance["rejectRelationship"]>
  ): ReturnType<_CFourInstance["rejectRelationship"]> {
    return BaseCfour._default.rejectRelationship(...args);
  }

  static getRelationshipProposals(
    ...args: Parameters<_CFourInstance["getRelationshipProposals"]>
  ): ReturnType<_CFourInstance["getRelationshipProposals"]> {
    return BaseCfour._default.getRelationshipProposals(...args);
  }

  static branchWorkspace(
    ...args: Parameters<_CFourInstance["branchWorkspace"]>
  ): ReturnType<_CFourInstance["branchWorkspace"]> {
    return BaseCfour._default.branchWorkspace(...args);
  }

  static planMerge(
    ...args: Parameters<_CFourInstance["planMerge"]>
  ): ReturnType<_CFourInstance["planMerge"]> {
    return BaseCfour._default.planMerge(...args);
  }

  static applyMerge(
    ...args: Parameters<_CFourInstance["applyMerge"]>
  ): ReturnType<_CFourInstance["applyMerge"]> {
    return BaseCfour._default.applyMerge(...args);
  }

  static setEventStorage(
    ...args: Parameters<_CFourInstance["setEventStorage"]>
  ): ReturnType<_CFourInstance["setEventStorage"]> {
    return BaseCfour._default.setEventStorage(...args);
  }

  static getEventStorage(
    ...args: Parameters<_CFourInstance["getEventStorage"]>
  ): ReturnType<_CFourInstance["getEventStorage"]> {
    return BaseCfour._default.getEventStorage(...args);
  }

  static getEventHistory(
    ...args: Parameters<_CFourInstance["getEventHistory"]>
  ): ReturnType<_CFourInstance["getEventHistory"]> {
    return BaseCfour._default.getEventHistory(...args);
  }

  static getRecentEvents(
    ...args: Parameters<_CFourInstance["getRecentEvents"]>
  ): ReturnType<_CFourInstance["getRecentEvents"]> {
    return BaseCfour._default.getRecentEvents(...args);
  }

  static queryEventHistory(
    ...args: Parameters<_CFourInstance["queryEventHistory"]>
  ): ReturnType<_CFourInstance["queryEventHistory"]> {
    return BaseCfour._default.queryEventHistory(...args);
  }

  static clearEventHistory(
    ...args: Parameters<_CFourInstance["clearEventHistory"]>
  ): ReturnType<_CFourInstance["clearEventHistory"]> {
    return BaseCfour._default.clearEventHistory(...args);
  }

  static setEventLogMax(
    ...args: Parameters<_CFourInstance["setEventLogMax"]>
  ): ReturnType<_CFourInstance["setEventLogMax"]> {
    return BaseCfour._default.setEventLogMax(...args);
  }

  static validate(
    ...args: Parameters<_CFourInstance["validate"]>
  ): ReturnType<_CFourInstance["validate"]> {
    return BaseCfour._default.validate(...args);
  }

  static addBuildingBlock(
    ...args: Parameters<_CFourInstance["addBuildingBlock"]>
  ): ReturnType<_CFourInstance["addBuildingBlock"]> {
    return BaseCfour._default.addBuildingBlock(...args);
  }

  static register(config: Parameters<_CFourInstance["register"]>[0]) {
    // `this.name` captures the calling class (used by subclass static blocks)
    // so id/name inference from the class name keeps working through the facade.
    return BaseCfour._default.register(config, this.name);
  }

  static registerGenerator(
    ...args: Parameters<_CFourInstance["registerGenerator"]>
  ): ReturnType<_CFourInstance["registerGenerator"]> {
    return BaseCfour._default.registerGenerator(...args);
  }

  static resolveGenerator(
    ...args: Parameters<_CFourInstance["resolveGenerator"]>
  ): ReturnType<_CFourInstance["resolveGenerator"]> {
    return BaseCfour._default.resolveGenerator(...args);
  }

  static deriveRelationshipId(
    ...args: Parameters<_CFourInstance["deriveRelationshipId"]>
  ): ReturnType<_CFourInstance["deriveRelationshipId"]> {
    return BaseCfour._default.deriveRelationshipId(...args);
  }

  static hashFile(
    ...args: Parameters<_CFourInstance["hashFile"]>
  ): ReturnType<_CFourInstance["hashFile"]> {
    return BaseCfour._default.hashFile(...args);
  }

  static unlinkIfExists(
    ...args: Parameters<_CFourInstance["unlinkIfExists"]>
  ): ReturnType<_CFourInstance["unlinkIfExists"]> {
    return BaseCfour._default.unlinkIfExists(...args);
  }

  static detectDrift(
    ...args: Parameters<_CFourInstance["detectDrift"]>
  ): ReturnType<_CFourInstance["detectDrift"]> {
    return BaseCfour._default.detectDrift(...args);
  }

  static topoOrderForApply(
    ...args: Parameters<_CFourInstance["topoOrderForApply"]>
  ): ReturnType<_CFourInstance["topoOrderForApply"]> {
    return BaseCfour._default.topoOrderForApply(...args);
  }

  static planAndApply(
    ...args: Parameters<_CFourInstance["planAndApply"]>
  ): ReturnType<_CFourInstance["planAndApply"]> {
    return BaseCfour._default.planAndApply(...args);
  }

  static assertGeneratorIsPure(
    ...args: Parameters<_CFourInstance["assertGeneratorIsPure"]>
  ): ReturnType<_CFourInstance["assertGeneratorIsPure"]> {
    return BaseCfour._default.assertGeneratorIsPure(...args);
  }
}

type _CFourInstance = InstanceType<typeof BaseCfour>;

// C4 model

export type C4ElementKind =
  | "Person"
  | "SoftwareSystem"
  | "Container"
  | "Queue"
  | "Topic"
  | "Component"
  | "Class"
  | "Interface"
  | "AbstractClass"
  | "Enum"
  | "Function"
  | "Table"
  | "Object";

/** Subset of C4ElementKind that represents Level 4 code elements. */
export type C4CodeElementKind =
  | "Class"
  | "Interface"
  | "AbstractClass"
  | "Enum"
  | "Function"
  | "Table"
  | "Object";

export type C4RelationshipKind = "Relationship";

export type Technology = string; // e.g. "React", "PostgreSQL", "REST"

/** An arbitrary tag used for filtering / styling. */
export type Tag = string;

// ----------------------------------------------------------------
// Change Events — fine-grained notification payload
// ----------------------------------------------------------------

export interface CfourChangeEvent {
  /** The operation that triggered this event. */
  op:
    | "add"
    | "update"
    | "remove"
    | "reset"
    | "import"
    | "claim"
    | "release"
    | "branch"
    | "merge"
    | "proposeRelationship"
    | "acceptRelationship"
    | "rejectRelationship";
  /** The workspace that was mutated. */
  workspaceName: string;
  /** The id of the changed node (present for add/update/remove). */
  elementId?: string;
  /** The kind of the changed node (present for add/update/remove). */
  elementKind?: C4ElementKind | "Relationship";
  /** Ancestry from workspace root down to this element (ids only). Empty for top-level elements. */
  path?: string[];
  /** Snapshot of the node before mutation (present for update). */
  before?: C4Node;
  /** Snapshot of the node after mutation (present for update). */
  after?: C4Node;
  /** Property names that changed (reuses getObjectChanges output, present for update). */
  changes?: string[];
  /**
   * Payload for collaboration events (claim/release/branch/merge/
   * proposeRelationship/acceptRelationship/rejectRelationship). Lets
   * subscribers see what happened without a follow-up call. Never set by the
   * core add/update/remove/reset/import ops.
   */
  payload?: C4Claim | C4RelationshipProposal | C4MergePlan | { branch: string; from: string };
  /**
   * All descendants removed along with the element, in leaves-first order
   * (code elements before components before containers before systems).
   * Present only for `remove` events when the element had children.
   * Includes cascade-removed relationships in a separate `relationships` array.
   */
  removedDescendants?: {
    nodes: C4Node[];
    relationships: C4Relationship[];
  };
  /** Millisecond timestamp (UTC). Added automatically by `_logEvent`. */
  timestamp?: number;
}

// ----------------------------------------------------------------
// Storage — platform-agnostic persistence interface
// ----------------------------------------------------------------

export interface CfourStorage {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// ----------------------------------------------------------------
// Event Storage — persistent event log adapter
// ----------------------------------------------------------------

export interface CfourEventQuery {
  workspaceName?: string;
  op?: CfourChangeEvent["op"];
  elementId?: string;
  elementKind?: C4ElementKind | "Relationship";
  since?: number;
  until?: number;
  limit?: number;
  offset?: number;
}

export interface CfourEventStorage {
  append(event: CfourChangeEvent): Promise<void>;
  query(filter: CfourEventQuery): Promise<CfourChangeEvent[]>;
  clear(): Promise<void>;
}

// ----------------------------------------------------------------
// Base element — every C4 node extends this
// ----------------------------------------------------------------

export interface C4Element {
  /** Unique identifier within the workspace. */
  id: string;
  /** Short, display name. */
  name: string;
  /** One-liner that answers "what does this do?". */
  description?: string;
  /** The team or individual that owns this element. */
  owner?: string;
  /**
   * Reference to an icon from any icon library.
   * Can be a name (e.g. "lucide:database"), a URL, or raw SVG data.
   */
  icon?: string;
  /** Freeform tags for filtering and custom styling. */
  tags?: Tag[];
  /** Arbitrary key-value metadata (links, owners, SLAs, …). */
  metadata?: Record<string, string>;
}

// ----------------------------------------------------------------
// Level 1 — Person
// A human user (internal or external) that interacts with the system.
// ----------------------------------------------------------------

export interface C4Person extends C4Element {
  kind: "Person";
  /** True when the person is outside the organisation boundary. */
  external?: boolean;
}

// ----------------------------------------------------------------
// Level 1 — Software System
// The highest-level abstraction: a system you are describing or
// one it depends on.
// ----------------------------------------------------------------

export interface C4SoftwareSystem extends C4Element {
  kind: "SoftwareSystem";
  /** True when this system is owned by a third party / out of scope. */
  external?: boolean;
  /** Containers that live inside this system (populated at Level 2). */
  containers?: C4Container[];
}

// ----------------------------------------------------------------
// Level 2 — Container
// A deployable / runnable unit: web app, API, DB, queue, etc.
// NOT a Docker container — it's a C4 architectural unit.
// ----------------------------------------------------------------

export interface C4Container extends C4Element {
  kind: "Container" | "Queue" | "Topic";
  /** The software system this container belongs to. */
  systemId: string;
  /** Primary technology choice, e.g. "Spring Boot", "React SPA". */
  technology?: Technology;
  /** Components that live inside this container (populated at Level 3). */
  components?: C4Component[];
}

// ----------------------------------------------------------------
// Level 3 — Component
// A grouping of related functionality within a container
// (service, repository, controller, …).
// ----------------------------------------------------------------

export interface C4Component extends C4Element {
  kind: "Component";
  /** The container this component belongs to. */
  containerId: string;
  /** Implementation technology, e.g. "Spring MVC @RestController". */
  technology?: Technology;
  /** Free-form text: plain-language intent or pseudocode/snippet for implementation. */
  behavior?: string;
  /** Code elements that implement this component (Level 4). */
  codeElements?: C4CodeElement[];
}

// ----------------------------------------------------------------
// Level 4 — Code
// Individual code constructs inside a component: classes, interfaces,
// functions, DB tables, etc.  Relationships at this level model
// inheritance, implementation, association, and dependency.
// ----------------------------------------------------------------

export type C4MemberVisibility = "public" | "protected" | "private" | "package";
export type C4MemberKind = "field" | "method" | "constructor" | "property";

/** A single field, method, or constructor on a class-like element. */
export interface C4CodeMember {
  name: string;
  /** Return type (methods) or field type. */
  type?: string;
  visibility?: C4MemberVisibility;
  isStatic?: boolean;
  isAbstract?: boolean;
  kind: C4MemberKind;
  /**
   * Parameter list in a compact string form, e.g. "(userId: string, options?: Options)".
   * Only meaningful for method / constructor members.
   */
  parameters?: string;
  /** Stereotype label shown on the diagram, e.g. "@Inject", "<<PK>>". */
  stereotype?: string;
}

/**
 * A code-level element — the atom of the Level 4 diagram.
 * Relationships between code elements use the standard C4Relationship
 * type with `codeRelationshipKind` as a discriminant for arrow styles.
 */
export interface C4CodeElement extends C4Element {
  kind: C4CodeElementKind;
  /** The component this code element belongs to. */
  componentId: string;
  /** Implementation language / framework hint, e.g. "Java", "TypeScript". */
  technology?: Technology;
  /** Stereotype shown in guillemets, e.g. "<<entity>>", "@Repository". */
  stereotype?: string;
  /** Free-form text: plain-language intent or pseudocode/snippet for implementation. */
  behavior?: string;
  /** Fields, methods, constructors. */
  members?: C4CodeMember[];
  /** Namespace / package / module path, e.g. "com.bank.accounts". */
  namespace?: string;
}

/**
 * The kind of structural relationship between two code elements.
 * Determines arrow style on a UML-style code diagram.
 *
 *  - `Extends`       solid line + hollow triangle   (inheritance)
 *  - `Implements`    dashed line + hollow triangle  (interface impl)
 *  - `Aggregates`    solid line + hollow diamond    (has-a, lifecycle independent)
 *  - `Composes`      solid line + filled diamond    (has-a, lifecycle dependent)
 *  - `Associates`    solid line + open arrow        (general association)
 *  - `Depends`       dashed line + open arrow       (uses / dependency)
 *  - `Realizes`      dashed line + hollow triangle  (realisation — same as Implements in many tools)
 */
export type C4CodeRelationshipKind =
  | "Extends"
  | "Implements"
  | "Aggregates"
  | "Composes"
  | "Associates"
  | "Depends"
  | "Realizes";

// ----------------------------------------------------------------
// Relationship — a directed link between any two C4 elements.
// ----------------------------------------------------------------

export interface C4Relationship {
  id: string;
  kind: C4RelationshipKind;
  /** Source element id. */
  sourceId: string;
  /** Destination element id. */
  destinationId: string;
  /** What the interaction does, e.g. "Reads customer data from". */
  description?: string;
  /** Protocol / technology used, e.g. "HTTPS/JSON", "JDBC". */
  technology?: Technology;
  /** "sync" | "async" — useful for messaging relationships. */
  interactionStyle?: "sync" | "async";
  /**
   * When both endpoints are C4CodeElements, this narrows the structural
   * relationship kind for correct UML arrow rendering.
   */
  codeRelationshipKind?: C4CodeRelationshipKind;
  tags?: Tag[];
}

// ----------------------------------------------------------------
// Diffing — compare two workspaces
// ----------------------------------------------------------------

export interface C4DiffResult<T> {
  added: T[];
  removed: T[];
  modified: Array<{
    id: string;
    before: T;
    after: T;
    changes: string[]; // List of property names that changed
  }>;
}

export interface C4WorkspaceDiff {
  nodes: C4DiffResult<C4Node>;
  relationships: C4DiffResult<C4Relationship>;
}

// ----------------------------------------------------------------
// Collaborative editing — selections, claims, proposals, merges
// ----------------------------------------------------------------

/**
 * A flat set of element and relationship ids. Returned by getSubtree and
 * getSelection, and consumed by claim(). relationshipIds only ever contains
 * relationships that are fully internal to the selection (both endpoints
 * are also in elementIds) — a relationship crossing outside the selection
 * is never implicitly included.
 */
export interface C4Selection {
  elementIds: string[];
  relationshipIds: string[];
}

/**
 * Structured filter for getSelection. Intentionally identical in shape to
 * findNodes' filter — "intent" is expressed as the same tags/owner/
 * technology/search criteria the rest of the API already uses, not as
 * free text or graph expansion.
 */
export interface SelectionQuery {
  kind?: C4ElementKind;
  technology?: string;
  owner?: string;
  tags?: string[];
  search?: string;
}

/** An active claim over a C4Selection, held by a single editor. */
export interface C4Claim {
  id: string;
  editorId: string;
  workspaceName: string;
  elementIds: Set<string>;
  relationshipIds: Set<string>;
  createdAt: number;
  lastSeenAt: number;
}

/**
 * A pending request to create a relationship whose endpoints are claimed by
 * two (or more) different editors. Not yet part of the workspace — only
 * created once every entry in pendingApprovals has called
 * acceptRelationship.
 */
export interface C4RelationshipProposal {
  id: string;
  relationship: C4Relationship;
  workspaceName: string;
  proposerId: string;
  pendingApprovals: Set<string>;
  createdAt: number;
}

/** Result of planMerge — a reviewable three-way diff between a branch and
 * its merge target, computed against the branch's recorded base revision. */
export interface C4MergePlan {
  branch: string;
  into: string;
  /** What changed on `branch` since it was created, relative to the base
   * revision recorded at branch time. */
  branchChanges: C4WorkspaceDiff;
  /** What changed on `into` since the same base revision — i.e. what a
   * merge must not clobber. */
  targetChanges: C4WorkspaceDiff;
  /** Node or relationship ids touched on BOTH sides since the base
   * revision. Must be empty before applyMerge will proceed. */
  conflicts: string[];
}

// ----------------------------------------------------------------
// Generator pipeline — C4 workspace as single source of truth
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
 * output — see the purity contract on `BaseCfour.registerGenerator`.
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

/**
 * Compares two C4 workspaces and returns a structural diff.
 * Useful for visualizing changes between architecture versions.
 */
export function diffWorkspaces(before: C4Workspace, after: C4Workspace): C4WorkspaceDiff {
  const flatBefore = flattenWorkspace(before);
  const flatAfter = flattenWorkspace(after);

  const beforeNodes = buildNodeMap(flatBefore);
  const afterNodes = buildNodeMap(flatAfter);

  const beforeRels = new Map(flatBefore.relationships.map((r) => [r.id, r]));
  const afterRels = new Map(flatAfter.relationships.map((r) => [r.id, r]));

  const diffNodes: C4DiffResult<C4Node> = { added: [], removed: [], modified: [] };
  const diffRels: C4DiffResult<C4Relationship> = { added: [], removed: [], modified: [] };

  // Diff Nodes
  for (const [id, node] of afterNodes) {
    const prev = beforeNodes.get(id);
    if (!prev) {
      diffNodes.added.push(node);
    } else {
      const changes = getObjectChanges(prev, node);
      if (changes.length > 0) {
        diffNodes.modified.push({ id, before: prev, after: node, changes });
      }
    }
  }
  for (const id of beforeNodes.keys()) {
    if (!afterNodes.has(id)) {
      diffNodes.removed.push(beforeNodes.get(id)!);
    }
  }

  // Diff Relationships
  for (const [id, rel] of afterRels) {
    const prev = beforeRels.get(id);
    if (!prev) {
      diffRels.added.push(rel);
    } else {
      const changes = getObjectChanges(prev, rel);
      if (changes.length > 0) {
        diffRels.modified.push({ id, before: prev, after: rel, changes });
      }
    }
  }
  for (const id of beforeRels.keys()) {
    if (!afterRels.has(id)) {
      diffRels.removed.push(beforeRels.get(id)!);
    }
  }

  return { nodes: diffNodes, relationships: diffRels };
}

/**
 * Deep, key-order-insensitive comparison used by getObjectChanges. Object
 * property order is ignored, and an explicit `undefined` value is treated as
 * equivalent to an absent property (mirroring JSON.stringify, which omits
 * such keys) — so two objects differing only in key order or explicit
 * undefined values are not reported as changed.
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const aKeys = Object.keys(a);
  const bKeys = new Set(Object.keys(b));
  // Deliberately asymmetric handling of explicit-undefined vs absent keys, done
  // in BOTH directions: the first loop lets `k` be absent from b when a[k] is
  // undefined, the second lets `k` be absent from a when b[k] is undefined.
  // Neither loop is redundant — each covers the direction the other omits.
  for (const k of aKeys) {
    if (!bKeys.has(k) && a[k] !== undefined) return false;
    if (bKeys.has(k) && !deepEqual(a[k], b[k])) return false;
  }
  for (const k of bKeys) {
    if (!Object.prototype.hasOwnProperty.call(a, k) && b[k] !== undefined) return false;
  }
  return true;
}

/**
 * Returns the property names whose values differ between two snapshots of the
 * same node/relationship. Comparison is deep and key-order-insensitive; nested
 * children collections are skipped because they are handled by the flat
 * workspace diff.
 */
function getObjectChanges(obj1: any, obj2: any): string[] {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    // Skip nested children which are handled by the flat comparison
    if (["containers", "components", "codeElements", "members"].includes(key)) continue;

    const val1 = obj1[key];
    const val2 = obj2[key];

    if (!deepEqual(val1, val2)) {
      changes.push(key);
    }
  }
  return changes;
}

// ----------------------------------------------------------------
// Workspace — the root container for a complete C4 model
// ----------------------------------------------------------------

export interface C4Workspace {
  name: string;
  description?: string;
  /** All persons in scope. */
  people: C4Person[];
  /** All software systems (each may embed containers & components). */
  softwareSystems: C4SoftwareSystem[];
  /** All relationships between elements (any level). */
  relationships: C4Relationship[];
  /** Optional persisted views (includes layout positions). */
  views?: C4View[];
}

// ----------------------------------------------------------------
// Union helpers — useful for generic functions
// ----------------------------------------------------------------

/** Any node-like element in the C4 model. */
export type C4Node = C4Person | C4SoftwareSystem | C4Container | C4Component | C4CodeElement;

/** Everything in a C4 workspace, flattened. */
export interface C4FlatModel {
  nodes: C4Node[];
  relationships: C4Relationship[];
}

// ----------------------------------------------------------------
// View definitions — which elements appear on a given diagram
// ----------------------------------------------------------------

export type C4ViewKind =
  | "SystemContext" // Level 1 — one software system + neighbours
  | "Container" // Level 2 — containers inside one software system
  | "Component" // Level 3 — components inside one container
  | "Code" // Level 4 — code elements inside one component
  | "Dynamic" // Sequence / collaboration diagram
  | "Deployment"; // Runtime environment

export interface C4ViewElement {
  /** References an element id. */
  elementId: string;
  /** Override x position (optional — layout engine may set this). */
  x?: number;
  /** Override y position. */
  y?: number;
}

export interface C4ViewRelationship {
  relationshipId: string;
}

export interface C4View {
  id: string;
  kind: C4ViewKind;
  title?: string;
  description?: string;
  /** Which elements appear on this view. */
  elements: C4ViewElement[];
  /** Which relationships appear on this view. */
  relationships: C4ViewRelationship[];
  /** The "subject" of the view — system id for Container views, container id for Component views. */
  scopeId?: string;
}

// ReactFlow adapter
import type { Node, Edge, MarkerType } from "reactflow";

export interface C4NodeData {
  /** The original C4 element id. */
  c4Id: string;
  kind: C4ElementKind;
  name: string;
  description?: string;
  technology?: string;
  external?: boolean;
  owner?: string;
  icon?: string;
  tags?: string[];
  /** The parent element id (for grouped / nested layouts). */
  parentId?: string;
  /** Number of children this element has (containers for systems, components for containers, etc). */
  childCount?: number;
  /** Hint for UI that this node can be drilled into (Levels 1-3). */
  canDrill?: boolean;
  // ── Level 4 (Code) extras ──────────────────────────────────
  /** Populated only when kind is a C4CodeElementKind. */
  stereotype?: string;
  namespace?: string;
  members?: C4CodeMember[];
}

export type C4ReactFlowNode = Node<C4NodeData>;

// ----------------------------------------------------------------
// React Flow edge data payload
// ----------------------------------------------------------------

export interface C4EdgeData {
  /** The original C4 relationship id. */
  c4Id: string;
  description?: string;
  technology?: string;
  interactionStyle?: "sync" | "async";
  /**
   * Set when both endpoints are code elements; drives UML arrow style.
   * Use this in your custom edge renderer to switch between
   * inheritance triangles, composition diamonds, dependency dashes, etc.
   */
  codeRelationshipKind?: C4CodeRelationshipKind;
  tags?: string[];
}

export type C4ReactFlowEdge = Edge<C4EdgeData>;

// ----------------------------------------------------------------
// Adapter options
// ----------------------------------------------------------------

export interface C4ToReactFlowOptions {
  /**
   * Called for each node so callers can override position, style,
   * or any React Flow node property before it is returned.
   */
  nodeTransformer?: (node: C4ReactFlowNode, c4Element: C4Node) => C4ReactFlowNode;

  /**
   * Called for each edge so callers can override style, label,
   * or any React Flow edge property.
   */
  edgeTransformer?: (edge: C4ReactFlowEdge, c4Relationship: C4Relationship) => C4ReactFlowEdge;

  /**
   * Default node dimensions used as a starting point.
   * Individual nodeTransformer calls can still override these.
   */
  nodeDimensions?: Partial<Record<C4ElementKind, { width: number; height: number }>>;

  /**
   * When true, Container nodes are placed inside their SoftwareSystem
   * node using React Flow's `parentId` + `extent: "parent"` feature,
   * Component nodes inside their Container, and CodeElement nodes inside
   * their Component. Requires an auto-layout step or manual positions.
   * Default: false.
   */
  useParentNodes?: boolean;

  /**
   * Marker type for the arrow-head on edges.
   * Default: "arrowclosed"
   */
  edgeMarkerEnd?: MarkerType;
}

// ----------------------------------------------------------------
// Default dimension presets per C4 kind
// ----------------------------------------------------------------

const CODE_ELEMENT_KINDS = new Set<C4ElementKind>([
  "Class",
  "Interface",
  "AbstractClass",
  "Enum",
  "Function",
  "Table",
  "Object",
]);

const DEFAULT_DIMENSIONS: Record<C4ElementKind, { width: number; height: number }> = {
  Person: { width: 140, height: 120 },
  SoftwareSystem: { width: 200, height: 120 },
  Container: { width: 200, height: 100 },
  Queue: { width: 200, height: 100 },
  Topic: { width: 200, height: 100 },
  Component: { width: 180, height: 90 },
  // Level 4 — height is intentionally flexible; callers should override
  // based on member count. These are sensible starting points.
  Class: { width: 220, height: 160 },
  Interface: { width: 220, height: 120 },
  AbstractClass: { width: 220, height: 160 },
  Enum: { width: 180, height: 120 },
  Function: { width: 180, height: 80 },
  Table: { width: 220, height: 160 },
  Object: { width: 200, height: 120 },
};

// ----------------------------------------------------------------
// Helpers — extract technology from typed element
// ----------------------------------------------------------------

const CONTAINER_KINDS = new Set<C4ElementKind>(["Container", "Queue", "Topic"]);

/** Tree depth of each element kind — used to order additions so parents are created before children. */
const KIND_DEPTH: Record<C4ElementKind, number> = {
  Person: 0,
  SoftwareSystem: 0,
  Container: 1,
  Queue: 1,
  Topic: 1,
  Component: 2,
  Class: 3,
  Interface: 3,
  AbstractClass: 3,
  Enum: 3,
  Function: 3,
  Table: 3,
  Object: 3,
};

function getTechnology(el: C4Node): string | undefined {
  if (CONTAINER_KINDS.has(el.kind)) return (el as C4Container).technology;
  if (el.kind === "Component") return (el as C4Component).technology;
  if (CODE_ELEMENT_KINDS.has(el.kind)) return (el as C4CodeElement).technology;
  return undefined;
}

function getExternal(el: C4Node): boolean | undefined {
  if (el.kind === "Person") return (el as C4Person).external;
  if (el.kind === "SoftwareSystem") return (el as C4SoftwareSystem).external;
  return undefined;
}

function getParentId(el: C4Node): string | undefined {
  if (CONTAINER_KINDS.has(el.kind)) return (el as C4Container).systemId;
  if (el.kind === "Component") return (el as C4Component).containerId;
  if (CODE_ELEMENT_KINDS.has(el.kind)) return (el as C4CodeElement).componentId;
  return undefined;
}

/**
 * Walks the workspace tree to find a node by id and collects the ancestry
 * (system id, container id, component id, …) from root down to the node.
 */
function findNodeWithAncestry(
  ws: C4Workspace,
  id: string,
): { node: C4Node; path: string[] } | undefined {
  for (const person of ws.people) {
    if (person.id === id) return { node: person, path: [] };
  }
  for (const system of ws.softwareSystems) {
    if (system.id === id) return { node: system, path: [] };
    for (const container of system.containers ?? []) {
      if (container.id === id) return { node: container, path: [system.id] };
      for (const component of container.components ?? []) {
        if (component.id === id) return { node: component, path: [system.id, container.id] };
        for (const codeEl of component.codeElements ?? []) {
          if (codeEl.id === id)
            return { node: codeEl, path: [system.id, container.id, component.id] };
        }
      }
    }
  }
  return undefined;
}

/** Deep-clone a node for before/after snapshots. Uses JSON round-trip for runtime portability. */
function snapshotNode(node: C4Node): C4Node {
  return JSON.parse(JSON.stringify(node));
}

/**
 * Collects all descendants of a node in leaves-first order.
 * Used by removeElement to populate `removedDescendants` in the change event.
 */
function collectDescendants(node: C4Node): C4Node[] {
  const result: C4Node[] = [];
  if (node.kind === "SoftwareSystem") {
    for (const container of (node as C4SoftwareSystem).containers ?? []) {
      result.push(...collectDescendants(container));
      result.push(container);
    }
  } else if (CONTAINER_KINDS.has(node.kind)) {
    for (const component of (node as C4Container).components ?? []) {
      result.push(...collectDescendants(component));
      result.push(component);
    }
  } else if (node.kind === "Component") {
    for (const codeEl of (node as C4Component).codeElements ?? []) {
      result.push(codeEl);
    }
  }
  return result;
}

function getCodeExtras(el: C4Node): Pick<C4NodeData, "stereotype" | "namespace" | "members"> {
  if (CODE_ELEMENT_KINDS.has(el.kind)) {
    const ce = el as C4CodeElement;
    return { stereotype: ce.stereotype, namespace: ce.namespace, members: ce.members };
  }
  return {};
}

function getChildCount(el: C4Node): number {
  if (el.kind === "SoftwareSystem") return (el as C4SoftwareSystem).containers?.length ?? 0;
  if (CONTAINER_KINDS.has(el.kind)) return (el as C4Container).components?.length ?? 0;
  if (el.kind === "Component") return (el as C4Component).codeElements?.length ?? 0;
  return 0;
}

function canDrill(el: C4Node): boolean {
  return el.kind === "SoftwareSystem" || CONTAINER_KINDS.has(el.kind) || el.kind === "Component";
}

/**
 * Checks if a node is a child of a given parent node (or any of the given parent nodes).
 */
function isDescendantOf(
  nodeMap: Map<string, C4Node>,
  parentIds: string | string[],
  nodeId: string,
): boolean {
  const targets = Array.isArray(parentIds) ? new Set(parentIds) : new Set([parentIds]);
  let currentId: string | undefined = nodeId;
  while (currentId) {
    const parent = getParentId(nodeMap.get(currentId)!);
    if (!parent) break;
    if (targets.has(parent)) return true;
    currentId = parent;
  }
  return false;
}

/**
 * Finds the highest visible ancestor of a node that is present in a set of allowed IDs.
 */
function getVisibleAncestor(
  nodeMap: Map<string, C4Node>,
  allowedIds: Set<string>,
  nodeId: string,
): string | undefined {
  if (allowedIds.has(nodeId)) return nodeId;
  let currentId: string | undefined = nodeId;
  while (currentId) {
    const parent = getParentId(nodeMap.get(currentId)!);
    if (!parent) break;
    if (allowedIds.has(parent)) return parent;
    currentId = parent;
  }
  return undefined;
}

// ----------------------------------------------------------------
// Flatten workspace into a map of all elements (id → C4Node)
// ----------------------------------------------------------------

export function flattenWorkspace(workspace: C4Workspace): C4FlatModel {
  const nodes: C4Node[] = [];

  for (const person of workspace.people) {
    nodes.push(person);
  }

  for (const system of workspace.softwareSystems) {
    nodes.push(system);
    for (const container of system.containers ?? []) {
      nodes.push(container);
      for (const component of container.components ?? []) {
        nodes.push(component);
        for (const codeEl of component.codeElements ?? []) {
          nodes.push(codeEl);
        }
      }
    }
  }

  return { nodes, relationships: workspace.relationships };
}

// ----------------------------------------------------------------
// Build a lookup map from a flat model
// ----------------------------------------------------------------

function buildNodeMap(flat: C4FlatModel): Map<string, C4Node> {
  return new Map(flat.nodes.map((n) => [n.id, n]));
}

// ----------------------------------------------------------------
// Core adapter
// ----------------------------------------------------------------

/**
 * Converts a C4 workspace + an optional view filter into React Flow
 * `nodes` and `edges` arrays ready to pass to `<ReactFlow />`.
 *
 * @param workspace  The full C4 workspace.
 * @param view       Optional view definition — when provided only
 *                   elements / relationships listed in the view are
 *                   included.  When omitted, every element is included.
 * @param options    Adapter configuration.
 */
export function c4ToReactFlow(
  workspace: C4Workspace,
  view?: C4View,
  options: C4ToReactFlowOptions = {},
): { nodes: C4ReactFlowNode[]; edges: C4ReactFlowEdge[] } {
  const {
    nodeTransformer,
    edgeTransformer,
    nodeDimensions = {},
    useParentNodes = false,
    edgeMarkerEnd = "arrowclosed" as MarkerType,
  } = options;

  const flat = flattenWorkspace(workspace);
  const nodeMap = buildNodeMap(flat);

  // Determine which element ids and relationship ids to include
  const includedElementIds: Set<string> = view
    ? new Set(view.elements.map((ve) => ve.elementId))
    : new Set(flat.nodes.map((n) => n.id));

  const viewElementPositions: Map<string, { x: number; y: number }> = view
    ? new Map(
        view.elements
          .filter((ve) => ve.x !== undefined && ve.y !== undefined)
          .map((ve) => [ve.elementId, { x: ve.x!, y: ve.y! }]),
      )
    : new Map();

  const includedRelIds: Set<string> = view
    ? new Set(view.relationships.map((vr) => vr.relationshipId))
    : new Set(flat.relationships.map((r) => r.id));

  // ── Build nodes ──────────────────────────────────────────────

  const rfNodes: C4ReactFlowNode[] = [];
  let autoX = 0;

  for (const [id, el] of nodeMap) {
    if (!includedElementIds.has(id)) continue;

    const dims = {
      ...DEFAULT_DIMENSIONS[el.kind],
      ...nodeDimensions[el.kind],
    };

    const position = viewElementPositions.get(id) ?? { x: autoX, y: 0 };
    autoX += dims.width + 40; // naive linear auto-layout fallback

    const parentId =
      useParentNodes && getParentId(el) && includedElementIds.has(getParentId(el)!)
        ? getParentId(el)
        : undefined;

    let rfNode: C4ReactFlowNode = {
      id,
      type: el.kind, // callers register custom node types with the same names
      position,
      data: {
        c4Id: id,
        kind: el.kind,
        name: el.name,
        description: el.description,
        technology: getTechnology(el),
        external: getExternal(el),
        owner: el.owner,
        icon: el.icon,
        tags: el.tags,
        parentId,
        childCount: getChildCount(el),
        canDrill: canDrill(el),
        ...getCodeExtras(el),
      },
      width: dims.width,
      height: dims.height,
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    };

    if (nodeTransformer) {
      rfNode = nodeTransformer(rfNode, el);
    }

    rfNodes.push(rfNode);
  }

  // ── Build edges ──────────────────────────────────────────────

  const rfEdges: C4ReactFlowEdge[] = [];

  for (const rel of flat.relationships) {
    if (!includedRelIds.has(rel.id)) continue;

    // ROLL-UP LOGIC:
    // If the source or target of the relationship is not in the view,
    // we try to find the closest ancestor that IS in the view.
    const effectiveSourceId = getVisibleAncestor(nodeMap, includedElementIds, rel.sourceId);
    const effectiveTargetId = getVisibleAncestor(nodeMap, includedElementIds, rel.destinationId);

    // If either endpoint has no visible representation in this view, skip the edge
    if (!effectiveSourceId || !effectiveTargetId) continue;

    // If the roll-up results in a self-loop that wasn't there before,
    // we might want to skip it or show it depending on preference.
    // For now, we skip self-loops created by roll-up.
    if (effectiveSourceId === effectiveTargetId && rel.sourceId !== rel.destinationId) continue;

    const label = [rel.description, rel.technology].filter(Boolean).join("\n");

    let rfEdge: C4ReactFlowEdge = {
      id: rel.id,
      source: effectiveSourceId,
      target: effectiveTargetId,
      label: label || undefined,
      animated: rel.interactionStyle === "async",
      markerEnd: { type: edgeMarkerEnd },
      data: {
        c4Id: rel.id,
        description: rel.description,
        technology: rel.technology,
        interactionStyle: rel.interactionStyle,
        codeRelationshipKind: rel.codeRelationshipKind,
        tags: rel.tags,
      },
    };

    if (edgeTransformer) {
      rfEdge = edgeTransformer(rfEdge, rel);
    }

    rfEdges.push(rfEdge);
  }

  return { nodes: rfNodes, edges: rfEdges };
}

// ----------------------------------------------------------------
// Convenience: build a System Context view automatically
// (all persons + the target system + its direct neighbours)
// ----------------------------------------------------------------

export function buildSystemContextView(workspace: C4Workspace, systemId: string): C4View {
  const flat = flattenWorkspace(workspace);
  const nodeMap = buildNodeMap(flat);
  const relatedSystemIds = new Set<string>();

  // Find relationships that touch the target system or its descendants
  const viewRelIds: string[] = [];
  for (const rel of flat.relationships) {
    const isSourceTarget =
      rel.sourceId === systemId || isDescendantOf(nodeMap, systemId, rel.sourceId);
    const isDestTarget =
      rel.destinationId === systemId || isDescendantOf(nodeMap, systemId, rel.destinationId);

    if (isSourceTarget || isDestTarget) {
      viewRelIds.push(rel.id);

      // We need to find which "top-level" systems to include in the view
      // based on these deep relationships.
      const sourceAncestor = getVisibleAncestor(
        nodeMap,
        new Set(workspace.softwareSystems.map((s) => s.id)),
        rel.sourceId,
      );
      const destAncestor = getVisibleAncestor(
        nodeMap,
        new Set(workspace.softwareSystems.map((s) => s.id)),
        rel.destinationId,
      );

      if (sourceAncestor) relatedSystemIds.add(sourceAncestor);
      if (destAncestor) relatedSystemIds.add(destAncestor);
    }
  }

  // Always include all persons
  const personIds = workspace.people.map((p) => p.id);
  const elementIds = [...new Set([systemId, ...personIds, ...relatedSystemIds])];

  return {
    id: `system-context-${systemId}`,
    kind: "SystemContext",
    title: `System Context — ${workspace.softwareSystems.find((s) => s.id === systemId)?.name ?? systemId}`,
    scopeId: systemId,
    elements: elementIds.map((id) => ({ elementId: id })),
    relationships: viewRelIds.map((id) => ({ relationshipId: id })),
  };
}

// ----------------------------------------------------------------
// Convenience: build a Component view for a given container
// ----------------------------------------------------------------

export function buildComponentView(workspace: C4Workspace, containerId: string): C4View {
  const flat = flattenWorkspace(workspace);
  const componentIds = flat.nodes
    .filter((n) => n.kind === "Component" && (n as C4Component).containerId === containerId)
    .map((n) => n.id);

  const componentSet = new Set(componentIds);
  const viewRelIds: string[] = [];

  for (const rel of flat.relationships) {
    if (componentSet.has(rel.sourceId) || componentSet.has(rel.destinationId)) {
      viewRelIds.push(rel.id);
    }
  }

  const containerName = flat.nodes.find((n) => n.id === containerId)?.name ?? containerId;

  return {
    id: `component-${containerId}`,
    kind: "Component",
    title: `Components — ${containerName}`,
    scopeId: containerId,
    elements: componentIds.map((id) => ({ elementId: id })),
    relationships: viewRelIds.map((id) => ({ relationshipId: id })),
  };
}

// ----------------------------------------------------------------
// Convenience: build a Code view for a given component
// All C4CodeElement nodes inside the component + their relationships.
// ----------------------------------------------------------------

export function buildCodeView(workspace: C4Workspace, componentId: string): C4View {
  const flat = flattenWorkspace(workspace);

  const codeElementIds = flat.nodes
    .filter(
      (n) => CODE_ELEMENT_KINDS.has(n.kind) && (n as C4CodeElement).componentId === componentId,
    )
    .map((n) => n.id);

  const codeSet = new Set(codeElementIds);
  const viewRelIds: string[] = [];

  for (const rel of flat.relationships) {
    if (codeSet.has(rel.sourceId) && codeSet.has(rel.destinationId)) {
      viewRelIds.push(rel.id);
    }
  }

  const componentName = flat.nodes.find((n) => n.id === componentId)?.name ?? componentId;

  return {
    id: `code-${componentId}`,
    kind: "Code",
    title: `Code — ${componentName}`,
    scopeId: componentId,
    elements: codeElementIds.map((id) => ({ elementId: id })),
    relationships: viewRelIds.map((id) => ({ relationshipId: id })),
  };
}

// ----------------------------------------------------------------
// Convenience: build a Container view for a given software system
// ----------------------------------------------------------------

export function buildContainerView(workspace: C4Workspace, systemId: string): C4View {
  const flat = flattenWorkspace(workspace);
  const nodeMap = buildNodeMap(flat);

  const system = workspace.softwareSystems.find((s) => s.id === systemId);
  const internalContainerIds = (system?.containers ?? []).map((c) => c.id);
  const containerSet = new Set(internalContainerIds);

  const viewRelIds: string[] = [];
  const neighborIds = new Set<string>();

  for (const rel of flat.relationships) {
    const isSourceInternal =
      containerSet.has(rel.sourceId) ||
      isDescendantOf(nodeMap, Array.from(containerSet), rel.sourceId);
    const isDestInternal =
      containerSet.has(rel.destinationId) ||
      isDescendantOf(nodeMap, Array.from(containerSet), rel.destinationId);

    if (isSourceInternal || isDestInternal) {
      viewRelIds.push(rel.id);

      // Find visible neighbors (top-level systems or persons)
      const allowedNeighborKinds = new Set(["SoftwareSystem", "Person"]);
      const neighborCandidateIds = new Set(
        flat.nodes.filter((n) => allowedNeighborKinds.has(n.kind)).map((n) => n.id),
      );

      const sourceVisible = getVisibleAncestor(
        nodeMap,
        new Set([...internalContainerIds, ...neighborCandidateIds]),
        rel.sourceId,
      );
      const destVisible = getVisibleAncestor(
        nodeMap,
        new Set([...internalContainerIds, ...neighborCandidateIds]),
        rel.destinationId,
      );

      if (sourceVisible && !containerSet.has(sourceVisible)) neighborIds.add(sourceVisible);
      if (destVisible && !containerSet.has(destVisible)) neighborIds.add(destVisible);
    }
  }

  const elementIds = [...internalContainerIds, ...Array.from(neighborIds)];

  return {
    id: `container-${systemId}`,
    kind: "Container",
    title: `Containers — ${system?.name ?? systemId}`,
    scopeId: systemId,
    elements: elementIds.map((id) => ({ elementId: id })),
    relationships: viewRelIds.map((id) => ({ relationshipId: id })),
  };
}

/**
 * Convenience: build a Team view for a given team.
 * Includes all nodes owned by the team and their direct neighbors.
 */
export function buildTeamView(workspace: C4Workspace, teamName: string): C4View {
  const flat = flattenWorkspace(workspace);
  const ownedNodeIds = new Set(flat.nodes.filter((n) => n.owner === teamName).map((n) => n.id));

  const elementIds = new Set<string>(ownedNodeIds);
  const relationshipIds = new Set<string>();

  for (const rel of flat.relationships) {
    const isSourceOwned = ownedNodeIds.has(rel.sourceId);
    const isDestOwned = ownedNodeIds.has(rel.destinationId);

    if (isSourceOwned || isDestOwned) {
      relationshipIds.add(rel.id);
      elementIds.add(rel.sourceId);
      elementIds.add(rel.destinationId);
    }
  }

  return {
    id: `team-${teamName.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "Dynamic", // Team views are dynamic perspectives
    title: `Team View — ${teamName}`,
    scopeId: teamName,
    elements: Array.from(elementIds).map((id) => ({ elementId: id })),
    relationships: Array.from(relationshipIds).map((id) => ({ relationshipId: id })),
  };
}

/**
 * Builds an ephemeral "Flow View" based on tags.
 * Includes all relationships tagged with the given tag and their involved nodes.
 */
export function buildFlowView(workspace: C4Workspace, tag: string, title?: string): C4View {
  flattenWorkspace(workspace);
  const relationshipIds = new Set<string>();
  const elementIds = new Set<string>();

  for (const rel of workspace.relationships) {
    if (rel.tags?.includes(tag)) {
      relationshipIds.add(rel.id);
      elementIds.add(rel.sourceId);
      elementIds.add(rel.destinationId);
    }
  }

  return {
    id: `flow-${tag.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "Dynamic",
    title: title || `Flow Perspective — ${tag}`,
    scopeId: tag,
    elements: Array.from(elementIds).map((id) => ({ elementId: id })),
    relationships: Array.from(relationshipIds).map((id) => ({ relationshipId: id })),
  };
}
