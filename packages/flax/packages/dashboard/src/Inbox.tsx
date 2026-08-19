import { Badge, Button, InputGroup } from '@cloudflare/kumo';
import { Plus, PaperPlaneTilt } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { createConversation, listAgents, listConversations } from './api';
import { conversationStatusLabel, conversationStatusVariant, RosterStrip, StageBadge } from './components';
import { HitlWidget } from './hitl';
import { href } from './router';
import type { AgentRow, ConversationSummary } from './types';

type Filter = 'all' | 'running' | 'needs-review' | 'completed';

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '—';
  const delta = Date.now() - ts;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export function Inbox({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [convs, ags] = await Promise.all([listConversations(), listAgents()]);
      if (cancelled) return;
      setConversations(convs);
      setAgents(ags);
    })().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const start = async () => {
    if (!draft.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createConversation(draft.trim());
      setDraft('');
      refresh();
      onNavigate(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const filtered = conversations.filter((c) => {
    if (filter === 'running') return c.status === 'running';
    if (filter === 'needs-review') return c.pending_hitl > 0 || c.status === 'blocked_on_human';
    if (filter === 'completed') return c.status === 'completed';
    return true;
  });

  return (
    <div className="cf-content inbox">
      <div className="inbox-header">
        <div>
          <h2 className="inbox-title">Inbox</h2>
          <p className="inbox-sub">Conversations orchestrated across the agent roster</p>
        </div>
        <div className="new-conversation">
          <InputGroup>
            <InputGroup.Input
              aria-label="Start a new conversation"
              placeholder="What should Flax build?"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void start();
              }}
            />
            <InputGroup.Addon align="end">
              <InputGroup.Button variant="primary" onClick={() => void start()} disabled={creating || !draft.trim()}>
                <Plus size={15} /> {creating ? 'Starting…' : 'Start'}
              </InputGroup.Button>
            </InputGroup.Addon>
          </InputGroup>
        </div>
      </div>

      {error ? (
        <div className="cf-error">
          <span style={{ fontWeight: 600 }}>Error</span>
          <span style={{ opacity: 0.85 }}>{error}</span>
        </div>
      ) : null}

      <div className="filters">
        {(['all', 'running', 'needs-review', 'completed'] as Filter[]).map((f) => (
          <button
            key={f}
            className="chip"
            data-active={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === 'needs-review' ? 'Needs review' : f}
            {f === 'needs-review' && conversations.some((c) => c.pending_hitl > 0)
              ? ` ${conversations.reduce((n, c) => n + c.pending_hitl, 0)}`
              : ''}
          </button>
        ))}
      </div>

      <RosterStrip agents={agents} />

      <div className="conversation-list">
        {filtered.length === 0 ? (
          <div className="cf-card empty-inbox">
            <div className="cf-empty">
              <div>
                <div className="title">No conversations</div>
                <div className="desc">
                  {conversations.length === 0
                    ? 'Start one above — Flax will plan, dispatch agents, and stream the work back.'
                    : 'Nothing in this filter yet.'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="cf-card conversation-row" onClick={() => onNavigate(c.id)}>
              <div className="main">
                <div className="top">
                  <span className="title">{c.title ?? c.id}</span>
                  <Badge variant={conversationStatusVariant(c.status)}>{conversationStatusLabel(c.status)}</Badge>
                  {c.pending_hitl > 0 ? <Badge variant="info">needs review ×{c.pending_hitl}</Badge> : null}
                </div>
                <div className="meta mono">
                  <span>{c.id}</span>
                  <span>·</span>
                  <span>{timeAgo(c.last_activity_at ?? c.last_seen_at)}</span>
                  <span>·</span>
                  <span>{c.stage_count} stages</span>
                  {c.artifact_count > 0 ? (
                    <>
                      <span>·</span>
                      <span>{c.artifact_count} artifacts</span>
                    </>
                  ) : null}
                </div>
                {c.current_stage ? (
                  <div className="stage">
                    <StageBadge stage={c.current_stage} active={c.status === 'running'} />
                    {c.current_agent ? <span className="agent mono">{c.current_agent}</span> : null}
                  </div>
                ) : null}
              </div>
              <Button variant="ghost" size="xs" className="open">
                <PaperPlaneTilt size={13} /> Open
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
