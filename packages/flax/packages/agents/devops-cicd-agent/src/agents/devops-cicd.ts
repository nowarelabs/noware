"use agent";

import {
  GeneralSubagent,
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
  useSubagent,
  useTool,
  bash,
  defineAgent,
} from "@nowarelabs/agents";
import * as v from "valibot";
import { Bash, InMemoryFs } from "just-bash";

import { cicdPipelineTool } from "../tools/cicd-pipeline-tool";
import { containersTool } from "../tools/containers-tool";
import { iacTool } from "../tools/iac-tool";

interface DeployState {
  status: "idle" | "planning" | "applying" | "done";
  environment: string;
}

const devopsCicd = defineAgent("devops-cicd", () => {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "medium",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Provision infrastructure as code and design fast, reversible pipelines. Treat infrastructure as reviewable, versioned code and prefer immutable, declarative definitions over drift-prone configuration. Set resource limits, probes, anti-affinity, and update strategies that keep rollouts safe and reversible. Keep pipelines fast, cached, and fail-fast with clear stages (lint, test, build, deploy) and explicit approval gates. Prefer gradual, reversible rollouts - canary, blue-green, feature flags - and define the rollback path before deploying. Never apply a plan to production without an infra-plan-reviewer pass first. Deployments are durable: triggers and applies are recorded and replayed, never duplicated, after a crash.",
  );

  const [deploy, setDeploy] = usePersistentState<DeployState>("deploy", {
    status: "idle",
    environment: "",
  });

  const writeDeploy = useDataWriter("deploy", {
    schema: v.object({
      status: v.picklist(["idle", "planning", "applying", "done"]),
      environment: v.string(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ environment?: string }>();

  useAgentStart(({ log }) => {
    const environment =
      deploy.environment ||
      initialData?.environment ||
      (delivery.kind === "signal" ? delivery.attributes?.environment : undefined) ||
      "staging";
    log.info("deploy.started", { environment });
    setDeploy({ ...deploy, status: "planning", environment });
    writeDeploy({ status: "planning", environment });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => {
    const r = response as { toolCalls?: unknown[] };
    return {
      elapsedMs: Date.now() - (metadata.startedAt as number),
      toolCalls: r.toolCalls?.length ?? 0,
    };
  });

  useAgentFinish(({ log, response }) => {
    const r = response as { toolCalls?: unknown[] };
    log.info("deploy.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    setDeploy({ ...deploy, status: "done" });
    writeDeploy({ status: "done", environment: deploy.environment });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent(
    "infra-plan-reviewer",
    "Reviews an infrastructure or pipeline change for drift, blast radius, rollback, and exposure before it is applied.",
    GeneralSubagent,
  );
  useTool(cicdPipelineTool);
  useTool(containersTool);
  useTool(iacTool);

  return `You are the DevOps/CI-CD agent. Provision infrastructure as code and design fast, reversible pipelines. Prefer declarative configuration, plan changes before applying them, and make rollback boring.`;
});

export default devopsCicd;
