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
} from '@nowarelabs/agents';
import * as v from 'valibot';
import { Bash, InMemoryFs } from 'just-bash';

import { cloudPricingTool } from '../tools/cloud-pricing-tool';
import { diagrammingTool } from '../tools/diagramming-tool';
import { iacTool } from '../tools/iac-tool';

interface DesignState {
  status: 'idle' | 'designing' | 'done';
  system: string;
  decisions: string[];
}

function TradeoffReviewer() {
  return `You are a design trade-off reviewer. Given a proposed architecture, check it against proven patterns and known failure modes. Flag over-engineering, hidden coupling, capacity assumptions, and unstated costs. Return APPROVED or REVISE with the specific trade-offs. Be terse.`;
}

export function SolutionsArchitect() {
  useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
    thinkingLevel: 'medium',
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'Design resilient distributed systems and prefer proven patterns over novelty. Apply CAP, consistency models, and partitioning, prefer eventual consistency where appropriate, and reason about failure domains, retries, and backpressure. Use patterns such as CQRS, event sourcing, strangler fig, and backends-for-frontends only where they fit the problem, and document the trade-offs of each choice. Estimate throughput, storage, and latency from explicit, verifiable load assumptions, and model compute, storage, egress, and operational costs on unit economics and total cost of ownership. Stress the design against failure modes before committing to it. Designs are durable: they are recorded and replayed, never duplicated, after a crash.',
  );

  const [design, setDesign] = usePersistentState<DesignState>('design', {
    status: 'idle',
    system: '',
    decisions: [],
  });

  const writeArchitecture = useDataWriter('architecture', {
    schema: v.object({
      status: v.picklist(['idle', 'designing', 'done']),
      system: v.string(),
      decisionCount: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ system?: string }>();

  useAgentStart(({ log }) => {
    const system = design.system || initialData?.system || (delivery.kind === 'signal' ? delivery.attributes?.system : undefined) || 'platform';
    log.info('design.started', { system });
    setDesign((prev) => ({ ...prev, status: 'designing', system }));
    writeArchitecture({ status: 'designing', system, decisionCount: design.decisions.length });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info('design.finished', { toolCalls: response.toolCalls.length });
    setDesign((prev) => ({ ...prev, status: 'done' }));
    writeArchitecture({ status: 'done', system: design.system, decisionCount: design.decisions.length });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent({
    name: 'tradeoff-reviewer',
    description: 'Reviews a proposed architecture for over-engineering, coupling, capacity assumptions, and unstated costs before it is committed.',
    agent: TradeoffReviewer,
  });
  useTool(cloudPricingTool);
  useTool(diagrammingTool);
  useTool(iacTool);

  return `You are the Solutions Architect agent. Design resilient distributed systems and prefer proven patterns over novelty. Plan capacity and cost explicitly, document the trade-offs of each decision, and stress the design against failure modes before committing to it.`;
}
