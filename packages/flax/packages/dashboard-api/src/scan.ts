import type { D1Database } from "@cloudflare/workers-types";

import { fetchAgentConversation, type FluePart } from "./agents";
import { stageForAgent, STAGE_LABELS, type StageId } from "./schema";
import {
  listStages,
  openStage,
  setAgentStatus,
  upsertArtifact,
  upsertHitl,
  upsertInstanceMeta,
} from "./store";

type Part = FluePart;

export interface ScanResult {
  conversationId: string;
  stages: number;
  hitl: number;
  artifacts: number;
  currentStage: string | null;
  currentAgent: string | null;
  status: string;
}

const PART_TYPES = new Set(["dynamic-tool", "tool-input", "tool-output", "tool-output-error"]);

function isDispatchCall(part: Part): boolean {
  return (
    part.toolName === "dispatch_agent" &&
    (part.type === "dynamic-tool" || part.type === "tool-input")
  );
}

function isHitlCall(part: Part): boolean {
  return (
    part.toolName === "request_human_input" &&
    (part.type === "dynamic-tool" || part.type === "tool-input")
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractArgs(part: Part): Record<string, unknown> {
  if (part.input !== undefined) return asRecord(part.input);
  const args = part.arguments ?? part.data;
  return asRecord(args);
}

function extractOutput(part: Part): unknown {
  if (part.output !== undefined) return part.output;
  const out = part.outputValue ?? part.data ?? part.result;
  return out;
}

/** Deterministic, content-addressed HITL id so re-scans never duplicate. */
async function hitlIdFor(conversationId: string, type: string, title: string): Promise<string> {
  const input = `${conversationId}|${type}|${title}`;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
  return `hitl-${hex}`;
}

const URL_KEYS = ["prUrl", "html_url", "htmlUrl", "webUrl", "url"];

interface FoundUrl {
  url: string;
  kind: string | null;
}

/** Recursively find external URLs in a tool output payload. */
function collectUrls(value: unknown, out: FoundUrl[] = []): FoundUrl[] {
  if (typeof value === "string") {
    const url = value.trim();
    if (/^https?:\/\//.test(url)) {
      out.push({ url, kind: null });
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, val] of Object.entries(record)) {
      if (URL_KEYS.includes(key) && typeof val === "string" && /^https?:\/\//.test(val)) {
        out.push({ url: val, kind: classifyUrl(val) });
      }
      if (key === "issueKey" && typeof val === "string") {
        out.push({ url: val, kind: "issue" });
      }
      collectUrls(val, out);
    }
  }
  return out;
}

function classifyUrl(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("/pull/") || u.includes("/pulls/")) return "pr";
  if (u.includes("figma.com") || u.includes("miro.com") || u.includes("excalidraw.com"))
    return "diagram";
  if (u.includes("github.com") && u.includes("/issues/")) return "issue";
  if (u.includes("notion.so") || u.includes("confluence") || u.includes("docs.google.com"))
    return "doc";
  if (u.includes("atlassian.net")) return "issue";
  return null;
}

function inferArtifactType(toolName: string | undefined, url: string, agent: string): string {
  const fromUrl = classifyUrl(url);
  if (fromUrl) return fromUrl;
  const name = `${toolName ?? ""} ${agent}`.toLowerCase();
  if (name.includes("jira") || name.includes("linear")) return "issue";
  if (name.includes("diagram")) return "diagram";
  if (name.includes("docs")) return "doc";
  if (name.includes("test")) return "test_report";
  if (name.includes("security")) return "security_report";
  if (name.includes("github")) return "pr";
  return "other";
}

function titleFromOutput(output: unknown): string | null {
  const record = asRecord(output);
  const t = record.title ?? record.name ?? record.summary;
  return typeof t === "string" && t ? t.slice(0, 160) : null;
}

export async function scanConversation(
  db: D1Database,
  env: Env,
  conversationId: string,
): Promise<ScanResult> {
  const orchestrator = await fetchAgentConversation(env, "orchestrator", conversationId);
  const messages = orchestrator?.messages ?? [];
  const dispatched: Array<{ agent: string; conversationId: string }> = [];

  let stageCount = 0;
  let hitlCount = 0;
  let artifactCount = 0;
  let lastStage: string | null = null;
  let lastAgent: string | null = null;

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!part.type || !PART_TYPES.has(part.type)) continue;

      if (isDispatchCall(part)) {
        const args = extractArgs(part);
        const agent = typeof args.agent === "string" ? args.agent : null;
        const targetConversation =
          typeof args.conversationId === "string" ? args.conversationId : conversationId;
        if (agent) {
          const stage =
            (args.stage as StageId | undefined) ??
            (asRecord(args.attributes).stage as StageId | undefined) ??
            stageForAgent(agent);
          const task = typeof args.task === "string" ? args.task : null;
          await openStage(db, conversationId, stage, agent, task ? task.slice(0, 200) : undefined);
          await upsertInstanceMeta(db, conversationId, {
            currentStage: stage,
            currentAgent: agent,
            status: "running",
            lastActivityAt: Date.now(),
          });
          await setAgentStatus(db, agent, "active");
          await setAgentStatus(db, "orchestrator", "active");
          lastStage = stage;
          lastAgent = agent;
          stageCount += 1;
          dispatched.push({ agent, conversationId: targetConversation });
        }
      } else if (isHitlCall(part)) {
        const args = extractArgs(part);
        const title = typeof args.title === "string" ? args.title : "Request for human input";
        const type = typeof args.type === "string" ? args.type : "approve-reject";
        const id = await hitlIdFor(conversationId, type, title);
        await upsertHitl(db, {
          id,
          conversation_id: conversationId,
          type,
          title,
          summary: typeof args.summary === "string" ? args.summary : undefined,
          payload: args.payload ?? args.options ?? args.fields ?? undefined,
        });
        hitlCount += 1;
      } else if (part.type === "dynamic-tool" || part.type === "tool-output") {
        const toolName = part.toolName;
        const output = extractOutput(part);
        if (output !== undefined) {
          for (const found of collectUrls(output)) {
            const inserted = await upsertArtifact(db, {
              conversation_id: conversationId,
              stage: lastStage,
              agent: lastAgent ?? toolName,
              type: inferArtifactType(toolName, found.url, lastAgent ?? ""),
              title: titleFromOutput(output),
              url_or_ref: found.url,
            });
            if (inserted) artifactCount += 1;
          }
        }
      }
    }
  }

  // Read dispatched agent conversations to pick up PRs, docs, diagrams and reports
  // they produced with their own tool bindings.
  for (const { agent } of dispatched) {
    const agentConv = await fetchAgentConversation(env, agent, conversationId);
    for (const message of agentConv?.messages ?? []) {
      for (const part of message.parts ?? []) {
        if (part.type === "dynamic-tool" && part.state === "output-available") {
          const output = extractOutput(part);
          if (output === undefined) continue;
          for (const found of collectUrls(output)) {
            const inserted = await upsertArtifact(db, {
              conversation_id: conversationId,
              stage: stageForAgent(agent),
              agent,
              type: inferArtifactType(part.toolName, found.url, agent),
              title: titleFromOutput(output),
              url_or_ref: found.url,
            });
            if (inserted) artifactCount += 1;
          }
        }
        const text = part.text ?? (typeof part.data === "string" ? part.data : undefined);
        if (typeof text === "string") {
          for (const found of collectUrlsFromText(text)) {
            const inserted = await upsertArtifact(db, {
              conversation_id: conversationId,
              stage: stageForAgent(agent),
              agent,
              type: found.kind ?? "other",
              title: null,
              url_or_ref: found.url,
            });
            if (inserted) artifactCount += 1;
          }
        }
      }
    }
  }

  const status = await currentStatus(db, conversationId, stageCount);
  if (stageCount > 0 || status === "blocked_on_human") {
    await upsertInstanceMeta(db, conversationId, {
      status,
      currentStage: lastStage ?? (await latestStage(db, conversationId)),
      currentAgent: lastAgent ?? undefined,
      lastActivityAt: Date.now(),
    });
  }
  return {
    conversationId,
    stages: stageCount,
    hitl: hitlCount,
    artifacts: artifactCount,
    currentStage: lastStage ?? (await latestStage(db, conversationId)),
    currentAgent: lastAgent,
    status,
  };
}

function extractUrlsFromText(text: string): string[] {
  const re = /https?:\/\/[^\s)\]>"']+/g;
  return text.match(re) ?? [];
}

function collectUrlsFromText(text: string): FoundUrl[] {
  return extractUrlsFromText(text)
    .filter((u) => classifyUrl(u) !== null)
    .map((url) => ({ url, kind: classifyUrl(url) }));
}

async function latestStage(db: D1Database, conversationId: string): Promise<string | null> {
  const stages = await listStages(db, conversationId);
  const last = stages[stages.length - 1];
  return last?.stage ?? null;
}

async function currentStatus(
  db: D1Database,
  conversationId: string,
  stageCount: number,
): Promise<"running" | "blocked_on_human"> {
  const pending = await db
    .prepare("SELECT COUNT(*) AS n FROM flax_hitl WHERE conversation_id = ? AND status = ?")
    .bind(conversationId, "pending")
    .first<{ n: number }>();
  if ((pending?.n ?? 0) > 0) return "blocked_on_human";
  return "running";
}

export { STAGE_LABELS };
