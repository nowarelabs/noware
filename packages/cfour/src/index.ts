import type {
  EnvLike,
  CfourContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export abstract class BaseCfour<
  Ctx extends CfourContext = CfourContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
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

  private static collectHooks(ctor: object, prop: string): RegisteredHook[] {
    const hooks: RegisteredHook[] = [];
    let current: any = ctor;
    while (current && current !== Function.prototype) {
      if (Object.hasOwn(current, prop)) {
        hooks.unshift(...current[prop]);
      }
      current = Object.getPrototypeOf(current);
    }
    return hooks;
  }

  private static _workspaces: Map<string, C4Workspace> = new Map([
    [
      "default",
      { name: "Default Workspace", people: [], softwareSystems: [], relationships: [], views: [] },
    ],
  ]);

  private static _listeners: Set<(workspaceName: string) => void> = new Set();

  /** Subscribes to changes in the workspace registry. */
  static subscribe(listener: (workspaceName: string) => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private static _notify(workspaceName: string) {
    for (const listener of this._listeners) {
      listener(workspaceName);
    }
  }

  /** Resets a specific C4 workspace or the default one. */
  static resetWorkspace(workspaceName = "default", title?: string, description?: string) {
    this._workspaces.set(workspaceName, {
      name: title || (workspaceName === "default" ? "Framework Workspace" : workspaceName),
      description,
      people: [],
      softwareSystems: [],
      relationships: [],
      views: [],
    });
    this._notify(workspaceName);
  }

  /** Returns a specific C4 workspace or the default one. */
  static getWorkspace(name = "default"): C4Workspace {
    const ws = this._workspaces.get(name);
    if (!ws) {
      // Lazy initialization if workspace doesn't exist
      this.resetWorkspace(name);
      return this._workspaces.get(name)!;
    }
    return ws;
  }

  /** Returns all workspace names. */
  static getWorkspaceNames(): string[] {
    return Array.from(this._workspaces.keys());
  }

  /** Adds a Person to the workspace. */
  static addPerson(person: Omit<C4Person, "kind">, workspaceName = "default") {
    this.getWorkspace(workspaceName).people.push({ ...person, kind: "Person" });
    this._notify(workspaceName);
  }

  /** Adds a Software System to the workspace. */
  static addSoftwareSystem(system: Omit<C4SoftwareSystem, "kind">, workspaceName = "default") {
    this.getWorkspace(workspaceName).softwareSystems.push({ ...system, kind: "SoftwareSystem" });
    this._notify(workspaceName);
  }

  /** Adds a Container to a Software System. */
  static addContainer(
    container: Omit<C4Container, "kind"> & { kind?: "Container" | "Queue" | "Topic" },
    workspaceName = "default",
  ) {
    const ws = this.getWorkspace(workspaceName);
    const system = ws.softwareSystems.find((s) => s.id === container.systemId);
    if (!system) {
      throw new Error(
        `Software System with id "${container.systemId}" not found in workspace "${workspaceName}".`,
      );
    }
    system.containers = system.containers || [];
    system.containers.push({ ...container, kind: container.kind ?? "Container" });
    this._notify(workspaceName);
  }

  /** Adds a Queue to a Software System (specialized container). */
  static addQueue(queue: Omit<C4Container, "kind">, workspaceName = "default") {
    this.addContainer({ ...queue, kind: "Queue" }, workspaceName);
  }

  /** Adds a Topic to a Software System (specialized container). */
  static addTopic(topic: Omit<C4Container, "kind">, workspaceName = "default") {
    this.addContainer({ ...topic, kind: "Topic" }, workspaceName);
  }

  /** Adds a Component to a Container. */
  static addComponent(component: Omit<C4Component, "kind">, workspaceName = "default") {
    const ws = this.getWorkspace(workspaceName);
    let container: C4Container | undefined;
    for (const system of ws.softwareSystems) {
      container = system.containers?.find((c) => c.id === component.containerId);
      if (container) break;
    }

    if (!container) {
      throw new Error(
        `Container with id "${component.containerId}" not found in workspace "${workspaceName}".`,
      );
    }

    container.components = container.components || [];
    container.components.push({ ...component, kind: "Component" });
    this._notify(workspaceName);
  }

  /** Adds a Code Element to a Component. */
  static addCodeElement(
    codeElement: Omit<C4CodeElement, "kind"> & { kind?: C4CodeElementKind },
    workspaceName = "default",
  ) {
    const ws = this.getWorkspace(workspaceName);
    let component: C4Component | undefined;
    for (const system of ws.softwareSystems) {
      for (const container of system.containers ?? []) {
        component = container.components?.find((c) => c.id === codeElement.componentId);
        if (component) break;
      }
      if (component) break;
    }

    if (!component) {
      throw new Error(
        `Component with id "${codeElement.componentId}" not found in workspace "${workspaceName}".`,
      );
    }

    component.codeElements = component.codeElements || [];
    component.codeElements.push({
      ...codeElement,
      kind: codeElement.kind ?? "Class",
    } as C4CodeElement);
    this._notify(workspaceName);
  }

  /** Adds a Relationship between any two elements. */
  static addRelationship(rel: C4Relationship, workspaceName = "default") {
    this.getWorkspace(workspaceName).relationships.push(rel);
    this._notify(workspaceName);
  }

  /** Updates an existing element's properties. */
  static updateElement(
    id: string,
    patch: Partial<Omit<C4Node, "id" | "kind">>,
    workspaceName = "default",
  ) {
    const ws = this.getWorkspace(workspaceName);
    const flat = flattenWorkspace(ws);
    const node = flat.nodes.find((n) => n.id === id);
    if (node) {
      Object.assign(node, patch);
      this._notify(workspaceName);
    }
  }

  /** Removes an element and all its children/relationships. */
  static removeElement(id: string, workspaceName = "default") {
    const ws = this.getWorkspace(workspaceName);

    // Remove from people
    ws.people = ws.people.filter((p) => p.id !== id);

    // Remove from systems/containers/components/code
    ws.softwareSystems = ws.softwareSystems.filter((s) => s.id !== id);
    for (const system of ws.softwareSystems) {
      if (system.containers) {
        system.containers = system.containers.filter((c) => c.id !== id);
        for (const container of system.containers) {
          if (container.components) {
            container.components = container.components.filter((cp) => cp.id !== id);
            for (const component of container.components) {
              if (component.codeElements) {
                component.codeElements = component.codeElements.filter((ce) => ce.id !== id);
              }
            }
          }
        }
      }
    }

    // Remove associated relationships
    ws.relationships = ws.relationships.filter((r) => r.sourceId !== id && r.destinationId !== id);

    this._notify(workspaceName);
  }

  // ── View Builders (Drilling) ───────────────────────────────

  /** Gets a System Context view for a system in the registry. */
  static getSystemContextView(systemId: string, workspaceName = "default") {
    return buildSystemContextView(this.getWorkspace(workspaceName), systemId);
  }

  /** Gets a Container view for a system in the registry. */
  static getContainerView(systemId: string, workspaceName = "default") {
    return buildContainerView(this.getWorkspace(workspaceName), systemId);
  }

  /** Gets a Component view for a container in the registry. */
  static getComponentView(containerId: string, workspaceName = "default") {
    return buildComponentView(this.getWorkspace(workspaceName), containerId);
  }

  /** Gets a Code view for a component in the registry. */
  static getCodeView(componentId: string, workspaceName = "default") {
    return buildCodeView(this.getWorkspace(workspaceName), componentId);
  }

  /** Gets a Team view for a specific team in the registry. */
  static getTeamView(teamName: string, workspaceName = "default") {
    return buildTeamView(this.getWorkspace(workspaceName), teamName);
  }

  /**
   * Gets a Flow view (ephemeral viewpoint) for specific tags (e.g. 'internet', 'pci').
   * Useful for security audits (CISO) or network flow analysis.
   */
  static getFlowView(tag: string, title?: string, workspaceName = "default") {
    return buildFlowView(this.getWorkspace(workspaceName), tag, title);
  }

  /**
   * Generates a structured catalog of network flows for a given tag.
   * Returns a list of relationships with source/destination names and tech.
   */
  static getFlowCatalog(
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
  static diff(workspaceNameA: string, workspaceNameB: string): C4WorkspaceDiff {
    return diffWorkspaces(this.getWorkspace(workspaceNameA), this.getWorkspace(workspaceNameB));
  }

  /**
   * Generates a legend for a given view.
   * Scans all elements and relationships in the view to identify unique kinds and technologies.
   */
  static getLegend(
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
  static lint(
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
  static updateViewPosition(
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

    this._notify(workspaceName);
  }

  /** Persists a view to the workspace. */
  static saveView(view: C4View, workspaceName = "default") {
    const ws = this.getWorkspace(workspaceName);
    ws.views = ws.views || [];
    const idx = ws.views.findIndex((v) => v.id === view.id);
    if (idx >= 0) {
      ws.views[idx] = view;
    } else {
      ws.views.push(view);
    }
    this._notify(workspaceName);
  }

  // ── Persistence ───────────────────────────────────────────

  /** Exports a workspace to a JSON string. */
  static export(workspaceName = "default"): string {
    return JSON.stringify(this.getWorkspace(workspaceName), null, 2);
  }

  /** Imports a workspace from a JSON string. */
  static import(json: string, workspaceName = "default") {
    const ws = JSON.parse(json) as C4Workspace;
    this._workspaces.set(workspaceName, ws);
    this._notify(workspaceName);
  }

  // ── Query Engine ──────────────────────────────────────────

  /**
   * Queries nodes based on filters.
   * Example: findNodes({ kind: 'Container', technology: 'React' })
   */
  static findNodes(
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

  // ── Validation Engine ─────────────────────────────────────

  /**
   * Validates the integrity of the workspace.
   * Returns a list of errors found (dangling relationships, etc).
   */
  static validate(
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
  static addBuildingBlock(
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
    );
  }

  /**
   * Automatically registers a subclass as a Component or Code Element.
   * This can be called in a static block or via class metadata.
   */
  static register(config: {
    id?: string;
    name?: string;
    description?: string;
    technology?: string;
    parentId?: string; // containerId or componentId
    kind?: C4ElementKind;
    workspaceName?: string;
  }) {
    const workspaceName = config.workspaceName || "default";
    const id = config.id || this.name;
    const name = config.name || this.name;

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
      );
    }
  }

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}

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

function getObjectChanges(obj1: any, obj2: any): string[] {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    // Skip nested children which are handled by the flat comparison
    if (["containers", "components", "codeElements", "members"].includes(key)) continue;

    const val1 = obj1[key];
    const val2 = obj2[key];

    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
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
  const flat = flattenWorkspace(workspace);
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
