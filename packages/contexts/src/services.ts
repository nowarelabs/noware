import { createContext } from "./shared.ts";
import type { ControllerContext } from "./controllers.ts";

export interface ServiceContext extends ControllerContext {
  readonly transactionId: string;
  readonly logger?: unknown;
}

export function createServiceContext(): ServiceContext {
  return {
    ...createContext(),
    params: {},
    currentUser: undefined,
    session: {},
    transactionId: crypto.randomUUID(),
    logger: undefined,
  };
}

export function enhanceServiceContext(
  ctx: ControllerContext,
  overrides?: Partial<Pick<ServiceContext, "transactionId" | "logger">>,
): ServiceContext {
  return { ...ctx, transactionId: crypto.randomUUID(), logger: undefined, ...overrides };
}
