import { defineTool } from '@nowarelabs/agents';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

import { ensureSchema, openStage, patchInstance, stageForAgent } from '../dashboard-db';

const AGENTS = {
  'product-requirements': 'PRODUCT_REQUIREMENTS_AGENT',
  'business-data-analyst': 'BUSINESS_DATA_ANALYST_AGENT',
  'solutions-architect': 'SOLUTIONS_ARCHITECT_AGENT',
  'ux-ui-designer': 'UX_UI_DESIGNER_AGENT',
  'coding': 'CODING_AGENT',
  'database-data-engineer': 'DATABASE_DATA_ENGINEER_AGENT',
  'code-review': 'CODE_REVIEW_AGENT',
  'qa-test': 'QA_TEST_AGENT',
  'security-appsec': 'SECURITY_APPSEC_AGENT',
  'devops-cicd': 'DEVOPS_CICD_AGENT',
  'release-manager': 'RELEASE_MANAGER_AGENT',
  'sre-observability': 'SRE_OBSERVABILITY_AGENT',
  'documentation': 'DOCUMENTATION_AGENT',
  'support-feedback': 'SUPPORT_FEEDBACK_AGENT',
  'support': 'SUPPORT_AGENT',
} as const;

const agentNames = v.picklist([
  'product-requirements',
  'business-data-analyst',
  'solutions-architect',
  'ux-ui-designer',
  'coding',
  'database-data-engineer',
  'code-review',
  'qa-test',
  'security-appsec',
  'devops-cicd',
  'release-manager',
  'sre-observability',
  'documentation',
  'support-feedback',
  'support',
]);

const railStages = v.picklist([
  'requirements',
  'architecture',
  'design',
  'coding',
  'review',
  'qa',
  'security',
  'devops',
  'release',
  'sre-docs',
]);

export const dispatchAgentTool = defineTool({
  name: 'dispatch_agent',
  description:
    'Dispatch a task to another agent. Fire-and-forget: the agent acknowledges immediately and runs asynchronously; its reply lands in the shared conversation. Pass `stage` (the pipeline rail stage this dispatch contributes to) and `attributes` to carry structured context the target reads via useDelivery. Returns the admission receipt (streamUrl, offset, submissionId).',
  input: v.object({
    agent: agentNames,
    conversationId: v.string(),
    task: v.string(),
    stage: v.optional(railStages),
    attributes: v.optional(v.record(v.string(), v.string())),
  }),
  output: v.object({
    streamUrl: v.optional(v.string()),
    offset: v.optional(v.number()),
    submissionId: v.optional(v.string()),
    stage: v.optional(v.string()),
  }),
  async run({ data, log }) {
    const binding = (env as unknown as Record<string, Fetcher>)[AGENTS[data.agent]];
    const response = await binding.fetch(
      new Request(`http://localhost/agents/${data.agent}/${data.conversationId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'signal',
          type: 'orchestrator.task',
          body: data.task,
          attributes: { ...data.attributes, dispatchedBy: 'orchestrator', stage: data.stage ?? stageForAgent(data.agent) },
        }),
      }),
    );
    const receipt = (await response.json()) as unknown;

    const db = (env as unknown as { FLAX_DB?: D1Database }).FLAX_DB;
    if (db && response.ok) {
      const stage = data.stage ?? stageForAgent(data.agent);
      try {
        await ensureSchema(db);
        await openStage(db, data.conversationId, stage, data.agent, data.task.slice(0, 200));
        await patchInstance(db, data.conversationId, {
          currentStage: stage,
          currentAgent: data.agent,
          status: 'running',
          lastActivityAt: Date.now(),
        });
      } catch {
        // pipeline telemetry is best-effort; never fail the dispatch on it
      }
    }

    log.info('dispatch.admitted', { agent: data.agent, conversationId: data.conversationId, status: response.status });
    return {
      output: {
        ...(receipt as { streamUrl?: string; offset?: number; submissionId?: string }),
        stage: data.stage ?? stageForAgent(data.agent),
      },
    };
  },
});
