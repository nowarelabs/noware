import type { D1Database } from "@cloudflare/workers-types";
import type {
  IDispatchAgentPort,
  IHitlPort,
  DispatchAgentInput,
  HitlInput,
} from "@nowarelabs/agent-ports";

import { FlaxInstanceModel } from "../models/flax-instance.model.js";
import { FlaxStageModel } from "../models/flax-stage.model.js";
import { FlaxHitlModel } from "../models/flax-hitl.model.js";
import { stageForAgent } from "../dashboard-db.js";

export interface DispatchInput {
  agent: string;
  conversationId: string;
  task: string;
  stage?: string;
  attributes?: Record<string, string>;
}

export interface DispatchOutput {
  streamUrl?: string;
  offset?: number;
  submissionId?: string;
  stage: string;
}

export interface CreateHitlInput {
  conversationId: string;
  id: string;
  type: string;
  title: string;
  summary?: string;
  payload?: unknown;
}

export interface ResolveHitlInput {
  id: string;
  answer: string;
}

export class OrchestratorService {
  private instanceModel: FlaxInstanceModel;
  private stageModel: FlaxStageModel;
  private hitlModel: FlaxHitlModel;

  constructor(
    private db: D1Database,
    private dispatchPort?: IDispatchAgentPort,
    private hitlPort?: IHitlPort,
  ) {
    this.instanceModel = new FlaxInstanceModel({ db, table: "flax_instances" });
    this.stageModel = new FlaxStageModel({ db, table: "flax_stages" });
    this.hitlModel = new FlaxHitlModel({ db, table: "flax_hitl" });
  }

  async dispatchTask(input: DispatchInput): Promise<DispatchOutput> {
    const stage = input.stage ?? stageForAgent(input.agent);

    if (this.dispatchPort) {
      const result = await this.dispatchPort.execute(input as DispatchAgentInput);
      if (result.success) {
        try {
          await this.stageModel.openStage(
            input.conversationId,
            stage,
            input.agent,
            input.task.slice(0, 200),
          );
          await this.instanceModel.patchFields(input.conversationId, {
            currentStage: stage,
            currentAgent: input.agent,
            status: "running",
            lastActivityAt: Date.now(),
          });
        } catch {
          // pipeline telemetry is best-effort
        }
        return {
          streamUrl: result.data.streamUrl,
          offset: result.data.offset,
          submissionId: result.data.submissionId,
          stage: result.data.stage,
        };
      }
    }

    // Fallback: stage and instance tracking only (no dispatch port)
    try {
      await this.stageModel.openStage(
        input.conversationId,
        stage,
        input.agent,
        input.task.slice(0, 200),
      );
      await this.instanceModel.patchFields(input.conversationId, {
        currentStage: stage,
        currentAgent: input.agent,
        status: "running",
        lastActivityAt: Date.now(),
      });
    } catch {
      // pipeline telemetry is best-effort
    }
    return { stage };
  }

  async createHitl(
    input: CreateHitlInput,
  ): Promise<{ hitlId: string; status: "blocked_on_human" }> {
    try {
      await this.hitlModel.insertHitl({
        id: input.id,
        conversation_id: input.conversationId,
        type: input.type,
        title: input.title,
        summary: input.summary,
        payload: input.payload,
      });
      await this.instanceModel.patchFields(input.conversationId, {
        currentAgent: "orchestrator",
        status: "blocked_on_human",
        lastActivityAt: Date.now(),
      });
    } catch {
      // HITL persistence is best-effort
    }
    return { hitlId: input.id, status: "blocked_on_human" };
  }

  async resolveHitl(input: ResolveHitlInput): Promise<void> {
    if (this.hitlPort) {
      const result = await this.hitlPort.execute({
        method: "resolve",
        answer: input.answer,
      } as HitlInput);
      if (result.success) return;
    }
    await this.hitlModel.resolveHitl(input.id, input.answer);
  }

  async listInstances(): Promise<unknown[]> {
    return this.instanceModel.listRecent();
  }
}
