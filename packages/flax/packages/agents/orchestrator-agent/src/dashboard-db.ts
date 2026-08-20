import type { D1Database } from "@cloudflare/workers-types";

import { FlaxInstanceModel, type InstancePatch } from "./models/flax-instance.model.js";
import { FlaxStageModel } from "./models/flax-stage.model.js";
import { FlaxHitlModel, type HitlRecord } from "./models/flax-hitl.model.js";

/** Rail stage an agent contributes to (mirrors dashboard-api's stageForAgent). */
export const STAGE_MAP: Record<string, string> = {
  "product-requirements": "requirements",
  "business-data-analyst": "requirements",
  "solutions-architect": "architecture",
  "ux-ui-designer": "design",
  coding: "coding",
  "database-data-engineer": "coding",
  "code-review": "review",
  "qa-test": "qa",
  "security-appsec": "security",
  "devops-cicd": "devops",
  "release-manager": "release",
  "sre-observability": "sre-docs",
  documentation: "sre-docs",
  "support-feedback": "sre-docs",
  support: "requirements",
};

export const RAIL_STAGES = [
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

export type RailStage = (typeof RAIL_STAGES)[number];

export function stageForAgent(agent: string): RailStage {
  return (STAGE_MAP[agent] as RailStage | undefined) ?? "requirements";
}

let schemaReady: Promise<void> | null = null;

/**
 * Ensure the dashboard-facing tables/columns this agent writes exist. Safe to
 * call repeatedly; D1 has no `ADD COLUMN IF NOT EXISTS`, so we PRAGMA-check.
 */
export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await FlaxInstanceModel.ensureSchema(db);
      await FlaxStageModel.ensureSchema(db);
      await FlaxHitlModel.ensureSchema(db);
    })();
  }
  return schemaReady;
}

export type { InstancePatch };

export async function patchInstance(
  db: D1Database,
  id: string,
  patch: InstancePatch,
): Promise<void> {
  const model = new FlaxInstanceModel({ db, table: "flax_instances" });
  await model.patchFields(id, patch);
}

/** Record a stage entry, closing whatever stage was open before it. */
export async function openStage(
  db: D1Database,
  conversationId: string,
  stage: string,
  agent: string,
  detail?: string,
): Promise<void> {
  const model = new FlaxStageModel({ db, table: "flax_stages" });
  await model.openStage(conversationId, stage, agent, detail);
}

export async function closeOpenStage(
  db: D1Database,
  conversationId: string,
  outcome = "completed",
  detail?: string,
): Promise<void> {
  const model = new FlaxStageModel({ db, table: "flax_stages" });
  await model.closeOpenStage(conversationId, outcome, detail);
}

export type { HitlRecord };

export async function insertHitl(db: D1Database, hitl: HitlRecord): Promise<void> {
  const model = new FlaxHitlModel({ db, table: "flax_hitl" });
  await model.insertHitl(hitl);
}

export async function pendingHitlCount(db: D1Database, conversationId: string): Promise<number> {
  const model = new FlaxHitlModel({ db, table: "flax_hitl" });
  return model.pendingCount(conversationId);
}

export async function hasOpenStage(db: D1Database, conversationId: string): Promise<boolean> {
  const model = new FlaxStageModel({ db, table: "flax_stages" });
  return model.hasOpenStage(conversationId);
}
