import { Badge } from "@cloudflare/kumo";
import {
  ArrowSquareOut,
  Brain,
  CheckCircle,
  ClockCounterClockwise,
  Pulse,
  Wrench,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import type {
  DataPartState,
  ConversationMessage,
  Part,
  Settlement,
  StageRow,
  ArtifactRow,
  AgentRow,
  ConversationStatus,
} from "./types";
import { STAGES, STAGE_LABELS } from "./types";
import type { LiveMessage, LogEntry } from "./useLiveConversation";

export function outcomeVariant(outcome: string): "success" | "error" | "warning" | "secondary" {
  if (outcome === "completed") return "success";
  if (outcome === "failed") return "error";
  if (outcome === "deferred") return "warning";
  return "secondary";
}

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={i}>{token.slice(1, -1)}</code>;
    }
    return token;
  });
}

function TextBlock({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(<ul key={`ul-${blocks.length}`}>{list}</ul>);
      list = [];
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s/.test(trimmed)) {
      flushList();
      const level = trimmed.match(/^#+/)?.[0].length ?? 3;
      const content = trimmed.replace(/^#+\s*/, "");
      blocks.push(
        <div
          key={`h-${blocks.length}`}
          style={{
            fontWeight: 600,
            fontSize: level <= 2 ? "1.02rem" : "0.94rem",
            margin: "0.45rem 0 0.2rem",
          }}
        >
          {renderInline(content)}
        </div>,
      );
    } else if (/^[-*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
      list.push(
        <li key={`li-${blocks.length}-${list.length}`}>
          {renderInline(trimmed.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, ""))}
        </li>,
      );
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
    }
  }
  flushList();
  return (
    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {blocks}
      {streaming ? <span className="caret">▍</span> : null}
    </div>
  );
}

function partLabel(part: Part): string {
  switch (part.type) {
    case "thinking":
    case "reasoning":
      return "thinking";
    case "tool-input":
      return "tool call";
    case "tool-output":
      return "tool result";
    case "tool-output-error":
      return "tool error";
    default:
      return part.type;
  }
}

function PartView({ part, streaming }: { part: Part; streaming?: boolean }) {
  if (part.type === "text" && typeof part.text === "string") {
    return <TextBlock text={part.text} streaming={streaming} />;
  }
  const icon =
    part.type === "thinking" || part.type === "reasoning" ? (
      <Brain size={13} weight="duotone" />
    ) : part.type.startsWith("tool") ? (
      <Wrench size={13} weight="duotone" />
    ) : (
      <Pulse size={13} />
    );
  const body =
    typeof part.text === "string" && part.text
      ? part.text
      : part.input != null
        ? JSON.stringify(part.input, null, 2)
        : part.output != null
          ? JSON.stringify(part.output, null, 2)
          : part.arguments != null
            ? JSON.stringify(part.arguments, null, 2)
            : "";
  return (
    <details className="cf-part">
      <summary>
        <span className="chev">▶</span>
        {icon}
        <span style={{ textTransform: "capitalize" }}>{partLabel(part)}</span>
        <span style={{ flex: 1 }} />
        <Badge variant="outline">{part.type}</Badge>
      </summary>
      <pre>{body}</pre>
    </details>
  );
}

function roleMeta(message: ConversationMessage) {
  if (message.role === "user") return "you";
  const bits = ["agent"];
  if (message.turnId) bits.push(message.turnId);
  return bits.join(" · ");
}

export function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  const allDone = message.parts.every((p) => !p.state || p.state === "done");
  return (
    <div className="cf-msg" data-role={isUser ? "user" : "agent"}>
      <div className="meta">
        <span style={{ fontWeight: 600 }}>{isUser ? "You" : "Agent"}</span>
        <span className="mono" style={{ opacity: 0.85 }}>
          {roleMeta(message)}
        </span>
      </div>
      <div className="bubble">
        {isUser ? (
          <TextBlock text={message.parts.map((p) => p.text ?? "").join("\n")} />
        ) : (
          <>
            {message.parts.map((part, i) => (
              <PartView key={i} part={part} streaming={!allDone} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function LiveBubble({ live }: { live: LiveMessage }) {
  return (
    <div className="cf-msg" data-role="agent">
      <div className="meta">
        <span style={{ fontWeight: 600 }}>Agent</span>
        {live.turnId ? (
          <span className="mono" style={{ opacity: 0.85 }}>
            {live.turnId}
          </span>
        ) : null}
        <Badge variant="info">streaming</Badge>
      </div>
      <div className="bubble">
        <TextBlock text={live.text} streaming />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="cf-card cf-stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function SubmissionsTable({ settlements }: { settlements: Settlement[] }) {
  if (settlements.length === 0) return null;
  return (
    <div className="cf-card" style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.8rem",
          minWidth: 560,
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-kumo-hairline)" }}>
            {["Submission", "Outcome", "Answered by", "Error"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "0.6rem 0.85rem",
                  fontWeight: 600,
                  fontSize: "0.68rem",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--text-color-kumo-subtle)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {settlements.map((s) => (
            <tr
              key={s.submissionId}
              style={{ borderBottom: "1px solid var(--color-kumo-hairline)" }}
            >
              <td style={{ padding: "0.6rem 0.85rem" }}>
                <span className="mono" style={{ fontSize: "0.74rem" }}>
                  {s.submissionId}
                </span>
              </td>
              <td style={{ padding: "0.6rem 0.85rem" }}>
                <Badge variant={outcomeVariant(s.outcome)}>{s.outcome}</Badge>
              </td>
              <td style={{ padding: "0.6rem 0.85rem" }}>
                <span
                  className="mono"
                  style={{ fontSize: "0.74rem", color: "var(--text-color-kumo-subtle)" }}
                >
                  {s.answeredBySubmissionId ?? "—"}
                </span>
              </td>
              <td style={{ padding: "0.6rem 0.85rem" }}>
                {s.error?.message ? (
                  <span
                    className="mono"
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-color-kumo-danger)",
                      display: "block",
                      maxWidth: 420,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={s.error.message}
                  >
                    {s.error.message}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-color-kumo-inactive)" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function kindColor(kind: string): string {
  switch (kind) {
    case "complete":
      return "success";
    case "settled":
      return "info";
    case "error":
      return "error";
    case "thinking":
      return "warning";
    default:
      return "neutral";
  }
}

function kindIcon(kind: string) {
  switch (kind) {
    case "message":
      return <Pulse size={14} />;
    case "thinking":
      return <Brain size={14} />;
    case "complete":
      return <CheckCircle size={14} />;
    case "settled":
      return <ClockCounterClockwise size={14} />;
    default:
      return <Pulse size={14} />;
  }
}

export function ActivityFeed({ log }: { log: LogEntry[] }) {
  if (log.length === 0) {
    return (
      <div className="cf-empty">
        <div>
          <Pulse size={26} weight="duotone" className="icon" />
          <div className="title">No activity yet</div>
          <div className="desc">
            Send a message to watch the agent think, call tools, and respond live.
          </div>
        </div>
      </div>
    );
  }
  const entries = [...log].reverse();
  return (
    <div className="cf-timeline">
      {entries.map((entry, i) => (
        <div key={entry.id} className="entry">
          <div className="rail">
            <span className="dot" data-color={kindColor(entry.kind)} />
            {i < entries.length - 1 ? <span className="stem" /> : null}
          </div>
          <div className="body">
            <div className="top">
              <span className="ts">{entry.ts}</span>
              <span style={{ opacity: 0.75 }}>{kindIcon(entry.kind)}</span>
              <span style={{ flex: 1 }} />
              {entry.outcome ? (
                <Badge variant={outcomeVariant(entry.outcome)}>{entry.outcome}</Badge>
              ) : (
                <Badge variant="secondary">{entry.kind}</Badge>
              )}
            </div>
            <div className="detail" style={{ marginTop: "0.1rem" }}>
              {entry.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusDot({ color }: { color: "live" | "working" | "error" | "idle" }) {
  return <span className="cf-dot" data-color={color} aria-hidden />;
}

export function EmptyState({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon?: ReactNode;
}) {
  return (
    <div className="cf-empty">
      <div>
        <div className="icon">{icon ?? <WarningCircle size={30} weight="duotone" />}</div>
        <div className="title">{title}</div>
        <div className="desc">{desc}</div>
      </div>
    </div>
  );
}

function statusVariant(status: string): "success" | "warning" | "error" | "secondary" {
  if (status === "done" || status === "completed") return "success";
  if (status === "error" || status === "blocked" || status === "failed") return "error";
  if (status === "idle") return "secondary";
  return "warning";
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      const joined = value.join(" · ");
      return joined.length > 160 ? `${joined.slice(0, 157)}…` : joined;
    }
    return JSON.stringify(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DataCard({ part }: { part: DataPartState }) {
  const data = part.data as Record<string, unknown> | null;
  const isRecord = data !== null && typeof data === "object" && !Array.isArray(data);
  const status = isRecord && typeof data.status === "string" ? data.status : null;
  const entries = isRecord ? Object.entries(data).filter(([key]) => key !== "status") : [];
  return (
    <div className="cf-card cf-data-card">
      <div className="top">
        <span className="mono name">{part.name}</span>
        {status ? <Badge variant={statusVariant(status)}>{status}</Badge> : null}
        <span style={{ flex: 1 }} />
        <span className="ts">{part.updatedAt}</span>
      </div>
      {isRecord ? (
        entries.length > 0 ? (
          <div className="fields">
            {entries.map(([key, value]) => (
              <div className="row" key={key}>
                <span className="key mono">{key}</span>
                <span
                  className="val mono"
                  title={
                    typeof value === "object" && value !== null ? JSON.stringify(value) : undefined
                  }
                >
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="hint" style={{ padding: "0.65rem 0.85rem" }}>
            no fields
          </div>
        )
      ) : (
        <pre className="raw mono">{formatValue(part.data)}</pre>
      )}
    </div>
  );
}

export function DataPanel({ dataParts }: { dataParts: DataPartState[] }) {
  if (dataParts.length === 0) {
    return (
      <div className="cf-panel">
        <div className="cf-card">
          <EmptyState
            title="No data writers yet"
            desc="Agents emit structured data parts (plan status, review counts, deploy state, ...) via useDataWriter. They appear here live as the agent works."
          />
        </div>
      </div>
    );
  }
  return (
    <div className="cf-panel">
      <div className="cf-data-grid">
        {dataParts.map((part) => (
          <DataCard key={part.name} part={part} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- dashboard UI

export function conversationStatusVariant(
  status: ConversationStatus | string | null,
): "success" | "warning" | "error" | "secondary" | "info" {
  if (status === "completed") return "success";
  if (status === "blocked_on_human") return "info";
  if (status === "failed") return "error";
  if (status === "running") return "warning";
  return "secondary";
}

export function conversationStatusLabel(status: ConversationStatus | string | null): string {
  switch (status) {
    case "running":
      return "running";
    case "blocked_on_human":
      return "needs review";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return status ?? "idle";
  }
}

export function StageBadge({ stage, active }: { stage: string; active?: boolean }) {
  const idx = STAGES.indexOf(stage as (typeof STAGES)[number]);
  return (
    <span className="cf-stage" data-active={active ? "true" : "false"}>
      {idx >= 0 ? <span className="num">{idx + 1}</span> : null}
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

/** Agent roster strip shown across the dashboard. */
export function RosterStrip({ agents }: { agents: AgentRow[] }) {
  if (agents.length === 0) return null;
  return (
    <div className="cf-roster">
      {agents.map((agent) => (
        <div key={agent.name} className="agent" title={`${agent.label} · ${agent.status}`}>
          <span className="dot" data-status={agent.status} />
          <span className="label">{agent.label}</span>
          {agent.stage ? <span className="stage mono">{agent.stage}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Horizontal pipeline rail: stages light up as the conversation walks them. */
export function PipelineRail({
  stages,
  currentStage,
}: {
  stages: StageRow[];
  currentStage: string | null;
}) {
  const open = stages.find((s) => s.exited_at === null);
  const activeIdx = open
    ? STAGES.indexOf(open.stage as (typeof STAGES)[number])
    : STAGES.indexOf(currentStage as (typeof STAGES)[number]);
  const completed = new Set(stages.filter((s) => s.exited_at !== null).map((s) => s.stage));
  return (
    <div className="cf-rail">
      {STAGES.map((stage, i) => {
        const state = completed.has(stage)
          ? "done"
          : i === activeIdx
            ? "active"
            : i < activeIdx
              ? "skipped"
              : "pending";
        return (
          <div key={stage} className="node" data-state={state}>
            <div className="cap">
              <span className="num">{i + 1}</span>
              <span className="label">{STAGE_LABELS[stage]}</span>
            </div>
            {i < STAGES.length - 1 ? <div className="link" /> : null}
          </div>
        );
      })}
    </div>
  );
}

const ARTIFACT_ICONS: Record<string, ReactNode> = {
  pr: <ArrowSquareOut size={15} />,
  issue: <WarningCircle size={15} />,
  doc: <Wrench size={15} />,
  diagram: <Pulse size={15} />,
  test_report: <CheckCircle size={15} />,
  security_report: <WarningCircle size={15} />,
  other: <ArrowSquareOut size={15} />,
};

export function ArtifactCard({ artifact }: { artifact: ArtifactRow }) {
  const title = artifact.title ?? artifact.url_or_ref;
  return (
    <a
      className="cf-artifact"
      href={artifact.url_or_ref}
      target="_blank"
      rel="noreferrer"
      title={artifact.url_or_ref}
    >
      <span className="icon">{ARTIFACT_ICONS[artifact.type] ?? ARTIFACT_ICONS.other}</span>
      <span className="body">
        <span className="title">{title.slice(0, 120)}</span>
        <span className="meta mono">
          {artifact.type}
          {artifact.agent ? ` · ${artifact.agent}` : ""}
          {artifact.stage ? ` · ${artifact.stage}` : ""}
        </span>
      </span>
      <ArrowSquareOut size={12} className="open" />
    </a>
  );
}
