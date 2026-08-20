import type { GateConfig, GateResult } from "../types.js";

export function validateStageOrder(
  current: string,
  next: string,
  stageOrder: string[],
): GateResult {
  const currentIndex = stageOrder.indexOf(current);
  const nextIndex = stageOrder.indexOf(next);

  if (currentIndex === -1) {
    return {
      pass: false,
      gate: "ordering",
      reason: `Unknown current stage: "${current}"`,
    };
  }

  if (nextIndex === -1) {
    return {
      pass: false,
      gate: "ordering",
      reason: `Unknown next stage: "${next}"`,
    };
  }

  if (nextIndex <= currentIndex) {
    return {
      pass: false,
      gate: "ordering",
      reason: `Cannot move backward from "${current}" to "${next}". Stages must advance forward.`,
    };
  }

  return { pass: true, gate: "ordering" };
}

export function orderingGate(
  input: unknown,
  context: { currentStage?: string; metadata?: Record<string, unknown> },
  config: GateConfig,
): GateResult {
  const stageOrder = config.stageOrder ?? [];
  if (stageOrder.length === 0) {
    return { pass: true, gate: "ordering" };
  }

  const obj = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const nextStage = typeof obj.stage === "string" ? obj.stage : undefined;
  const currentStage = context.currentStage;

  if (!currentStage || !nextStage) {
    return { pass: true, gate: "ordering" };
  }

  return validateStageOrder(currentStage, nextStage, stageOrder);
}
