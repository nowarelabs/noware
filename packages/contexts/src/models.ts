import { createContext } from "./shared.ts";
import type { ServiceContext } from "./services.ts";

export interface ModelContext extends ServiceContext {
  readonly transaction?: unknown;
}

export function createModelContext(): ModelContext {
  return {
    ...createContext(),
    params: {},
    currentUser: undefined,
    session: {},
    transactionId: crypto.randomUUID(),
    logger: undefined,
    transaction: undefined,
  };
}

export function enhanceModelContext(
  ctx: ServiceContext,
  overrides?: Partial<Pick<ModelContext, "transaction">>,
): ModelContext {
  return { ...ctx, transaction: undefined, ...overrides };
}
