import type { ContextLike } from "./shared.ts";
import { createContext } from "./shared.ts";
import type { RouterContext } from "./router.ts";

export interface ControllerContext extends RouterContext {
  readonly currentUser?: unknown;
  readonly session?: Record<string, unknown>;
}

export function createControllerContext(): ControllerContext {
  return { ...createContext(), params: {}, currentUser: undefined, session: {} };
}

export function enhanceControllerContext(
  ctx: ContextLike,
  overrides?: Partial<Pick<ControllerContext, "params" | "currentUser" | "session">>,
): ControllerContext {
  return { ...ctx, params: {}, currentUser: undefined, session: {}, ...overrides };
}
