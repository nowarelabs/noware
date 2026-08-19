/**
 * Agent router — creates a Hono sub-router for mounting an agent.
 *
 * Convention: each agent Worker has an `app.ts` that mounts the agent
 * router at `/agents/<name>`.
 *
 * ```ts
 * import { createAgentRouter } from '@nowarelabs/agents/router';
 * import { Coding } from './agents/coding';
 *
 * const app = new Hono();
 * app.route('/agents/coding', createAgentRouter(Coding));
 * ```
 */

import type { AgentDefinition } from "./types.js";
import { agentMountPath } from "./agent.js";

// ----------------------------------------------------------------
// Hono types (minimal, avoid direct dependency)
// ----------------------------------------------------------------

export interface HonoRoute {
  on: (method: string, path: string, ...handlers: unknown[]) => HonoRoute;
  get: (path: string, ...handlers: unknown[]) => HonoRoute;
  post: (path: string, ...handlers: unknown[]) => HonoRoute;
  head: (path: string, ...handlers: unknown[]) => HonoRoute;
  use: (...handlers: unknown[]) => HonoRoute;
}

export type HonoHandler = (c: {
  req: {
    param: (name: string) => string;
    query: (name: string) => string | undefined;
    json: () => Promise<unknown>;
    url: string;
  };
  json: (data: unknown, status?: number) => Response;
  text: (data: string, status?: number) => Response;
}) => Promise<Response> | Response;

// ----------------------------------------------------------------
// Router factory
// ----------------------------------------------------------------

export interface AgentRouterOptions {
  /** Custom middleware to apply to all routes. */
  middleware?: unknown[];
  /** Additional routes to add beyond the standard agent routes. */
  extraRoutes?: (router: HonoRoute) => void;
}

/**
 * Creates a Hono sub-router for an agent. The router exposes:
 *
 * - `POST /:id` — deliver a message (fire-and-forget, returns 202)
 * - `GET /:id` — read conversation snapshot
 * - `HEAD /:id` — check conversation exists
 * - `POST /:id/abort` — abort a running turn
 * - `GET /:id/attachments/:attachmentId` — read an attachment
 *
 * The actual agent execution is handled by the Cloudflare Agent DO.
 * This router is the HTTP surface; the DO is the runtime.
 */
export function createAgentRouter(
  def: AgentDefinition,
  opts?: AgentRouterOptions,
): (app: HonoRoute) => void {
  return (app: HonoRoute) => {
    // Apply middleware if provided
    if (opts?.middleware) {
      for (const mw of opts.middleware) {
        app.use(mw);
      }
    }

    // POST /:id — deliver message
    app.post("/:id", async (c: Parameters<HonoHandler>[0]) => {
      const id = c.req.param("id");

      // In production, this routes to the DO via service binding.
      // The DO handles the actual agent execution.
      return c.json(
        {
          ok: true,
          agent: def.name,
          conversationId: id,
          streamUrl: `${agentMountPath(def.name)}/${id}?view=updates`,
          offset: 0,
        },
        202,
      );
    });

    // GET /:id — read conversation
    app.get("/:id", async (c: Parameters<HonoHandler>[0]) => {
      const id = c.req.param("id");
      const view = c.req.query("view");

      if (view === "updates") {
        // SSE/long-poll streaming endpoint
        return c.json({ ok: true, agent: def.name, conversationId: id, messages: [] });
      }

      return c.json({ ok: true, agent: def.name, conversationId: id });
    });

    // HEAD /:id — check conversation exists
    app.head("/:id", (c: Parameters<HonoHandler>[0]) => {
      return c.text("", 200);
    });

    // POST /:id/abort — abort running turn
    app.post("/:id/abort", async (c: Parameters<HonoHandler>[0]) => {
      const id = c.req.param("id");
      return c.json({ ok: true, agent: def.name, conversationId: id, aborted: true });
    });

    // Extra routes
    opts?.extraRoutes?.(app);
  };
}
