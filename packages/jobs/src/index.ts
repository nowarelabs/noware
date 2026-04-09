import { Logger, LogLevel } from "nomo/logger";
import { context, propagation } from "@opentelemetry/api";

export abstract class BaseJob<T = any> {
  constructor(protected params: T) {}
  abstract perform(ctx?: any): Promise<void>;
}

export abstract class QueueJob<T = any> extends BaseJob<T> {
  static async performLater<T extends { new (...args: any[]): any }>(
    this: T,
    queue: any,
    params: any,
  ) {
    const logger = new Logger({ service: "jobs", level: LogLevel.DEBUG });
    logger.info(`Enqueuing job ${this.name}`, { params });

    const traceContext: Record<string, string> = {};
    propagation.inject(context.active(), traceContext);

    await queue.send({
      type: "job",
      jobName: this.name,
      params,
      traceContext,
    });
  }

  static async performNow<T extends { new (...args: any[]): any }>(this: T, params: any) {
    const job = new (this as any)(params);
    await job.perform();
  }
}

export abstract class WorkflowJob<T = any> extends BaseJob<T> {
  static async performLater<T extends { new (...args: any[]): any }>(
    this: T,
    workflow: any,
    params: any,
    options?: any,
  ) {
    const logger = new Logger({ service: "jobs", level: LogLevel.DEBUG });
    logger.info(`Creating workflow ${this.name}`, { params, options });

    const traceContext: Record<string, string> = {};
    propagation.inject(context.active(), traceContext);

    await workflow.create({
      id: options?.id,
      params: {
        jobName: this.name,
        params,
        traceContext,
      },
    });
  }

  async step<R>(name: string, callback: () => Promise<R>, ctx: any): Promise<R> {
    return await ctx.step.do(name, callback);
  }

  async sleep(seconds: number, ctx: any): Promise<void> {
    await ctx.step.sleep(`sleep_${seconds}s`, seconds);
  }
}

export * from "./handler";
