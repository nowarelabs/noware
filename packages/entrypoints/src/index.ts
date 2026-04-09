import {
  WorkerEntrypoint,
  DurableObject,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { IRouter } from "nomo/router";
import { IJobDispatcher } from "nomo/jobs";

export abstract class BaseWorker<Env = Cloudflare.Env> extends WorkerEntrypoint<Env> {
  router?: IRouter<Env, ExecutionContext>;
  dispatcher?: IJobDispatcher<Env>;

  /**
   * Standard HTTP fetch handler.
   */
  async fetch(
    request: Request,
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<Response> {
    const runtimeEnv = env ?? this.env;
    const runtimeCtx = ctx ?? this.ctx;
    if (this.router) {
      return this.router.handle(request, runtimeEnv, runtimeCtx);
    }
    throw new Error("fetch() not implemented and no router provided");
  }

  /**
   * Service Binding (RPC) handle method.
   * Alias for fetch to support modern RPC-style invocation.
   */
  async handle(
    request: Request,
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<Response> {
    return this.fetch(request, env, ctx);
  }

  /**
   * Service Binding (RPC) job execution.
   */
  async runJob(
    jobName: string,
    params: any,
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<void> {
    const runtimeEnv = env ?? this.env;
    const runtimeCtx = ctx ?? this.ctx;
    if (this.dispatcher) {
      await this.dispatcher.runJob(jobName, params, runtimeEnv, runtimeCtx);
    } else {
      throw new Error(`runJob() failed: No dispatcher provided for ${jobName}`);
    }
  }

  async queue(
    batch: MessageBatch<any>,
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<void> {
    const runtimeEnv = env ?? this.env;
    const runtimeCtx = ctx ?? this.ctx;
    if (this.dispatcher) {
      await this.dispatcher.handleQueue(batch, runtimeEnv, runtimeCtx);
    }
  }

  /**
   * Helper to dispatch RPC calls to the router/controllers.
   */
  protected async rpc(
    method: string,
    args: any[],
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<any> {
    const runtimeEnv = env ?? this.env;
    const runtimeCtx = ctx ?? this.ctx;
    if (this.router) {
      return this.router.rpc(method, args, runtimeEnv, runtimeCtx);
    }
    throw new Error(`RPC call failed: No router provided for ${method}`);
  }
}

export abstract class BaseDurableObject<Env = any> extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }
}

export abstract class BaseWorkflow<
  Env = any,
  T = any,
> extends WorkflowEntrypoint<Env, T> {
  abstract run(event: WorkflowEvent<T>, step: WorkflowStep): Promise<void>;
}
