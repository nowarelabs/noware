import type { ContextLike } from "./shared.ts";
import { createContext } from "./shared.ts";

export interface ServiceContext extends ContextLike {
  readonly transactionId: string;
  readonly logger?: unknown;
}

export function createServiceContext(): ServiceContext {
  return { ...createContext(), transactionId: crypto.randomUUID(), logger: undefined };
}

export function enhanceServiceContext(
  ctx: ContextLike,
  overrides?: Partial<Pick<ServiceContext, "transactionId" | "logger">>,
): ServiceContext {
  return { ...ctx, transactionId: crypto.randomUUID(), logger: undefined, ...overrides };
}
