import { Logger } from "nomo/logger";
import type { ExecutionContext, D1Database } from "@cloudflare/workers-types";
import type { RouterContext, RouterContextSource } from "nomo/router";

export type { RouterContextSource };

export abstract class BaseService<Env = unknown, Ctx = ExecutionContext> {
  constructor(
    protected req: Request,
    protected env: Env,
    protected ctx: RouterContext<Env, Ctx>,
  ) {}

  protected get logger(): Logger {
    return (
      this.ctx.logger ||
      new Logger({
        service: "services",
        context: {
          service_name: this.constructor.name,
          source: this.ctx.source,
        },
      })
    );
  }

  protected async fetch(input: string | Request | URL, init?: RequestInit): Promise<Response> {
    return this.ctx.fetch(input, init);
  }

  protected get db(): D1Database {
    return (this.env as any).DB;
  }

  protected createServiceContext(
    serviceName: string,
    metadata?: Record<string, any>,
  ): RouterContext<Env, Ctx> {
    const newCtx = { ...this.ctx } as RouterContext<Env, Ctx>;
    newCtx.source = "service";
    newCtx.sourceMetadata = {
      ...this.ctx.sourceMetadata,
      parent_service: this.constructor.name,
      child_service: serviceName,
      ...metadata,
    };
    return newCtx;
  }
}

export type { ExecutionContext };
