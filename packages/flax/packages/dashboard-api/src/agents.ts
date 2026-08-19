import type { D1Database } from "@cloudflare/workers-types";

import { AGENT_SEED, type AgentRow } from "./schema";

/**
 * Agents whose conversation streams the dashboard-api can read back directly
 * (bound in wrangler.jsonc). Used by the artifact scan to extract external
 * outputs (PRs, docs, diagrams, reports) from each dispatched agent's thread.
 */
const AGENT_SERVICES: Record<string, keyof Env> = {
  orchestrator: "ORCHESTRATOR_AGENT",
  coding: "CODING_AGENT",
  "code-review": "CODE_REVIEW_AGENT",
  "qa-test": "QA_TEST_AGENT",
  "security-appsec": "SECURITY_APPSEC_AGENT",
  "solutions-architect": "SOLUTIONS_ARCHITECT_AGENT",
  documentation: "DOCUMENTATION_AGENT",
  "release-manager": "RELEASE_MANAGER_AGENT",
};

export function agentService(env: Env, name: string): Fetcher | null {
  const binding = AGENT_SERVICES[name];
  if (!binding) return null;
  return (env as unknown as Record<string, Fetcher>)[binding] ?? null;
}

export interface FluePart {
  type?: string;
  state?: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  data?: unknown;
  text?: string;
  [k: string]: unknown;
}

export interface FlueMessage {
  id?: string;
  role?: string;
  purpose?: string;
  display?: string;
  parts?: FluePart[];
  [k: string]: unknown;
}

export interface FlueConversationJson {
  conversationId?: string;
  messages?: FlueMessage[];
  [k: string]: unknown;
}

/** Fetch a conversation's materialized history from an agent worker. */
export async function fetchAgentConversation(
  env: Env,
  agent: string,
  conversationId: string,
): Promise<FlueConversationJson | null> {
  const service = agentService(env, agent);
  if (!service) return null;
  try {
    const res = await service.fetch(
      new Request(
        `http://internal/agents/${agent}/${encodeURIComponent(conversationId)}?view=history`,
      ),
    );
    if (!res.ok) return null;
    return (await res.json()) as FlueConversationJson;
  } catch {
    return null;
  }
}

export async function listRoster(db: D1Database): Promise<AgentRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM flax_agents ORDER BY updated_at DESC NULLS LAST, name ASC")
    .all<AgentRow>();
  // Prefer stable pipeline order for the strip: orchestrator first, then rail order.
  const ordered = AGENT_SEED.map((seed) => {
    const row = results.find((r) => r.name === seed.name);
    return (
      row ?? {
        name: seed.name,
        label: seed.label,
        stage: seed.stage,
        status: "idle",
        last_seen_at: null,
        last_error: null,
        updated_at: null,
      }
    );
  });
  return ordered;
}
