import { defineTool } from "@nowarelabs/agents";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import type { IHitlPort, HitlInput, HitlOutput } from "@nowarelabs/agent-ports";
import type { UseCaseResult } from "@nowarelabs/shared";

import { FlaxHitlModel } from "../models/flax-hitl.model.js";
import { FlaxInstanceModel } from "../models/flax-instance.model.js";

/** Deterministic, content-addressed HITL id (matches dashboard-api's scan). */
async function hitlIdFor(conversationId: string, type: string, title: string): Promise<string> {
  const input = `${conversationId}|${type}|${title}`;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
  return `hitl-${hex}`;
}

const option = v.object({
  label: v.string(),
  value: v.string(),
  detail: v.optional(v.string()),
});

const field = v.object({
  name: v.string(),
  label: v.string(),
  type: v.optional(v.picklist(["text", "textarea", "select", "toggle"])),
  required: v.optional(v.boolean()),
  options: v.optional(v.array(option)),
  placeholder: v.optional(v.string()),
});

const inputSchema = v.object({
  conversationId: v.string(),
  type: v.picklist(["approve-reject", "choose-option", "pr-review", "structured-form", "alert"]),
  title: v.string(),
  summary: v.optional(v.string()),
  payload: v.optional(
    v.object({
      options: v.optional(v.array(option)),
      fields: v.optional(v.array(field)),
      prRef: v.optional(v.string()),
      severity: v.optional(v.picklist(["info", "warning", "critical"])),
    }),
  ),
});

const outputSchema = v.object({
  hitlId: v.string(),
  status: v.picklist(["blocked_on_human"]),
});

class LocalHitlGateway implements IHitlPort {
  async execute(input: HitlInput): Promise<UseCaseResult<HitlOutput>> {
    try {
      const db = (env as unknown as { FLAX_DB?: D1Database }).FLAX_DB;
      if (!db) return { success: true, data: {}, status: "delivered" };

      const hitlModel = new FlaxHitlModel({ db, table: "flax_hitl" });

      if (input.method === "create") {
        await hitlModel.insertHitl({
          id: input.hitlId ?? `hitl-${Date.now()}`,
          conversation_id: input.conversationId ?? "",
          type: "resolve",
          title: input.question ?? "",
        });
        return { success: true, data: { hitlId: input.hitlId }, status: "delivered" };
      }

      if (input.method === "resolve") {
        await hitlModel.resolveHitl(input.hitlId ?? "", input.answer ?? "");
        return { success: true, data: { resolved: true }, status: "delivered" };
      }

      if (input.method === "pendingCount") {
        const count = await hitlModel.pendingCount(input.conversationId ?? "");
        return { success: true, data: { count }, status: "delivered" };
      }

      return { success: true, data: {}, status: "delivered" };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

export const requestHumanInputTool = defineTool({
  name: "request_human_input",
  description:
    'Pause the pipeline for a human decision. Returns a hitlId the human resolution references. The human response arrives as a user message prefixed "[HITL resolved]" and is delivered with hitlId, type, and payload so you can continue. Do NOT guess or continue past a decision the human must make - call this and stop.',
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  async run({ data, log }) {
    const id = await hitlIdFor(data.conversationId, data.type, data.title);
    const port = new LocalHitlGateway();

    await port.execute({
      method: "create",
      conversationId: data.conversationId,
      hitlId: id,
      question: data.title,
    } as HitlInput);

    const db = (env as unknown as { FLAX_DB?: D1Database }).FLAX_DB;
    if (db) {
      try {
        const hitlModel = new FlaxHitlModel({ db, table: "flax_hitl" });
        await hitlModel.insertHitl({
          id,
          conversation_id: data.conversationId,
          type: data.type,
          title: data.title,
          summary: data.summary,
          payload: data.payload,
        });
        const instanceModel = new FlaxInstanceModel({ db, table: "flax_instances" });
        await instanceModel.patchFields(data.conversationId, {
          currentAgent: "orchestrator",
          status: "blocked_on_human",
          lastActivityAt: Date.now(),
        });
      } catch {
        // HITL persistence is best-effort
      }
    }

    log.info("hitl.requested", {
      hitlId: id,
      type: data.type,
      conversationId: data.conversationId,
    });
    return { hitlId: id, status: "blocked_on_human" as const };
  },
});
