import type { ExecutionContext } from "@cloudflare/workers-types";
import { BaseJob } from "./index";
import { Logger, LogLevel } from "nomo/logger";
import {
  trace,
  context,
  propagation,
  SpanStatusCode,
} from "@opentelemetry/api";

export type JobConstructor<T = any> = new (params: T) => BaseJob<T>;

export interface IJobRegistry {
  [jobName: string]: JobConstructor;
}

export interface IJobDispatcher<Env = any> {
  handleQueue(batch: any, env?: Env, ctx?: ExecutionContext): Promise<void>;
  runJob(
    jobName: string,
    params: any,
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<void>;
}

export class JobDispatcher implements IJobDispatcher {
  private logger = new Logger({
    service: "jobs-dispatcher",
    level: LogLevel.DEBUG,
  });
  constructor(private jobRegistry: IJobRegistry) {}

  async handleQueue(batch: any, env?: any, ctx?: any) {
    if (env?.ENVIRONMENT) {
      Logger.ENVIRONMENT = env.ENVIRONMENT;
    }
    if (env?.LOG_LEVEL) {
      Logger.LEVEL = env.LOG_LEVEL;
    } else if (Logger.ENVIRONMENT === "development") {
      Logger.LEVEL = LogLevel.DEBUG;
    }

    for (const message of batch.messages) {
      const body = message.body;
      if (body.type === "job") {
        const { jobName, params, traceContext } = body;
        await this.runJob(jobName, params, env, ctx, traceContext);
        if (typeof message.ack === "function") {
          message.ack();
        }
      }
    }
  }

  async runJob(
    jobName: string,
    params: any,
    env?: any,
    ctx?: any,
    traceContext?: any,
  ) {
    const parentContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();
    const tracer = trace.getTracer("nomo-jobs");

    return await context.with(parentContext, async () => {
      return await tracer.startActiveSpan(`job ${jobName}`, async (span) => {
        const spanContext = span.spanContext();
        const contextualLogger = this.logger.withContext({
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId,
          job_name: jobName,
        });

        const JobClass = this.jobRegistry[jobName];
        if (JobClass) {
          contextualLogger.info(`Running job ${jobName}`, { params });
          try {
            const job = new JobClass(params);
            await job.perform({ env, ctx });
            contextualLogger.info(`Job ${jobName} completed successfully`);
            span.setStatus({ code: SpanStatusCode.OK });
          } catch (err: any) {
            contextualLogger.error(
              `Job ${jobName} failed`,
              { params },
              err as Error,
            );
            span.recordException(err as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: err.message,
            });
            throw err;
          } finally {
            span.end();
          }
        } else {
          contextualLogger.warn(`Job ${jobName} not found in registry`);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Job not found",
          });
          span.end();
        }
      });
    });
  }

  async handleWorkflow(event: any, step: any) {
    // Note: workflows might not have direct env access here,
    // but the global Logger.ENVIRONMENT should have been set
    // if it ran in the same isolate as a request or queue handler.
    // However, to be safe, if we can get env somewhere, we should.

    const { jobName, params, traceContext } = event.payload;
    const parentContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();
    const tracer = trace.getTracer("nomo-workflows");

    return await context.with(parentContext, async () => {
      return await tracer.startActiveSpan(
        `workflow-job ${jobName}`,
        async (span) => {
          const spanContext = span.spanContext();
          const contextualLogger = this.logger.withContext({
            trace_id: spanContext.traceId,
            span_id: spanContext.spanId,
            job_name: jobName,
          });

          const JobClass = this.jobRegistry[jobName];
          if (JobClass) {
            contextualLogger.info(`Running workflow job ${jobName}`, {
              params,
            });
            try {
              const job = new JobClass(params);
              await job.perform({ step });
              contextualLogger.info(
                `Workflow job ${jobName} completed successfully`,
              );
              span.setStatus({ code: SpanStatusCode.OK });
            } catch (err: any) {
              contextualLogger.error(
                `Workflow job ${jobName} failed`,
                { params },
                err as Error,
              );
              span.recordException(err as Error);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err.message,
              });
              throw err;
            } finally {
              span.end();
            }
          } else {
            contextualLogger.error(`Job ${jobName} not found in registry`);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: "Job not found",
            });
            span.end();
            throw new Error(`Job ${jobName} not found in registry`);
          }
        },
      );
    });
  }
}
