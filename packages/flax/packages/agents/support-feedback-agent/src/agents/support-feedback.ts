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
  useSubagent,
  useTool,
} from "@nowarelabs/agents";
import * as v from "valibot";

import { jiraLinearTool } from "../tools/jira-linear-tool";
import { sentimentAnalysisTool } from "../tools/sentiment-analysis-tool";
import { supportTicketsTool } from "../tools/support-tickets-tool";

interface FeedbackState {
  status: "idle" | "triaging" | "done";
  ticket: string;
  patterns: string[];
}

function PatternMatchReviewer() {
  return `You are a root-cause pattern reviewer. Given a ticket and the matched root-cause patterns, check that the match is supported by the evidence, the owner assignment makes sense, and the handoff context is complete. Return APPROVED or REVISE with the specific gap. Be terse.`;
}

export function SupportFeedback() {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "low",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Triage tickets quickly: classify issues by type, severity, and area, ask for missing information, and escalate urgent or security-sensitive issues immediately. Match symptoms to known root-cause patterns from past incidents and knowledge base articles, state confidence and next step, and route work to the right owner with enough context to act. Acknowledge every ticket, set expectations, and never invent facts. Ticket updates and routing are durable: they are recorded and replayed, never duplicated, after a crash.",
  );

  const [feedback, setFeedback] = usePersistentState<FeedbackState>("feedback", {
    status: "idle",
    ticket: "",
    patterns: [],
  });

  const writeFeedback = useDataWriter("feedback", {
    schema: v.object({
      status: v.picklist(["idle", "triaging", "done"]),
      ticket: v.string(),
      patternCount: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ ticket?: string }>();

  useAgentStart(({ log }) => {
    const ticket =
      feedback.ticket ||
      initialData?.ticket ||
      (delivery.kind === "signal" ? delivery.attributes?.ticket : undefined) ||
      "unknown";
    log.info("feedback.started", { ticket });
    setFeedback((prev) => ({ ...prev, status: "triaging", ticket }));
    writeFeedback({ status: "triaging", ticket, patternCount: feedback.patterns.length });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info("feedback.finished", { toolCalls: response.toolCalls.length });
    setFeedback((prev) => ({ ...prev, status: "done" }));
    writeFeedback({
      status: "done",
      ticket: feedback.ticket,
      patternCount: feedback.patterns.length,
    });
  });

  useSubagent({
    name: "pattern-match-reviewer",
    description:
      "Reviews a root-cause pattern match for evidence, owner assignment, and handoff context before a ticket is routed.",
    agent: PatternMatchReviewer,
  });
  useTool(jiraLinearTool);
  useTool(sentimentAnalysisTool);
  useTool(supportTicketsTool);

  return `You are the Support & Feedback agent. Triage tickets quickly, match symptoms to known root-cause patterns, and route work to the right owner with enough context to act. Acknowledge every ticket, set expectations, and never invent facts.`;
}
