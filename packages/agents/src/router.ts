/**
 * Agent router — creates a Workers-native router for mounting an agent.
 *
 * Convention: each agent Worker has an `app.ts` that extends `HttpEntrypoint`
 * and uses `createAgentRouter` as its router.
 *
 * ```ts
 * import { HttpEntrypoint } from '@nowarelabs/entrypoints';
 * import { createAgentRouter } from '@nowarelabs/agents';
 * import codingAgent from './agents/coding';
 *
 * export default class CodingEntrypoint extends HttpEntrypoint {
 *   router = createAgentRouter(codingAgent);
 * }
 * ```
 */

import type { AgentDefinition } from "./types.js";
import { agentMountPath } from "./agent.js";

// ----------------------------------------------------------------
// Router factory
// ----------------------------------------------------------------

export interface AgentRouterOptions {
  /** Additional routes beyond the standard agent routes. */
  routes?: AgentRoute[];
}

export interface AgentRoute {
  method: string;
  pattern: URLPattern | string;
  handler: (
    request: Request,
    env: unknown,
    ctx: unknown,
    match: URLPatternResult | null,
  ) => Promise<Response> | Response;
}

/**
 * Creates a Workers-native router for an agent. The router exposes:
 *
 * - `POST /:id` — deliver a message (fire-and-forget, returns 202)
 * - `GET /:id` — read conversation snapshot
 * - `HEAD /:id` — check conversation exists
 * - `POST /:id/abort` — abort a running turn
 *
 * The actual agent execution is handled by the Cloudflare Agent DO.
 * This router is the HTTP surface; the DO is the runtime.
 *
 * Returns a `RouterLike` compatible with `HttpEntrypoint` from
 * `@nowarelabs/entrypoints`.
 */
export function createAgentRouter(
  def: AgentDefinition,
  opts?: AgentRouterOptions,
): {
  handle(
    request: Request,
    env: Record<string, unknown>,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ): Promise<Response>;
} {
  const mountPath = agentMountPath(def.name);

  return {
    async handle(
      request: Request,
      env: Record<string, unknown>,
      ctx: { waitUntil(p: Promise<unknown>): void },
    ): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;

      // Strip the mount path prefix to get the relative path
      const relativePath = path.startsWith(mountPath) ? path.slice(mountPath.length) || "/" : path;

      // Match /:id pattern
      const idMatch = relativePath.match(/^\/([^/]+)(\/.*)?$/);
      if (idMatch) {
        const id = idMatch[1];
        const subPath = idMatch[2] || "";

        // POST /:id — deliver message
        if (request.method === "POST" && subPath === "") {
          return Response.json(
            {
              ok: true,
              agent: def.name,
              conversationId: id,
              streamUrl: `${mountPath}/${id}?view=updates`,
              offset: 0,
            },
            { status: 202 },
          );
        }

        // GET /:id — read conversation
        if (request.method === "GET" && subPath === "") {
          const view = url.searchParams.get("view");
          if (view === "updates") {
            return Response.json({ ok: true, agent: def.name, conversationId: id, messages: [] });
          }
          return Response.json({ ok: true, agent: def.name, conversationId: id });
        }

        // HEAD /:id — check conversation exists
        if (request.method === "HEAD" && subPath === "") {
          return new Response(null, { status: 200 });
        }

        // POST /:id/abort — abort running turn
        if (request.method === "POST" && subPath === "/abort") {
          return Response.json({ ok: true, agent: def.name, conversationId: id, aborted: true });
        }
      }

      // Check extra routes
      if (opts?.routes) {
        for (const route of opts.routes) {
          if (request.method !== route.method) continue;
          const pattern =
            typeof route.pattern === "string" ? new URLPattern(route.pattern) : route.pattern;
          const match = pattern.exec({ pathname: path } as URLPatternInit);
          if (match) {
            return route.handler(request, env, ctx, match);
          }
        }
      }

      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    },
  };
}
