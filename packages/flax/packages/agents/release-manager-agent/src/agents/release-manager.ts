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

import { changelogTool } from '../tools/changelog-tool';
import { featureFlagsTool } from '../tools/feature-flags-tool';
import { githubTool } from '../tools/github-tool';

interface ReleaseState {
  status: 'idle' | 'planning' | 'rolling-out' | 'done';
  version: string;
  phase: string;
  rolloutPercent: number;
}

function RiskAuditor() {
  return `You are a release-risk auditor. Given a planned release and its rollout plan, assess regression risk, dependency exposure, and rollback readiness. Return APPROVED or REVISE with the specific risks in order of severity. Be terse.`;
}

export function ReleaseManager() {
  useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
    thinkingLevel: 'medium',
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'Every release must be reversible. Derive version bumps from commit history: breaking changes (major), features (minor), fixes (patch), and publish a clean, categorized changelog. Roll out in stages - canary, percentage ramp, region, then general availability - defining success metrics and abort criteria per stage. Assess blast radius, reversibility, and dependency impact before each release and gate on blocking issues and open incidents. Never cut a release without a risk-auditor pass first. Release side effects (changelogs, flags, tags, merges) are durable: they are recorded and replayed, never duplicated, after a crash.',
  );

  const [release, setRelease] = usePersistentState<ReleaseState>('release', {
    status: 'idle',
    version: '',
    phase: '',
    rolloutPercent: 0,
  });

  const writeRelease = useDataWriter('release', {
    schema: v.object({
      status: v.picklist(['idle', 'planning', 'rolling-out', 'done']),
      version: v.string(),
      phase: v.string(),
      rolloutPercent: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ version?: string }>();

  useAgentStart(({ log }) => {
    const version = release.version || initialData?.version || (delivery.kind === 'signal' ? delivery.attributes?.version : undefined) || '';
    log.info('release.started', { version });
    setRelease((prev) => ({ ...prev, status: 'planning', version }));
    writeRelease({ status: 'planning', version, phase: release.phase, rolloutPercent: release.rolloutPercent });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info('release.finished', { toolCalls: response.toolCalls.length });
    setRelease((prev) => ({ ...prev, status: 'done' }));
    writeRelease({ status: 'done', version: release.version, phase: release.phase, rolloutPercent: release.rolloutPercent });
  });

  useSubagent({
    name: 'risk-auditor',
    description: 'Assesses a planned release for regression risk, dependency exposure, and rollback readiness before it is cut.',
    agent: RiskAuditor,
  });
  useTool(changelogTool);
  useTool(featureFlagsTool);
  useTool(githubTool);

  return `You are the Release Manager agent. Derive versions semantically, sequence rollouts in phases, and assess release risk. Coordinate feature flags, changelogs, and rollback plans so every release is reversible.`;
}
