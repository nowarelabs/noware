import type { ContextLike } from "./shared.ts";
import { createContext } from "./shared.ts";

export interface ControllerContext extends ContextLike {
  readonly currentUser?: unknown;
  readonly session?: Record<string, unknown>;
}

export function createControllerContext(): ControllerContext {
  return { ...createContext(), currentUser: undefined, session: {} };
}

export function enhanceControllerContext(
  ctx: ContextLike,
  overrides?: Partial<Pick<ControllerContext, "currentUser" | "session">>,
): ControllerContext {
  return { ...ctx, currentUser: undefined, session: {}, ...overrides };
}
