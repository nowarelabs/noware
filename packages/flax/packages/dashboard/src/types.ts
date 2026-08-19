// ---------------------------------------------------------------- Flue stream types

export type PartState = 'done' | string;

export interface Part {
  type: string;
  text?: string;
  state?: PartState;
  data?: unknown;
  [k: string]: unknown;
}

export interface DataPartState {
  name: string;
  data: unknown;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | string;
  purpose?: string;
  display?: string;
  submissionId?: string;
  turnId?: string;
  parts: Part[];
}

export interface Settlement {
  submissionId: string;
  outcome: 'completed' | 'failed' | 'deferred' | string;
  error?: { message?: string; type?: string; [k: string]: unknown } | null;
  answeredBySubmissionId?: string;
}

export interface Conversation {
  v: number;
  conversationId: string;
  offset: string;
  messages: ConversationMessage[];
  settlements: Settlement[];
  incarnation?: string;
}

export interface StreamPosition {
  batch: number;
  index: number;
}

export interface StreamControl {
  streamNextOffset: string;
  upToDate?: boolean;
}

export type StreamItem =
  | { type: 'stream-checkpoint'; incarnation: string }
  | {
      type: 'conversation-reset';
      conversationId: string;
      snapshot: Conversation;
      position: StreamPosition;
    }
  | {
      type: 'message-appended';
      conversationId: string;
      message: ConversationMessage;
      position: StreamPosition;
    }
  | {
      type: 'message-started';
      conversationId: string;
      messageId: string;
      submissionId: string;
      turnId: string;
      timestamp: string;
      position: StreamPosition;
    }
  | {
      type: 'message-delta';
      conversationId: string;
      messageId: string;
      kind: string;
      delta: string;
      position: StreamPosition;
    }
  | {
      type: 'message-completed';
      conversationId: string;
      messageId: string;
      timestamp: string;
      position: StreamPosition;
    }
  | { type: 'message-metadata'; conversationId: string; messageId: string; [k: string]: unknown }
  | {
      type: 'submission-settled';
      conversationId: string;
      submissionId: string;
      outcome: string;
      answeredBySubmissionId?: string;
      timestamp: string;
      position: StreamPosition;
    }
  | { type: 'data-part'; conversationId: string; messageId?: string; name: string; data: unknown };

// ---------------------------------------------------------------- dashboard API types

export type ConversationStatus = 'running' | 'blocked_on_human' | 'completed' | 'failed';
export type Origin = 'orchestrator' | 'support';
export type HitlType = 'approve-reject' | 'choose-option' | 'pr-review' | 'structured-form' | 'alert';
export type HitlStatus = 'pending' | 'resolved' | 'cancelled';
export type ArtifactType = 'pr' | 'issue' | 'doc' | 'diagram' | 'test_report' | 'security_report' | 'other';
export type AgentStatus = 'idle' | 'active' | 'error';

export const STAGES = [
  'requirements',
  'architecture',
  'design',
  'coding',
  'review',
  'qa',
  'security',
  'devops',
  'release',
  'sre-docs',
] as const;

export type StageId = (typeof STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  requirements: 'Requirements',
  architecture: 'Architecture',
  design: 'Design',
  coding: 'Coding',
  review: 'Review',
  qa: 'QA',
  security: 'Security',
  devops: 'DevOps',
  release: 'Release',
  'sre-docs': 'SRE / Docs',
};

export const HITL_TYPE_LABELS: Record<string, string> = {
  'approve-reject': 'Approval',
  'choose-option': 'Choose an option',
  'pr-review': 'PR review',
  'structured-form': 'Form',
  alert: 'Alert',
};

export interface ConversationSummary {
  id: string;
  title: string | null;
  origin: Origin | null;
  current_stage: string | null;
  current_agent: string | null;
  status: ConversationStatus | null;
  created_at: number;
  last_activity_at: number | null;
  last_seen_at: number;
  stage_count: number;
  pending_hitl: number;
  artifact_count: number;
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
  type: HitlType;
  title: string;
  summary: string | null;
  payload: string | null;
  status: HitlStatus;
  resolution: string | null;
  created_at: number;
  resolved_at: number | null;
}

export interface ArtifactRow {
  id: string;
  conversation_id: string;
  stage: string | null;
  agent: string | null;
  type: ArtifactType;
  title: string | null;
  url_or_ref: string;
  created_at: number;
}

export interface AgentRow {
  name: string;
  label: string;
  stage: string | null;
  status: AgentStatus;
  last_seen_at: number | null;
  last_error: string | null;
  updated_at: number | null;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  origin: Origin | null;
  currentStage: string | null;
  currentAgent: string | null;
  status: ConversationStatus | null;
  createdAt: number;
  lastActivityAt: number;
  stages: StageRow[];
  hitl: HitlRow[];
  artifacts: ArtifactRow[];
}

export interface ScanResult {
  conversationId: string;
  stages: number;
  hitl: number;
  artifacts: number;
  currentStage: string | null;
  currentAgent: string | null;
  status: string;
}

export interface HitlOption {
  label: string;
  value: string;
  detail?: string;
}

export interface HitlField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select' | 'toggle';
  required?: boolean;
  options?: HitlOption[];
  placeholder?: string;
}

export interface HitlPayload {
  options?: HitlOption[];
  fields?: HitlField[];
  prRef?: string;
  severity?: 'info' | 'warning' | 'critical';
}

export interface GithubStatus {
  configured: boolean;
  app: { slug: string; appId: string; clientId: string } | null;
  installation: { installationId: string; org: string; accountType: string } | null;
  bindingLive: boolean;
  manifest: Record<string, unknown>;
  installUrl: string | null;
}

export interface ResolveResult {
  hitl: HitlRow;
  merge: { merged: boolean } | null;
  unblocked: boolean;
}
