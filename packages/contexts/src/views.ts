import type { ContextLike } from "./shared.ts";
import { createContext } from "./shared.ts";

export interface ViewContext extends ContextLike {
  readonly currentUser?: unknown;
  readonly flash?: Record<string, unknown>;
}

export function createViewContext(): ViewContext {
  return { ...createContext(), currentUser: undefined, flash: {} };
}

export function enhanceViewContext(
  ctx: ContextLike,
  overrides?: Partial<Pick<ViewContext, "currentUser" | "flash">>,
): ViewContext {
  return { ...ctx, currentUser: undefined, flash: {}, ...overrides };
}
