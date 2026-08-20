import { BaseFeature } from "@nowarelabs/features";
import type { FeatureContext, UseCaseResult } from "@nowarelabs/shared";

import { OrchestratorService } from "../services/orchestrator.service.js";

type ListInput = { action: "listInstances" };
type PingInput = { action: "ping" };
type FeatureInput = ListInput | PingInput;

type FeatureOutput = { instances: unknown[] } | { pong: boolean };

export class OrchestratorFeature extends BaseFeature<FeatureInput, FeatureOutput> {
  constructor(private svc: OrchestratorService) {
    super();
  }

  protected async validate(input: FeatureInput, _ctx: FeatureContext): Promise<void> {
    if (!input.action) throw new Error("action is required");
  }

  protected async prepare(input: FeatureInput, _ctx: FeatureContext): Promise<FeatureInput> {
    return input;
  }

  protected async execute(
    input: FeatureInput,
    _ctx: FeatureContext,
  ): Promise<UseCaseResult<FeatureOutput>> {
    try {
      if (input.action === "listInstances") {
        const instances = await this.svc.listInstances();
        return { success: true, data: { instances }, status: "delivered" };
      }
      if (input.action === "ping") {
        return { success: true, data: { pong: true }, status: "delivered" };
      }
      return {
        success: false,
        error: new Error("Unknown action"),
        status: "abandoned",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }

  protected async finalize(
    _result: UseCaseResult<FeatureOutput>,
    _ctx: FeatureContext,
  ): Promise<void> {
    // no-op
  }

  protected toResponse(result: UseCaseResult<FeatureOutput>, _ctx: FeatureContext): Response {
    if (result.success) {
      return new Response(JSON.stringify(result.data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: result.error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  protected handleError(error: unknown, _ctx: FeatureContext): Response {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
