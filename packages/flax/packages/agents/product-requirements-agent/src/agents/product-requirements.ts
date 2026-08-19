'use agent';

import {
  useAgentFinish,
  useAgentStart,
  useDataWriter,
  useDelivery,
  useInitialData,
  useInstruction,
  useModel,
  usePersistentState,
  useResponseFinish,
  useResponseStart,
  useSkill,
  useSubagent,
  useTool,
} from '@flue/runtime';
import * as v from 'valibot';

import domainModeling from '../skills/domain-modeling/SKILL.md';
import { confluenceNotionTool } from '../tools/confluence-notion-tool';
import { jiraLinearTool } from '../tools/jira-linear-tool';
import { transcriptionTool } from '../tools/transcription-tool';
import { vectorStoreTool } from '../tools/vector-store-tool';

interface RequirementsState {
  status: 'idle' | 'eliciting' | 'done';
  goal: string;
  stories: string[];
  decisions: string[];
}

function RequirementsValidator() {
  return `You are a requirements validator. Given a set of user stories and decisions, check each story against INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable) and flag ambiguity or missing acceptance criteria. Return APPROVED or REVISE with the specific gaps. Be terse.`;
}

export function ProductRequirements() {
  useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
    thinkingLevel: 'medium',
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'Elicit complete, unambiguous requirements and ask one clarifying question at a time. Probe for implicit needs behind stated requests, ask who, what, why, when, and where, separate requirements from proposed solutions, and capture acceptance criteria for every behavior. Model the problem domain before proposing a solution, and capture every decision you make so it survives into the backlog and knowledge base. Score each item with RICE (Reach, Impact, Confidence, Effort), bucket it with MoSCoW (Must, Should, Could, Wont), and always state the score and the bucket. Evaluate each user story against INVEST and rewrite any story that fails a criterion, noting what changed. Run stories through the requirements-validator subagent before writing them up.',
  );

  const [requirements, setRequirements] = usePersistentState<RequirementsState>('requirements', {
    status: 'idle',
    goal: '',
    stories: [],
    decisions: [],
  });

  const writeRequirements = useDataWriter('requirements', {
    schema: v.object({
      status: v.picklist(['idle', 'eliciting', 'done']),
      goal: v.string(),
      storyCount: v.number(),
      decisionCount: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ goal?: string }>();

  useAgentStart(({ log }) => {
    const goal = requirements.goal || initialData?.goal || delivery.body;
    log.info('requirements.started', { goal });
    setRequirements((prev) => ({ ...prev, status: 'eliciting', goal }));
    writeRequirements({ status: 'eliciting', goal, storyCount: requirements.stories.length, decisionCount: requirements.decisions.length });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info('requirements.finished', { toolCalls: response.toolCalls.length });
    setRequirements((prev) => ({ ...prev, status: 'done' }));
    writeRequirements({ status: 'done', goal: requirements.goal, storyCount: requirements.stories.length, decisionCount: requirements.decisions.length });
  });

  useSkill(domainModeling);
  useSubagent({
    name: 'requirements-validator',
    description: 'Validates user stories against INVEST and flags ambiguity or missing acceptance criteria before they are finalized.',
    agent: RequirementsValidator,
  });
  useTool(confluenceNotionTool);
  useTool(jiraLinearTool);
  useTool(transcriptionTool);
  useTool(vectorStoreTool);

  return `You are the Product Requirements agent. Elicit complete, unambiguous requirements, ask one clarifying question at a time, and write user stories that satisfy INVEST criteria. Prioritize with RICE or MoSCoW and model the problem domain before proposing a solution. Capture decisions you make so they survive into the backlog and knowledge base.`;
}
