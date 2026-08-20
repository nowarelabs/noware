"use agent";

import {
  GeneralSubagent,
  defineAgent,
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
  useSubagent,
  useTool,
} from "@nowarelabs/agents";
import * as v from "valibot";

import { dispatchAgentTool } from "../tools/dispatch-agent";
import { jiraLinearTool } from "../tools/jira-linear-tool";
import { requestHumanInputTool } from "../tools/request-human-input";
import { taskQueueTool } from "../tools/task-queue-tool";

interface PlanState {
  status: "idle" | "planning" | "in-progress" | "blocked" | "done";
  goal: string;
  nextSteps: string[];
}

const agent = defineAgent("orchestrator", () => {
  useModel("cloudflare/@cf/meta/llama-4-maverick-17b-128e-instruct", {
    thinkingLevel: "medium",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'You coordinate the build lifecycle. Dispatch one agent at a time when tasks depend on each other, in parallel when they do not. Build and walk the task dependency graph so downstream work waits on its inputs, and detect cycles early. Decompose ambiguous goals into small verifiable steps, re-plan when new information arrives, and prefer cheap early verification. Never invent agent names or conversation ids - use only values your tools return. Never silently drop a conflict - reconcile by reordering, merging, or escalating for a decision. Always pass the pipeline rail `stage` to dispatch_agent (one of requirements, architecture, design, coding, review, qa, security, devops, release, sre-docs). When a human decision is needed - a sign-off, choosing between options, a PR review approval, missing required info, or a QA/security finding that needs a call - call request_human_input with a structured payload and then STOP; the resolution arrives as a user message prefixed "[HITL resolved]" carrying the hitlId and payload. Always end your reply with a one-line status: STABLE, BLOCKED, or DONE.',
  );

  const [plan, _setPlan] = usePersistentState<PlanState>("plan", {
    status: "idle",
    goal: "",
    nextSteps: [],
  });

  const writePlan = useDataWriter("plan", {
    schema: v.object({
      status: v.picklist(["idle", "planning", "in-progress", "blocked", "done"]),
      goal: v.string(),
      nextSteps: v.array(v.string()),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ goal?: string }>();

  useAgentStart(({ log }) => {
    const goal = plan.goal || initialData?.goal || delivery.body;
    log.info("plan.started", { goal });
    writePlan({ status: "planning", goal, nextSteps: plan.nextSteps });
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
    log.info("plan.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    writePlan({ status: "done", goal: plan.goal, nextSteps: plan.nextSteps });
  });

  useSubagent(
    "plan-critic",
    "Critiques a proposed multi-step plan for missing dependencies, ambiguity, and ordering risks. Use before dispatching a complex plan.",
    GeneralSubagent,
  );
  useSubagent(
    "conflict-resolver",
    "Reconciles two or more conflicting agent outputs into a single result. Use when agents disagree or overlap.",
    GeneralSubagent,
  );
  useTool(dispatchAgentTool);
  useTool(jiraLinearTool);
  useTool(requestHumanInputTool);
  useTool(taskQueueTool);

  return `You are the Orchestrator agent. Plan multi-step work, sequence the right agents, and dispatch each task with a clear self-contained brief. Track progress on the task queue. When agents disagree, delegate to the conflict-resolver subagent; when a plan is complex, have the plan-critic subagent review it before dispatching. Keep the conversation moving to a finished result.`;
});

export default agent;
