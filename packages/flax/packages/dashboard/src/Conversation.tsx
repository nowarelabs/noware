import { Badge, Button, InputGroup, Loader, Tabs } from "@cloudflare/kumo";
import { ArrowClockwise, ArrowSquareOut, PaperPlaneTilt, Scan } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { agentJsonUrl, fetchConversationDetail, scanConversation } from "./api";
import {
  ArtifactCard,
  conversationStatusLabel,
  conversationStatusVariant,
  EmptyState,
  LiveBubble,
  MessageBubble,
  PipelineRail,
  StageBadge,
  StatCard,
} from "./components";
import { HitlWidget } from "./hitl";
import type { ConversationDetail as Detail, HitlRow } from "./types";
import { STAGE_LABELS } from "./types";
import { useLiveConversation } from "./useLiveConversation";

type TabId = "chat" | "pipeline" | "artifacts";

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const delta = Date.now() - ts;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
}

export function Conversation({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [draft, setDraft] = useState("");
  const [scanning, setScanning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { status, error, messages, settlements, dataParts, live, working, sendMessage, refresh } =
    useLiveConversation(id);

  const loadDetail = useCallback(async () => {
    try {
      const d = await fetchConversationDetail(id);
      setDetail(d);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, refreshKey]);

  const onScan = async () => {
    setScanning(true);
    try {
      await scanConversation(id);
      setRefreshKey((k) => k + 1);
    } finally {
      setScanning(false);
    }
  };

  const onHitlResolved = () => {
    setRefreshKey((k) => k + 1);
  };

  const onSend = async () => {
    if (!draft.trim()) return;
    const body = draft;
    setDraft("");
    setActiveTab("chat");
    try {
      await sendMessage(body);
    } catch {
      /* surfaced via stream error */
    }
    setRefreshKey((k) => k + 1);
  };

  const pendingHitl = (detail?.hitl ?? []).filter((h) => h.status === "pending");

  return (
    <div className="conversation-scroll">
      <div className="cf-content conversation">
        <div className="conv-head">
          <div>
            <div className="cf-breadcrumb">
              <span className="crumb-link" onClick={onBack}>
                Inbox
              </span>
              <span className="sep">/</span>
              <span className="current mono">{id}</span>
            </div>
            <h2 className="conv-title">{detail?.title ?? "Conversation"}</h2>
            <div className="conv-meta mono">
              {detail?.status ? (
                <Badge variant={conversationStatusVariant(detail.status)}>
                  {conversationStatusLabel(detail.status)}
                </Badge>
              ) : null}
              {detail?.currentStage ? (
                <span>
                  <StageBadge stage={detail.currentStage} />
                </span>
              ) : null}
              {detail?.currentAgent ? <span>{detail.currentAgent}</span> : null}
              <span>{timeAgo(detail?.lastActivityAt)}</span>
            </div>
          </div>
          <div className="actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={onScan}
              disabled={scanning}
              title="Re-scan history for stages, HITL and artifacts"
            >
              <Scan size={14} /> {scanning ? "Scanning…" : "Scan"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
              title="Refresh history"
            >
              <ArrowClockwise size={14} /> Refresh
            </Button>
            <a href={agentJsonUrl(id)} target="_blank" rel="noreferrer" style={{ display: "flex" }}>
              <Button variant="ghost" size="sm" title="Open raw conversation JSON">
                <ArrowSquareOut size={14} /> JSON
              </Button>
            </a>
          </div>
        </div>

        {loadError ? (
          <div className="cf-error">
            <span style={{ fontWeight: 600 }}>Error</span>
            <span style={{ opacity: 0.85 }}>{loadError}</span>
          </div>
        ) : null}
        {error ? (
          <div className="cf-error">
            <span style={{ fontWeight: 600 }}>Stream error</span>
            <span style={{ opacity: 0.85 }}>{error}</span>
          </div>
        ) : null}

        {detail ? (
          <div className="cf-stats">
            <StatCard
              label="Status"
              value={
                <Badge variant={conversationStatusVariant(detail.status)}>
                  {conversationStatusLabel(detail.status)}
                </Badge>
              }
              hint={working ? "agent is working" : "latest run state"}
            />
            <StatCard
              label="Stage"
              value={
                detail.currentStage ? (
                  <StageBadge stage={detail.currentStage} />
                ) : (
                  <span className="cf-muted">—</span>
                )
              }
              hint={detail.currentAgent ? `led by ${detail.currentAgent}` : "not dispatched yet"}
            />
            <StatCard
              label="Stages"
              value={detail.stages.length}
              hint={`${detail.stages.filter((s) => s.exited_at === null).length} active`}
            />
            <StatCard
              label="Artifacts"
              value={detail.artifacts.length}
              hint={`${pendingHitl.length} open decision${pendingHitl.length === 1 ? "" : "s"}`}
            />
          </div>
        ) : null}

        <Tabs
          variant="underline"
          tabs={[
            { value: "chat", label: "Chat" },
            {
              value: "pipeline",
              label: `Pipeline${detail && detail.stages.length ? ` (${detail.stages.length})` : ""}`,
            },
            {
              value: "artifacts",
              label: `Artifacts${detail && detail.artifacts.length ? ` (${detail.artifacts.length})` : ""}`,
            },
          ]}
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabId)}
        />

        {activeTab === "chat" ? (
          <div className="cf-panel">
            <div className="cf-card" style={{ display: "flex", flexDirection: "column" }}>
              {pendingHitl.length > 0 ? (
                <div className="cf-hitl-stack">
                  {pendingHitl.map((h) => (
                    <HitlWidget key={h.id} hitl={h} onResolved={onHitlResolved} />
                  ))}
                </div>
              ) : null}
              {status === "loading" && messages.length === 0 ? (
                <div style={{ display: "grid", placeItems: "center", flex: 1, padding: "2rem" }}>
                  <Loader size="lg" aria-label="loading conversation" />
                </div>
              ) : status === "new" && messages.length === 0 && pendingHitl.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  desc="This conversation is ready. Send the first message and watch Flax plan, dispatch agents, and stream work back."
                />
              ) : (
                <div className="cf-chat">
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                  {live ? <LiveBubble live={live} /> : null}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "pipeline" ? (
          <div className="cf-panel">
            <div className="pipeline-tab">
              <div className="cf-card rail-card">
                <div className="rail-title">Build pipeline</div>
                <PipelineRail
                  stages={detail?.stages ?? []}
                  currentStage={detail?.currentStage ?? null}
                />
              </div>
              {detail && detail.stages.length > 0 ? (
                <div className="cf-card stage-log">
                  <table>
                    <thead>
                      <tr>
                        {["Stage", "Agent", "Entered", "Exited", "Outcome", "Detail"].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.stages.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <StageBadge stage={s.stage} active={s.exited_at === null} />
                          </td>
                          <td>
                            <span className="mono">{s.agent}</span>
                          </td>
                          <td className="mono">{timeAgo(s.entered_at)}</td>
                          <td className="mono">{s.exited_at ? timeAgo(s.exited_at) : "—"}</td>
                          <td>
                            {s.outcome ? (
                              <Badge
                                variant={
                                  s.outcome === "completed"
                                    ? "success"
                                    : s.outcome === "failed"
                                      ? "error"
                                      : "warning"
                                }
                              >
                                {s.outcome}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{s.detail ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="cf-card">
                  <EmptyState
                    title="No pipeline activity yet"
                    desc="Dispatch_agent calls show up here as the orchestrator walks the build rail."
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "artifacts" ? (
          <div className="cf-panel">
            {detail && detail.artifacts.length > 0 ? (
              <div className="cf-data-grid">
                {detail.artifacts.map((a) => (
                  <ArtifactCard key={a.id} artifact={a} />
                ))}
              </div>
            ) : (
              <div className="cf-card">
                <EmptyState
                  title="No artifacts yet"
                  desc="PRs, issues, docs, diagrams and reports produced by agents land here."
                />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {activeTab === "chat" ? (
        <div className="cf-composer">
          <div style={{ flex: 1, minWidth: 0 }}>
            <InputGroup>
              <InputGroup.Input
                aria-label="Message Flax"
                placeholder={status === "new" ? "Send the first message…" : "Message Flax…"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
              />
              <InputGroup.Addon align="end">
                <InputGroup.Button
                  variant="primary"
                  onClick={() => void onSend()}
                  disabled={!draft.trim()}
                >
                  <PaperPlaneTilt size={15} /> Send
                </InputGroup.Button>
              </InputGroup.Addon>
            </InputGroup>
            <div className="hint">
              Enter to send. Each message starts a new orchestrator turn that streams back live.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
