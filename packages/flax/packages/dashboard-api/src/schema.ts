import type { D1Database } from "@cloudflare/workers-types";

/** Rail stages in pipeline order. */
export const STAGES = [
  "requirements",
  "architecture",
  "design",
  "coding",
  "review",
  "qa",
  "security",
  "devops",
  "release",
  "sre-docs",
] as const;

export type StageId = (typeof STAGES)[number];

export const STAGE_LABELS: Record<StageId, string> = {
  requirements: "Requirements",
  architecture: "Architecture",
  design: "Design",
  coding: "Coding",
  review: "Review",
  qa: "QA",
  security: "Security",
  devops: "DevOps",
  release: "Release",
  "sre-docs": "SRE / Docs",
};

export const STAGE_ORDER = STAGES;

export type ConversationStatus = "running" | "blocked_on_human" | "completed" | "failed";
export type Origin = "orchestrator" | "support";
export type HitlType =
  | "approve-reject"
  | "choose-option"
  | "pr-review"
  | "structured-form"
  | "alert";
export type HitlStatus = "pending" | "resolved" | "cancelled";
export type ArtifactType =
  | "pr"
  | "issue"
  | "doc"
  | "diagram"
  | "test_report"
  | "security_report"
  | "other";
export type AgentStatus = "idle" | "active" | "error";

export interface InstanceRow {
  id: string;
  created_at: number;
  last_seen_at: number;
  title: string | null;
  origin: string | null;
  current_stage: string | null;
  current_agent: string | null;
  status: string | null;
  last_activity_at: number | null;
}

export interface StageRow {
  id: number;
  conversation_id: string;
  stage: string;
  agent: string;
  entered_at: number;
  exited_at: number | null;
  outcome: string | null;
  detail: string | null;
}

export interface HitlRow {
  id: string;
  conversation_id: string;
  type: string;
  title: string;
  summary: string | null;
  payload: string | null;
  status: string;
  resolution: string | null;
  created_at: number;
  resolved_at: number | null;
}

export interface ArtifactRow {
  id: string;
  conversation_id: string;
  stage: string | null;
  agent: string | null;
  type: string;
  title: string | null;
  url_or_ref: string;
  created_at: number;
}

export interface AgentRow {
  name: string;
  label: string;
  stage: string | null;
  status: string;
  last_seen_at: number | null;
  last_error: string | null;
  updated_at: number | null;
}

export interface GithubAppRow {
  id: number;
  app_id: string;
  slug: string;
  client_id: string;
  client_secret: string;
  private_key: string;
  created_at: number;
}

export interface GithubInstallRow {
  installation_id: string;
  org: string;
  account_type: string;
  installed_at: number;
}

export interface GithubTokenRow {
  installation_id: string;
  token: string;
  expires_at: number;
  updated_at: number;
}

/**
 * Bootstrap the dashboard schema. Safe to run on every worker start: creates
 * missing tables and backfills missing columns on `flax_instances` (D1 does not
 * support `ADD COLUMN IF NOT EXISTS`).
 */
export async function ensureSchema(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_instances (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        agent TEXT NOT NULL,
        entered_at INTEGER NOT NULL,
        exited_at INTEGER,
        outcome TEXT,
        detail TEXT
      )`,
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_flax_stages_conversation ON flax_stages(conversation_id, entered_at)",
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_hitl (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        resolution TEXT,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
      )`,
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_flax_hitl_conversation ON flax_hitl(conversation_id, status)",
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_artifacts (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        stage TEXT,
        agent TEXT,
        type TEXT NOT NULL,
        title TEXT,
        url_or_ref TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_flax_artifacts_conversation ON flax_artifacts(conversation_id, created_at)",
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_agents (
        name TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        stage TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        last_seen_at INTEGER,
        last_error TEXT,
        updated_at INTEGER
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_github_app (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        app_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        private_key TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_github_install (
        installation_id TEXT PRIMARY KEY,
        org TEXT NOT NULL,
        account_type TEXT NOT NULL,
        installed_at INTEGER NOT NULL
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS flax_github_token (
        installation_id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    )
    .run();

  const columns = await db.prepare("PRAGMA table_info(flax_instances)").all<{ name: string }>();
  const existing = new Set(columns.results?.map((c) => c.name) ?? []);
  const addColumn = [
    ["title", "TEXT"],
    ["origin", "TEXT NOT NULL DEFAULT 'orchestrator'"],
    ["current_stage", "TEXT"],
    ["current_agent", "TEXT"],
    ["status", "TEXT NOT NULL DEFAULT 'running'"],
    ["last_activity_at", "INTEGER"],
  ] as const;
  for (const [name, def] of addColumn) {
    if (!existing.has(name)) {
      await db.prepare(`ALTER TABLE flax_instances ADD COLUMN ${name} ${def}`).run();
    }
  }

  const seeded = await db.prepare("SELECT COUNT(*) AS n FROM flax_agents").first<{ n: number }>();
  if ((seeded?.n ?? 0) === 0) {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO flax_agents (name, label, stage, status) VALUES (?, ?, ?, 'idle')",
    );
    for (const a of AGENT_SEED) {
      await stmt.bind(a.name, a.label, a.stage).run();
    }
  }
}

export interface AgentSeed {
  name: string;
  label: string;
  stage: StageId | null;
}

export const AGENT_SEED: AgentSeed[] = [
  { name: "orchestrator", label: "Orchestrator", stage: null },
  { name: "product-requirements", label: "Product Requirements", stage: "requirements" },
  { name: "business-data-analyst", label: "Data Analyst", stage: "requirements" },
  { name: "solutions-architect", label: "Solutions Architect", stage: "architecture" },
  { name: "ux-ui-designer", label: "UX/UI Designer", stage: "design" },
  { name: "coding", label: "Coding", stage: "coding" },
  { name: "database-data-engineer", label: "Data Engineer", stage: "coding" },
  { name: "code-review", label: "Code Review", stage: "review" },
  { name: "qa-test", label: "QA", stage: "qa" },
  { name: "security-appsec", label: "Security", stage: "security" },
  { name: "devops-cicd", label: "DevOps", stage: "devops" },
  { name: "release-manager", label: "Release Manager", stage: "release" },
  { name: "sre-observability", label: "SRE", stage: "sre-docs" },
  { name: "documentation", label: "Documentation", stage: "sre-docs" },
  { name: "support-feedback", label: "Feedback", stage: "sre-docs" },
  { name: "support", label: "Support", stage: "requirements" },
];

/** Map an agent name to the pipeline stage it contributes to. */
export function stageForAgent(agent: string): StageId {
  return AGENT_SEED.find((a) => a.name === agent)?.stage ?? "requirements";
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as StageId] ?? stage;
}
