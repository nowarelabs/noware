"use agent";

import {
  GeneralSubagent,
  useAgentFinish,
  useAgentStart,
  useDataWriter,
  useDelivery,
  useInitialData,
  useInstruction,
  useModel,
  usePersistentState,
  useResponseFinish,
  useResponseStart,
  useSubagent,
  useTool,
  defineAgent,
} from "@nowarelabs/agents";
import * as v from "valibot";

import { accessibilityCheckerTool } from "../tools/accessibility-checker-tool";
import { figmaTool } from "../tools/figma-tool";
import { imageGenTool } from "../tools/image-gen-tool";

interface DesignState {
  status: "idle" | "designing" | "done";
  flow: string;
  variants: string[];
}

const uxUiDesigner = defineAgent("ux-ui-designer", () => {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "low",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Design task flows that match user mental models and minimize cognitive load, using progressive disclosure, clear affordances, and immediate feedback for every action. Stay consistent with the design system: design tokens, spacing, typography scale, component states, and variants. Apply WCAG 2.2 AA: contrast ratios, keyboard operability, visible focus, ARIA semantics, and non-text alternatives, verified with an automated check and manual review. Treat accessibility and clarity as requirements, not polish. Run every design past the accessibility-reviewer subagent before it ships. Designs are durable: they are recorded and replayed, never duplicated, after a crash.",
  );

  const [design, setDesign] = usePersistentState<DesignState>("design", {
    status: "idle",
    flow: "",
    variants: [],
  });

  const writeDesign = useDataWriter("design", {
    schema: v.object({
      status: v.picklist(["idle", "designing", "done"]),
      flow: v.string(),
      variantCount: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ flow?: string }>();

  useAgentStart(({ log }) => {
    const flow =
      design.flow ||
      initialData?.flow ||
      (delivery.kind === "signal" ? delivery.attributes?.flow : undefined) ||
      "untitled";
    log.info("design.started", { flow });
    setDesign({ ...design, status: "designing", flow });
    writeDesign({ status: "designing", flow, variantCount: design.variants.length });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => {
    const r = response as { toolCalls?: unknown[] };
    return {
      elapsedMs: Date.now() - (metadata.startedAt as number),
      toolCalls: r.toolCalls?.length ?? 0,
    };
  });

  useAgentFinish(({ log, response }) => {
    const r = response as { toolCalls?: unknown[] };
    log.info("design.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    setDesign({ ...design, status: "done" });
    writeDesign({ status: "done", flow: design.flow, variantCount: design.variants.length });
  });

  useSubagent(
    "accessibility-reviewer",
    "Reviews a UI design for WCAG AA violations (contrast, keyboard, focus, labels, errors) before it ships.",
    GeneralSubagent,
  );
  useTool(accessibilityCheckerTool);
  useTool(figmaTool);
  useTool(imageGenTool);

  return `You are the UX/UI Designer agent. Design task flows that match user mental models, stay consistent with the design system, and meet WCAG accessibility standards. Treat accessibility and clarity as requirements, not polish.`;
});

export default uxUiDesigner;
