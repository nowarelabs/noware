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

import chaosEngineering from '../skills/chaos-engineering/SKILL.md';
import onCallRunbooks from '../skills/on-call-runbooks/SKILL.md';
import { logAggregationTool } from '../tools/log-aggregation-tool';
import { monitoringTool } from '../tools/monitoring-tool';
import { pagerdutyTool } from '../tools/pagerduty-tool';

interface IncidentState {
  status: 'idle' | 'investigating' | 'mitigating' | 'done';
  incident: string;
  slos: string[];
}

function IncidentReviewer() {
  return `You are an incident reviewer. Given the timeline and mitigation of an incident, check that the response was timely, the blast radius was contained, the runbook was followed, and the blameless review identifies follow-ups. Return APPROVED or REVISE with the specific gaps. Be terse.`;
}

export function SreObservability() {
  useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
    thinkingLevel: 'low',
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'Turn reliability goals into measurable SLOs and SLIs that measure real user experience, with error budgets, and prefer fewer, meaningful SLOs that teams can act on. Run incidents through to resolution: acknowledge, assess severity, contain, communicate, mitigate, then post-incident review with an accurate timeline. Page on-call before the SLO burns. Incidents and alerts are durable: they are recorded and replayed, never duplicated, after a crash.',
  );

  const [incident, setIncident] = usePersistentState<IncidentState>('incident', {
    status: 'idle',
    incident: '',
    slos: [],
  });

  const writeReliability = useDataWriter('reliability', {
    schema: v.object({
      status: v.picklist(['idle', 'investigating', 'mitigating', 'done']),
      incident: v.string(),
      sloCount: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ incident?: string }>();

  useAgentStart(({ log }) => {
    const incidentId = incident.incident || initialData?.incident || (delivery.kind === 'signal' ? delivery.attributes?.incident : undefined) || 'unassigned';
    log.info('incident.started', { incident: incidentId });
    setIncident((prev) => ({ ...prev, status: 'investigating', incident: incidentId }));
    writeReliability({ status: 'investigating', incident: incidentId, sloCount: incident.slos.length });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info('incident.finished', { toolCalls: response.toolCalls.length });
    setIncident((prev) => ({ ...prev, status: 'done' }));
    writeReliability({ status: 'done', incident: incident.incident, sloCount: incident.slos.length });
  });

  useSkill(chaosEngineering);
  useSkill(onCallRunbooks);
  useSubagent({
    name: 'incident-reviewer',
    description: 'Reviews the timeline and mitigation of an incident for containment, runbook adherence, and follow-ups before it is closed.',
    agent: IncidentReviewer,
  });
  useTool(logAggregationTool);
  useTool(monitoringTool);
  useTool(pagerdutyTool);

  return `You are the SRE/Observability agent. Turn reliability goals into measurable SLOs and SLIs, run incidents through to resolution, write runbooks, and probe failure modes with chaos experiments.`;
}
