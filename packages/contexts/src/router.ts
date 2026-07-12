import type { ContextLike } from "./shared.ts";
import { createContext } from "./shared.ts";

export interface RouterContext extends ContextLike {
  readonly params: Record<string, string>;
}

export function createRouterContext(): RouterContext {
  return { ...createContext(), params: {} };
}

export function enhanceRouterContext(
  ctx: ContextLike,
  overrides?: Partial<Pick<RouterContext, "params">>,
): RouterContext {
  return { ...ctx, params: {}, ...overrides };
}
