/**
 * noware-events - EventEmitter
 *
 * Standard Gauge: Event System (infrastructure)
 *
 * Connection: This package dispatches events to handlers
 *
 * Static Plugin Points:
 * - handlers: Map<string, EventHandler[]>
 */

import type {
  EnvLike,
  EventContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
  PheromoneEvent,
  PheromoneEventType,
  CfourDiff,
} from "@nowarelabs/shared";
import { Logger } from "@nowarelabs/telemetry";

export class EventEmitter {
  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: EventContext,
  ) {}

  on(_event: string, _handler: unknown): void {}
  emit(_event: string, _data: unknown): void {}
}

export class BaseEvent<
  Ctx extends EventContext = EventContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseEvent>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseEvent>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseEvent>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
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
// Stigmergic: PheromoneSignalEmitter
// ----------------------------------------------------------------

export class PheromoneSignalEmitter {
  private events: PheromoneEvent[] = [];

  emit(event: Omit<PheromoneEvent, "id" | "timestamp" | "consumedBy">): PheromoneEvent {
    const e: PheromoneEvent = {
      id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      consumedBy: [],
      ...event,
    };
    this.events.push(e);
    return e;
  }

  poll(agentDoId: string, lastCheck: number): PheromoneEvent[] {
    return this.events.filter(
      (e) => e.timestamp > lastCheck && !e.consumedBy.includes(agentDoId),
    );
  }

  consume(eventId: string, agentDoId: string): boolean {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) return false;
    if (!event.consumedBy.includes(agentDoId)) {
      event.consumedBy.push(agentDoId);
    }
    return true;
  }

  emitOnWrite(atomDoId: string, agentDoId: string, elementId: string): PheromoneEvent {
    return this.emit({
      type: "atom-ready",
      elementId,
      level: "code",
      agentDoId,
    });
  }

  emitCfourDiff(diff: CfourDiff, sourceOrchestratorId: string): PheromoneEvent {
    const typeMap: Record<string, PheromoneEventType> = {
      description: "description-changed",
      pattern: "pattern-changed",
      relationship: "relationship-changed",
      structure: "description-changed",
      add: "atom-needs-work",
      remove: "atom-deleted",
    };
    return this.emit({
      type: typeMap[diff.changeType] ?? "description-changed",
      elementId: diff.elementId,
      level: diff.level,
      cfourDiff: diff,
    });
  }

  get allEvents(): PheromoneEvent[] {
    return [...this.events];
  }

  get unconsumedCount(): number {
    return this.events.filter((e) => e.consumedBy.length === 0).length;
  }
}
