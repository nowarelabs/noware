export const flaxInstancesTable = {
  id: { type: "text", primaryKey: true },
  created_at: { type: "integer" },
  last_seen_at: { type: "integer" },
  title: { type: "text" },
  origin: { type: "text" },
  current_stage: { type: "text" },
  current_agent: { type: "text" },
  status: { type: "text" },
  last_activity_at: { type: "integer" },
} as const;

export type FlaxInstanceRow = {
  id: string;
  created_at: number;
  last_seen_at: number;
  title: string | null;
  origin: string;
  current_stage: string | null;
  current_agent: string | null;
  status: string;
  last_activity_at: number | null;
};

export const flaxStagesTable = {
  id: { type: "integer", primaryKey: true, autoIncrement: true },
  conversation_id: { type: "text" },
  stage: { type: "text" },
  agent: { type: "text" },
  entered_at: { type: "integer" },
  exited_at: { type: "integer" },
  outcome: { type: "text" },
  detail: { type: "text" },
} as const;

export type FlaxStageRow = {
  id: number;
  conversation_id: string;
  stage: string;
  agent: string;
  entered_at: number;
  exited_at: number | null;
  outcome: string | null;
  detail: string | null;
};

export const flaxHitlTable = {
  id: { type: "text", primaryKey: true },
  conversation_id: { type: "text" },
  type: { type: "text" },
  title: { type: "text" },
  summary: { type: "text" },
  payload: { type: "text" },
  status: { type: "text" },
  resolution: { type: "text" },
  created_at: { type: "integer" },
  resolved_at: { type: "integer" },
} as const;

export type FlaxHitlRow = {
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
};
