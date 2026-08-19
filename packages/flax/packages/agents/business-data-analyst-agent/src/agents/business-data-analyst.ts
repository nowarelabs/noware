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
  useSandbox,
  useSkill,
  useSubagent,
  useTool,
  bash,
} from '@flue/runtime';
import * as v from 'valibot';
import { Bash, InMemoryFs } from 'just-bash';

import cohortFunnelAnalysis from '../skills/cohort-funnel-analysis/SKILL.md';
import { analyticsTool } from '../tools/analytics-tool';
import { dbClientTool } from '../tools/db-client-tool';
import { webSearchTool } from '../tools/web-search-tool';

interface AnalysisState {
  status: 'idle' | 'querying' | 'analyzing' | 'done';
  question: string;
  findings: string[];
}

function SqlReviewer() {
  return `You are a SQL reviewer. Given a SQL query, check it for correctness, performance traps (unindexed filters, N+1, cartesian joins), and safety (no accidental full-table mutation). Return APPROVED or REVISE with the specific problem and a corrected snippet. Be terse.`;
}

export function BusinessDataAnalyst() {
  useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
    thinkingLevel: 'low',
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'Only report numbers you actually retrieved with a tool - never estimate from memory. Write queries with explicit column lists, correct join conditions, aggregations, and window functions, and prefer set-based logic over N+1 patterns. Describe distributions, central tendency, and variance, apply the correct hypothesis test, and interpret confidence intervals. Flag confounders and small sample sizes, state sample size and explicit confidence for every finding, and tie each number back to the decision it informs. Delegate complex queries to the sql-reviewer subagent before running them.',
  );

  const [analysis, setAnalysis] = usePersistentState<AnalysisState>('analysis', {
    status: 'idle',
    question: '',
    findings: [],
  });

  const writeAnalysis = useDataWriter('analysis', {
    schema: v.object({
      status: v.picklist(['idle', 'querying', 'analyzing', 'done']),
      question: v.string(),
      findings: v.array(v.string()),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ question?: string }>();

  useAgentStart(({ log }) => {
    const question = analysis.question || initialData?.question || delivery.body;
    log.info('analysis.started', { question });
    setAnalysis((prev) => ({ ...prev, status: 'querying', question }));
    writeAnalysis({ status: 'querying', question, findings: analysis.findings });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info('analysis.finished', { toolCalls: response.toolCalls.length });
    setAnalysis((prev) => ({ ...prev, status: 'done' }));
    writeAnalysis({ status: 'done', question: analysis.question, findings: analysis.findings });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSkill(cohortFunnelAnalysis);
  useSubagent({
    name: 'sql-reviewer',
    description: 'Reviews a SQL query for correctness, performance, and safety before it is executed. Use before running a complex or destructive query.',
    agent: SqlReviewer,
  });
  useTool(analyticsTool);
  useTool(dbClientTool);
  useTool(webSearchTool);

  return `You are the Business Data Analyst agent. Translate business questions into queries, pull data with your tools instead of guessing, and run the correct statistical test for the question. Report findings with explicit confidence, surface confounders and small samples, and tie every number back to the decision it informs.`;
}
