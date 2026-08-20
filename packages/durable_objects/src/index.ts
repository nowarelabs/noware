/**
 * noware-durable-objects - DurableObject Utilities
 *
 * Standard Gauge: Durable Object Utilities (Tier 1)
 *
 * Connection: Used for Cloudflare Durable Objects
 *
 * Note: This package is Cloudflare-specific due to DurableObjectState.
 * Other types use noware-shared for runtime-agnostic compatibility.
 */

import type {
  EnvLike,
  DurableObjectContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
  OrchestratorState,
  CfourDiff,
  AgentState,
  AgentAction,
  AtomState,
  AtomType,
  AtomVersion,
  PheromoneEvent,
} from "@nowarelabs/shared";
import { Logger } from "@nowarelabs/telemetry";

export type DurableObjectState = {
  id: {
    name: string;
    toString(): string;
  };
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    list(_options?: {
      prefix?: string;
      limit?: number;
    }): Promise<{ keys: Array<{ name: string }> }>;
  };
};

export class BaseDurableObject<
  Ctx extends DurableObjectContext = DurableObjectContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseDurableObject>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseDurableObject>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseDurableObject>(
    fn: AroundHookFunction<T>,
    options?: HookOptions,
  ): void {
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

  protected logger!: Logger;

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {
    this.logger = new Logger(request, env, ctx as any, { service: this.constructor.name });
  }
}

// ----------------------------------------------------------------
// Stigmergic: OrchestratorDO
// ----------------------------------------------------------------

export interface OrchestratorDOConfig {
  id: string;
  level: "root" | "ss" | "container" | "component";
  elementId: string;
  parentId?: string;
  childOrchestratorIds?: string[];
}

export class OrchestratorDO {
  state: OrchestratorState;
  private pendingDiffs: CfourDiff[] = [];
  private intervalMs = 5000;

  constructor(config: OrchestratorDOConfig) {
    const now = Date.now();
    this.state = {
      id: config.id,
      level: config.level,
      elementId: config.elementId,
      parentId: config.parentId,
      childOrchestratorIds: config.childOrchestratorIds ?? [],
      currentModel: {},
      lastPheromoneCheck: 0,
      diffsProcessed: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  receiveDiffs(diffs: CfourDiff[]): void {
    this.pendingDiffs.push(...diffs);
  }

  processDiffs(model: Record<string, unknown>): CfourDiff[] {
    this.state.currentModel = model;
    const myDiffs: CfourDiff[] = [];
    for (const diff of this.pendingDiffs) {
      if (this.affectsMyLevel(diff)) {
        myDiffs.push(diff);
        this.state.diffsProcessed.push(diff);
      }
    }
    this.pendingDiffs = [];
    this.state.updatedAt = Date.now();
    return myDiffs;
  }

  cascadeToChildren(diffs: CfourDiff[]): CfourDiff[] {
    return diffs.map((d) => ({
      ...d,
      id: `${d.id}-cascaded`,
      sourceOrchestratorId: this.state.id,
    }));
  }

  releasePheromones(
    diffs: CfourDiff[],
  ): Array<{ elementId: string; level: string; cfourDiff: CfourDiff }> {
    return diffs.map((d) => ({
      elementId: d.elementId,
      level: d.level,
      cfourDiff: d,
    }));
  }

  private affectsMyLevel(diff: CfourDiff): boolean {
    const levelMap: Record<string, string[]> = {
      root: ["ss"],
      ss: ["container"],
      container: ["component"],
      component: ["code"],
    };
    return levelMap[this.state.level]?.includes(diff.level) ?? false;
  }

  get childIds(): string[] {
    return this.state.childOrchestratorIds;
  }

  get pendingDiffCount(): number {
    return this.pendingDiffs.length;
  }
}

// ----------------------------------------------------------------
// Stigmergic: AtomDO
// ----------------------------------------------------------------

export interface AtomDOConfig {
  id: string;
  cfourElementId: string;
  atomType: AtomType;
  content: string;
  language: string;
  filePath: string;
  parentComponentId: string;
  relationships?: string[];
  assignedPattern?: string;
  agentDoId: string;
}

export class AtomDO {
  state: AtomState;

  constructor(config: AtomDOConfig) {
    const now = Date.now();
    this.state = {
      id: config.id,
      cfourElementId: config.cfourElementId,
      atomType: config.atomType,
      content: config.content,
      language: config.language,
      filePath: config.filePath,
      parentComponentId: config.parentComponentId,
      relationships: config.relationships ?? [],
      assignedPattern: config.assignedPattern ?? "factory",
      status: "idle",
      agentDoId: config.agentDoId,
      versions: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  update(partial: Partial<Pick<AtomState, "content" | "status" | "assignedPattern">>): void {
    if (partial.content !== undefined) this.state.content = partial.content;
    if (partial.status !== undefined) this.state.status = partial.status;
    if (partial.assignedPattern !== undefined) this.state.assignedPattern = partial.assignedPattern;
    this.state.updatedAt = Date.now();
  }

  addVersion(version: Omit<AtomVersion, "id">): AtomVersion {
    const v: AtomVersion = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...version,
    };
    this.state.versions.push(v);
    return v;
  }

  getNeighbors(): string[] {
    return this.state.relationships;
  }

  archiveVersions(): AtomVersion[] {
    const archived = this.state.versions.splice(0, this.state.versions.length);
    return archived;
  }

  get currentVersion(): AtomVersion | undefined {
    return this.state.versions[this.state.versions.length - 1];
  }

  get versionCount(): number {
    return this.state.versions.length;
  }
}

// ----------------------------------------------------------------
// Stigmergic: AgentDO
// ----------------------------------------------------------------

export interface AgentDOConfig {
  id: string;
  atomDoId: string;
  agentType: string;
  cfourContract?: Record<string, unknown>;
  assignedPattern?: string;
  neighborAtomIds?: string[];
}

export class AgentDO {
  state: AgentState;
  private atomState: AtomState | null = null;
  private neighbors: AtomState[] = [];
  private signals: PheromoneEvent[] = [];

  constructor(config: AgentDOConfig) {
    const now = Date.now();
    this.state = {
      id: config.id,
      atomDoId: config.atomDoId,
      agentType: config.agentType,
      cfourContract: config.cfourContract ?? {},
      assignedPattern: config.assignedPattern ?? "factory",
      neighborAtomIds: config.neighborAtomIds ?? [],
      status: "idle",
      lastPheromoneCheck: 0,
      actions: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  loadAtomState(atom: AtomState): void {
    this.atomState = atom;
  }

  loadNeighbors(neighbors: AtomState[]): void {
    this.neighbors = neighbors;
  }

  loadPheromones(signals: PheromoneEvent[]): void {
    this.signals = signals;
  }

  decide(): { action: string; target?: string; content?: string } | null {
    if (!this.atomState) return null;

    if (
      this.atomState.status === "idle" &&
      this.signals.some((s) => s.type === "atom-needs-work")
    ) {
      return { action: "write-atom", target: this.atomState.id, content: this.atomState.content };
    }

    if (
      this.signals.some((s) => s.type === "description-changed" || s.type === "pattern-changed")
    ) {
      return { action: "read-pheromone" };
    }

    if (this.neighbors.length > 0) {
      return { action: "read-neighbor", target: this.neighbors[0].id };
    }

    return null;
  }

  recordAction(
    type: AgentAction["type"],
    atomDoId: string | undefined,
    result: AgentAction["result"],
    details?: string,
  ): AgentAction {
    const action: AgentAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      atomDoId,
      timestamp: Date.now(),
      result,
      details,
    };
    this.state.actions.push(action);
    this.state.updatedAt = Date.now();
    return action;
  }

  get actionCount(): number {
    return this.state.actions.length;
  }

  get lastAction(): AgentAction | undefined {
    return this.state.actions[this.state.actions.length - 1];
  }
}
