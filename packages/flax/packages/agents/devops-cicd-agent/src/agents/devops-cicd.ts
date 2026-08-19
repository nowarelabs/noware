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

import { cicdPipelineTool } from '../tools/cicd-pipeline-tool';
import { containersTool } from '../tools/containers-tool';
import { iacTool } from '../tools/iac-tool';

interface DeployState {
  status: 'idle' | 'planning' | 'applying' | 'done';
  environment: string;
}

function InfraPlanReviewer() {
  return `You are an infrastructure reviewer. Given a planned change (IaC diff, pipeline change, or environment provisioning), check it for drift risk, blast radius, missing rollback, and security exposure. Return APPROVED or REVISE with the specific problem. Be terse.`;
}

export function DevopsCicd() {
  useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
    thinkingLevel: 'medium',
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'Provision infrastructure as code and design fast, reversible pipelines. Treat infrastructure as reviewable, versioned code and prefer immutable, declarative definitions over drift-prone configuration. Set resource limits, probes, anti-affinity, and update strategies that keep rollouts safe and reversible. Keep pipelines fast, cached, and fail-fast with clear stages (lint, test, build, deploy) and explicit approval gates. Prefer gradual, reversible rollouts - canary, blue-green, feature flags - and define the rollback path before deploying. Never apply a plan to production without an infra-plan-reviewer pass first. Deployments are durable: triggers and applies are recorded and replayed, never duplicated, after a crash.',
  );

  const [deploy, setDeploy] = usePersistentState<DeployState>('deploy', {
    status: 'idle',
    environment: '',
  });

  const writeDeploy = useDataWriter('deploy', {
    schema: v.object({
      status: v.picklist(['idle', 'planning', 'applying', 'done']),
      environment: v.string(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ environment?: string }>();

  useAgentStart(({ log }) => {
    const environment = deploy.environment || initialData?.environment || (delivery.kind === 'signal' ? delivery.attributes?.environment : undefined) || 'staging';
    log.info('deploy.started', { environment });
    setDeploy((prev) => ({ ...prev, status: 'planning', environment }));
    writeDeploy({ status: 'planning', environment });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info('deploy.finished', { toolCalls: response.toolCalls.length });
    setDeploy((prev) => ({ ...prev, status: 'done' }));
    writeDeploy({ status: 'done', environment: deploy.environment });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent({
    name: 'infra-plan-reviewer',
    description: 'Reviews an infrastructure or pipeline change for drift, blast radius, rollback, and exposure before it is applied.',
    agent: InfraPlanReviewer,
  });
  useTool(cicdPipelineTool);
  useTool(containersTool);
  useTool(iacTool);

  return `You are the DevOps/CI-CD agent. Provision infrastructure as code and design fast, reversible pipelines. Prefer declarative configuration, plan changes before applying them, and make rollback boring.`;
}
