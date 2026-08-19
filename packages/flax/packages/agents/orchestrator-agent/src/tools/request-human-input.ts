import { defineTool } from '@flue/runtime';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

import { ensureSchema, insertHitl, patchInstance } from '../dashboard-db';

/** Deterministic, content-addressed HITL id (matches dashboard-api's scan). */
async function hitlIdFor(conversationId: string, type: string, title: string): Promise<string> {
  const input = `${conversationId}|${type}|${title}`;
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
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
  type: v.optional(v.picklist(['text', 'textarea', 'select', 'toggle'])),
  required: v.optional(v.boolean()),
  options: v.optional(v.array(option)),
  placeholder: v.optional(v.string()),
});

export const requestHumanInputTool = defineTool({
  name: 'request_human_input',
  description:
    'Pause the pipeline for a human decision. Returns a hitlId the human resolution references. The human response arrives as a user message prefixed "[HITL resolved]" and is delivered with hitlId, type, and payload so you can continue. Do NOT guess or continue past a decision the human must make - call this and stop.',
  input: v.object({
    conversationId: v.string(),
    type: v.picklist(['approve-reject', 'choose-option', 'pr-review', 'structured-form', 'alert']),
    title: v.string(),
    summary: v.optional(v.string()),
    payload: v.optional(
      v.object({
        options: v.optional(v.array(option)),
        fields: v.optional(v.array(field)),
        prRef: v.optional(v.string()),
        severity: v.optional(v.picklist(['info', 'warning', 'critical'])),
      }),
    ),
  }),
  output: v.object({
    hitlId: v.string(),
    status: v.picklist(['blocked_on_human']),
  }),
  async run({ data, log }) {
    const id = await hitlIdFor(data.conversationId, data.type, data.title);

    const db = (env as unknown as { FLAX_DB?: D1Database }).FLAX_DB;
    if (db) {
      try {
        await ensureSchema(db);
        await insertHitl(db, {
          id,
          conversation_id: data.conversationId,
          type: data.type,
          title: data.title,
          summary: data.summary,
          payload: data.payload,
        });
        await patchInstance(db, data.conversationId, {
          currentAgent: 'orchestrator',
          status: 'blocked_on_human',
          lastActivityAt: Date.now(),
        });
      } catch {
        // HITL persistence is best-effort
      }
    }

    log.info('hitl.requested', { hitlId: id, type: data.type, conversationId: data.conversationId });
    return { output: { hitlId: id, status: 'blocked_on_human' as const } };
  },
});
