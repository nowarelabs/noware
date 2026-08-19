"use agent";

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
} from "@flue/runtime";
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

function TicketTriageReviewer() {
  return `You are a support triage reviewer. Given a ticket and its triage (summary, category, severity, clarifying questions, next steps), check that the severity matches the impact, nothing was invented, and the next steps are actionable. Return APPROVED or REVISE with the specific issue. Be terse.`;
}

export function IssueTriage() {
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
    setTriage((prev) => ({ ...prev, status: "triaging", ticket }));
    writeSupport({
      status: "triaging",
      ticket,
      severity: triage.severity,
      category: triage.category,
    });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info("triage.finished", { toolCalls: response.toolCalls.length });
    setTriage((prev) => ({ ...prev, status: "done" }));
    writeSupport({
      status: "done",
      ticket: triage.ticket,
      severity: triage.severity,
      category: triage.category,
    });
  });

  useSubagent({
    name: "triage-reviewer",
    description:
      "Reviews a ticket triage for severity accuracy, invented details, and actionable next steps before it is sent.",
    agent: TicketTriageReviewer,
  });
  useTool(jiraLinearTool);
  useTool(supportTicketsTool);
  useTool(sentimentAnalysisTool);
  useTool(webSearchTool);

  return `You are the Support agent. Given a user issue or ticket, pull the ticket with your tools, triage it (summary, category, severity, clarifying questions, next steps), search the knowledge base when useful, create backlog items when needed, and reply to the user empathetically. Be concise and never invent details.`;
}
