import { createContext } from "./shared.ts";
import type { ControllerContext } from "./controllers.ts";

export interface ViewContext extends ControllerContext {
  readonly flash?: Record<string, unknown>;
}

export function createViewContext(): ViewContext {
  return {
    ...createContext(),
    params: {},
    currentUser: undefined,
    session: {},
    flash: {},
  };
}

export function enhanceViewContext(
  ctx: ControllerContext,
  overrides?: Partial<Pick<ViewContext, "flash">>,
): ViewContext {
  return { ...ctx, flash: {}, ...overrides };
}
