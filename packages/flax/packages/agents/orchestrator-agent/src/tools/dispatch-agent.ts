import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import type {
  IDispatchAgentPort,
  DispatchAgentInput,
  DispatchAgentOutput,
} from "@nowarelabs/agent-ports";
import type { UseCaseResult } from "@nowarelabs/shared";
import { createEntropyGate, defaultConfig } from "@nowarelabs/entropy-gate";

import { stageForAgent } from "../dashboard-db";
import { FlaxInstanceModel } from "../models/flax-instance.model.js";
import { FlaxStageModel } from "../models/flax-stage.model.js";

const entropyGate = createEntropyGate(defaultConfig);

const AGENTS = {
  "product-requirements": "PRODUCT_REQUIREMENTS_AGENT",
  "business-data-analyst": "BUSINESS_DATA_ANALYST_AGENT",
  "solutions-architect": "SOLUTIONS_ARCHITECT_AGENT",
  "ux-ui-designer": "UX_UI_DESIGNER_AGENT",
  coding: "CODING_AGENT",
  "database-data-engineer": "DATABASE_DATA_ENGINEER_AGENT",
  "code-review": "CODE_REVIEW_AGENT",
  "qa-test": "QA_TEST_AGENT",
  "security-appsec": "SECURITY_APPSEC_AGENT",
  "devops-cicd": "DEVOPS_CICD_AGENT",
  "release-manager": "RELEASE_MANAGER_AGENT",
  "sre-observability": "SRE_OBSERVABILITY_AGENT",
  documentation: "DOCUMENTATION_AGENT",
  "support-feedback": "SUPPORT_FEEDBACK_AGENT",
  support: "SUPPORT_AGENT",
} as const;

const agentNames = v.picklist([
  "product-requirements",
  "business-data-analyst",
  "solutions-architect",
  "ux-ui-designer",
  "coding",
  "database-data-engineer",
  "code-review",
  "qa-test",
  "security-appsec",
  "devops-cicd",
  "release-manager",
  "sre-observability",
  "documentation",
  "support-feedback",
  "support",
]);

const railStages = v.picklist([
  "requirements",
  "architecture",
  "design",
  "coding",
  "review",
  "qa",
  "security",
  "devops",
  "release",
  "sre-docs",
]);

const inputSchema = v.object({
  agent: agentNames,
  conversationId: v.string(),
  task: v.string(),
  stage: v.optional(railStages),
  attributes: v.optional(v.record(v.string(), v.string())),
});

const outputSchema = v.object({
  streamUrl: v.optional(v.string()),
  offset: v.optional(v.number()),
  submissionId: v.optional(v.string()),
  stage: v.optional(v.string()),
});

class LocalDispatchAgentGateway implements IDispatchAgentPort {
  async execute(input: DispatchAgentInput): Promise<UseCaseResult<DispatchAgentOutput>> {
    try {
      const binding = (env as unknown as Record<string, Fetcher>)[
        AGENTS[input.agent as keyof typeof AGENTS]
      ];
      const response = await binding.fetch(
        new Request(`http://localhost/agents/${input.agent}/${input.conversationId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "signal",
            type: "orchestrator.task",
            body: input.task,
            attributes: {
              ...input.attributes,
              dispatchedBy: "orchestrator",
              stage: input.stage ?? stageForAgent(input.agent),
            },
          }),
        }),
      );
      const receipt = (await response.json()) as DispatchAgentOutput;
      return { success: true, data: receipt, status: "delivered" };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

export const dispatchAgentTool = defineTool({
  name: "dispatch_agent",
  description:
    "Dispatch a task to another agent. Fire-and-forget: the agent acknowledges immediately and runs asynchronously; its reply lands in the shared conversation. Pass `stage` (the pipeline rail stage this dispatch contributes to) and `attributes` to carry structured context the target reads via useDelivery. Returns the admission receipt (streamUrl, offset, submissionId).",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  async run({ data, log }) {
    const gateDecision = await entropyGate.evaluate(
      {
        agent: data.agent,
        task: data.task,
        stage: data.stage,
        attributes: data.attributes,
        conversationId: data.conversationId,
      },
      { sourceAgent: "orchestrator", targetAgent: data.agent },
    );

    if (!gateDecision.allowed) {
      const failedGate = gateDecision.gates.find((g) => !g.pass);
      log.info("dispatch.rejected", {
        agent: data.agent,
        conversationId: data.conversationId,
        gate: failedGate?.gate,
        reason: failedGate?.reason,
      });
      return { stage: data.stage ?? stageForAgent(data.agent) };
    }

    const port = new LocalDispatchAgentGateway();
    const result = await port.execute(data as DispatchAgentInput);

    if (result.success) {
      const receipt = result.data;
      const db = (env as unknown as { FLAX_DB?: D1Database }).FLAX_DB;
      if (db) {
        const stage = data.stage ?? stageForAgent(data.agent);
        try {
          const stageModel = new FlaxStageModel({ db, table: "flax_stages" });
          await stageModel.openStage(
            data.conversationId,
            stage,
            data.agent,
            data.task.slice(0, 200),
          );
          const instanceModel = new FlaxInstanceModel({ db, table: "flax_instances" });
          await instanceModel.patchFields(data.conversationId, {
            currentStage: stage,
            currentAgent: data.agent,
            status: "running",
            lastActivityAt: Date.now(),
          });
        } catch {
          // pipeline telemetry is best-effort; never fail the dispatch on it
        }
      }

      log.info("dispatch.admitted", {
        agent: data.agent,
        conversationId: data.conversationId,
        status: 200,
      });
      return {
        streamUrl: receipt.streamUrl,
        offset: receipt.offset,
        submissionId: receipt.submissionId,
        stage: data.stage ?? stageForAgent(data.agent),
      };
    }

    log.info("dispatch.failed", {
      agent: data.agent,
      conversationId: data.conversationId,
    });
    return { stage: data.stage ?? stageForAgent(data.agent) };
  },
});
