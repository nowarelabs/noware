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
  useSubagent,
  useTool,
  defineAgent,
} from "@nowarelabs/agents";
import * as v from "valibot";

import { jiraLinearTool } from "../tools/jira-linear-tool";
import { supportTicketsTool } from "../tools/support-tickets-tool";
import { sentimentAnalysisTool } from "../tools/sentiment-analysis-tool";
import { webSearchTool } from "../tools/web-search-tool";

interface TriageState {
  status: "idle" | "triaging" | "done";
  ticket: string;
  severity: string;
  category: string;
}

const issueTriage = defineAgent("issue-triage", () => {
  // cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct
  useModel("ollama/qwen2.5-coder:7b", {
    thinkingLevel: "low",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Given a user issue or ticket, pull the ticket with your tools and triage it: produce a 1-2 sentence summary, a category (bug | how-to | billing | account | performance | other), a severity (low | medium | high) with impact, and clarifying questions if needed, then recommend concrete next steps. Restate the problem to confirm understanding, set expectations about next steps, avoid jargon, and acknowledge the user frustration without being defensive. Search the knowledge base for a known solution first; if the issue is unresolved, security- or billing-sensitive, or outside your scope, hand off with a full context summary: ticket id, symptom, what was tried, and the recommended owner. Be concise and never invent details. Ticket updates and escalation are durable: they are recorded and replayed, never duplicated, after a crash.",
  );

  const [triage, setTriage] = usePersistentState<TriageState>("triage", {
    status: "idle",
    ticket: "",
    severity: "",
    category: "",
  });

  const writeSupport = useDataWriter("support", {
    schema: v.object({
      status: v.picklist(["idle", "triaging", "done"]),
      ticket: v.string(),
      severity: v.string(),
      category: v.string(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ ticket?: string }>();

  useAgentStart(({ log }) => {
    const ticket =
      triage.ticket ||
      initialData?.ticket ||
      (delivery.kind === "signal" ? delivery.attributes?.ticket : undefined) ||
      "unknown";
    log.info("triage.started", { ticket });
    setTriage({ ...triage, status: "triaging", ticket });
    writeSupport({
      status: "triaging",
      ticket,
      severity: triage.severity,
      category: triage.category,
    });
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
    log.info("triage.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    setTriage({ ...triage, status: "done" });
    writeSupport({
      status: "done",
      ticket: triage.ticket,
      severity: triage.severity,
      category: triage.category,
    });
  });

  useSubagent(
    "triage-reviewer",
    "Reviews a ticket triage for severity accuracy, invented details, and actionable next steps before it is sent.",
    GeneralSubagent,
  );
  useTool(jiraLinearTool);
  useTool(supportTicketsTool);
  useTool(sentimentAnalysisTool);
  useTool(webSearchTool);

  return `You are the Support agent. Given a user issue or ticket, pull the ticket with your tools, triage it (summary, category, severity, clarifying questions, next steps), search the knowledge base when useful, create backlog items when needed, and reply to the user empathetically. Be concise and never invent details.`;
});

export default issueTriage;
