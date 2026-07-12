import type { ContextLike } from "./shared.ts";
import { createContext } from "./shared.ts";

export interface ModelContext extends ContextLike {
  readonly logger?: unknown;
  readonly transaction?: unknown;
}

export function createModelContext(): ModelContext {
  return { ...createContext(), logger: undefined, transaction: undefined };
}

export function enhanceModelContext(
  ctx: ContextLike,
  overrides?: Partial<Pick<ModelContext, "logger" | "transaction">>,
): ModelContext {
  return { ...ctx, logger: undefined, transaction: undefined, ...overrides };
}
