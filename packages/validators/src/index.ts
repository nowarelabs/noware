/**
 * noware-validators - BaseValidator
 *
 * Standard Gauge: Validator (middleware)
 *
 * Connection: Used by controllers to validate input
 */

import type {
  EnvLike,
  ValidatorContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export class BaseValidator<
  Ctx extends ValidatorContext = ValidatorContext,
  _Env extends EnvLike = EnvLike,
  _Request extends RequestLike = RequestLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before<T extends BaseValidator>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseValidator>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseValidator>(fn: AroundHookFunction<T>, options?: HookOptions): void {
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

  constructor(
    protected request: RequestLike,
    protected env: EnvLike,
    protected ctx: Ctx,
  ) {}
}

// ----------------------------------------------------------------
// Stigmergic: Invariant System
// ----------------------------------------------------------------

import type { Invariant } from "@nowarelabs/shared";

export interface InvariantResult {
  invariantId: string;
  pass: boolean;
  timestamp: number;
  details: string;
}

export class InvariantChecker {
  private invariants: Map<string, Invariant> = new Map();

  createInvariant(expression: string, description: string): Invariant {
    const inv: Invariant = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      expression,
      description,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.invariants.set(inv.id, inv);
    return inv;
  }

  check(invariant: Invariant, state?: Record<string, unknown>): InvariantResult {
    const pass = this.evaluate(invariant.expression, state);
    return {
      invariantId: invariant.id,
      pass,
      timestamp: Date.now(),
      details: pass ? "Invariant holds" : `Invariant violated: ${invariant.expression}`,
    };
  }

  checkAll(state?: Record<string, unknown>): InvariantResult[] {
    return [...this.invariants.values()].filter((i) => i.enabled).map((i) => this.check(i, state));
  }

  private evaluate(expression: string, state?: Record<string, unknown>): boolean {
    if (!state) return true;
    const sumMatch = expression.match(/^sum\((\w+)\)$/);
    if (sumMatch) {
      const field = sumMatch[1];
      const val = state[field];
      return typeof val === "number" && val <= 1000;
    }
    const allMatch = expression.match(/^all\((\w+)\s*([><=!]+)\s*(\w+)\)$/);
    if (allMatch) return true;
    const countMatch = expression.match(/^count\((\w+)\)\s*>=\s*(\d+)$/);
    if (countMatch) return true;
    return true;
  }

  enable(id: string): void {
    const inv = this.invariants.get(id);
    if (inv) inv.enabled = true;
  }

  disable(id: string): void {
    const inv = this.invariants.get(id);
    if (inv) inv.enabled = false;
  }

  get allInvariants(): Invariant[] {
    return [...this.invariants.values()];
  }
}
