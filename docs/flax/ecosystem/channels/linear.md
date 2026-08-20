---
description: Receive verified Linear resource and agent-session webhooks with a project-owned SDK client.
title: Linear | Flue
image: https://flueframework.com/docs/og4.jpg
---

# Linear

Last updated Jul 21, 2026[View as Markdown](https://flueframework.com/docs/ecosystem/channels/linear/index.md)[@flue/linear](https://www.npmjs.com/package/@flue/linear)

## Quickstart

Add verified Linear resource and agent-session webhooks with project-owned outbound Linear API access to an existing Flue project with the [Linear](https://linear.app/developers) blueprint. Run the following command in your terminal or coding agent of choice:

```sh
flue add channel linear
```

## Overview

The blueprint installs `@flue/linear` and the official `@linear/sdk`, creates a source-root `channels/linear.ts` module with named `channel` and project-owned `client` exports, and modifies the selected agent to bind the generated message tool.

```ts
import { createLinearChannel } from "@flue/linear";
import { dispatch } from "@flue/runtime";
import { LinearClient } from "@linear/sdk";
import { Assistant } from "../agents/assistant.ts";

export const client = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!,
});

export const channel = createLinearChannel({
  webhookSecret: process.env.LINEAR_WEBHOOK_SECRET!,
  async webhook({ payload, deliveryId }) {
    if (payload.type !== "Comment" || !("body" in payload.data)) return;
    const comment = payload.data;
    if (payload.action !== "create" || !comment.issueId) return;
    await dispatch(Assistant, {
      id: channel.instanceId({
        type: "issue",
        organizationId: payload.organizationId,
        issueId: comment.issueId,
        ...(comment.parentId ? { threadCommentId: comment.parentId } : {}),
      }),
      message: {
        kind: "signal",
        type: "linear.comment.created",
        body: comment.body,
        attributes: {
          deliveryId,
          ...(payload.actor ? { actorId: payload.actor.id } : {}),
          ...(payload.actor && "name" in payload.actor ? { actorName: payload.actor.name } : {}),
        },
      },
    });
  },
});
```

The abridged example shows the generated comment path and omits the agent-session branch, reusable type guards, and message tool. Once configured, a new issue comment continues the agent instance for that issue or comment thread, while the bound SDK tool posts replies to the same Linear conversation. The official SDK also supports the generated agent-session path and runs with Flue’s `nodejs_compat` setting on Cloudflare Workers.

## Mount the channel

A channel serves HTTP routes only where `app.ts` mounts it. Mount the module’s named `channel` export:

```ts
import { channel as linear } from "./channels/linear.ts";

app.route("/channels/linear", linear.route());
```

`channel.route()` is a pure router factory serving the channel’s declared routes relative to the mount path. The webhook paths in this guide assume the conventional `/channels/linear` mount; a different mount path shifts them accordingly. The dispatch-target agent module carries the `'use agent'` directive — the directive registers it, so a dispatch-only agent needs no HTTP mount of its own.

## Configure

| Variable               | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| LINEAR_WEBHOOK_SECRET  | **Required** — Verifies inbound webhook deliveries.                     |
| LINEAR_API_KEY         | **Required** — Authenticates the example’s outbound SDK client.         |
| LINEAR_ORGANIZATION_ID | **Optional** — Restricts inbound deliveries to one Linear organization. |
| LINEAR_WEBHOOK_ID      | **Optional** — Restricts inbound deliveries to one configured webhook.  |

It installs `@flue/linear` for verified ingress and the official `@linear/sdk` for project-owned outbound API access. Linear uses that SDK in its own Cloudflare Workers agent example with `nodejs_compat`, which Flue’s Cloudflare target already enables.

Set the webhook URL to:

```txt
https://example.com/channels/linear/webhook
```

## Channel module

```ts
import { createLinearChannel, type LinearWebhookPayload } from "@flue/linear";
import { defineTool, dispatch } from "@flue/runtime";
import { LinearClient } from "@linear/sdk";
import * as v from "valibot";
import type {
  AgentSessionEventWebhookPayload,
  EntityWebhookPayloadWithCommentData,
} from "@linear/sdk/webhooks";
import { Assistant } from "../agents/assistant.ts";

const organizationId = process.env.LINEAR_ORGANIZATION_ID;

export const client = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!,
});

export const channel = createLinearChannel({
  webhookSecret: process.env.LINEAR_WEBHOOK_SECRET!,
  ...(organizationId ? { organizationId } : {}),

  // Path: /channels/linear/webhook
  async webhook({ payload, deliveryId }) {
    if (isCommentEvent(payload)) {
      const comment = payload.data;
      if (payload.action !== "create" || !comment.issueId) return;
      await dispatch(Assistant, {
        id: channel.instanceId({
          type: "issue",
          organizationId: payload.organizationId,
          issueId: comment.issueId,
          ...(comment.parentId ? { threadCommentId: comment.parentId } : {}),
        }),
        // Recorded once when this event creates the instance; ignored after.
        initialData: {
          type: "issue",
          issueId: comment.issueId,
          ...(comment.parentId ? { threadCommentId: comment.parentId } : {}),
          ...(comment.issue?.title ? { issueTitle: comment.issue.title } : {}),
        },
        message: {
          kind: "signal",
          type: "linear.comment.created",
          body: comment.body,
          attributes: {
            deliveryId,
            ...(payload.actor ? { actorId: payload.actor.id } : {}),
            ...(payload.actor && "name" in payload.actor ? { actorName: payload.actor.name } : {}),
          },
        },
      });
      return;
    }

    if (isAgentSessionEvent(payload)) {
      await dispatch(Assistant, {
        id: channel.instanceId({
          type: "agent-session",
          organizationId: payload.organizationId,
          agentSessionId: payload.agentSession.id,
        }),
        // Recorded once when this event creates the instance; ignored after.
        initialData: {
          type: "agent-session",
          agentSessionId: payload.agentSession.id,
          ...(payload.agentSession.issue?.title
            ? { issueTitle: payload.agentSession.issue.title }
            : {}),
        },
        message: {
          kind: "signal",
          type: `linear.agent_session.${payload.action}`,
          body: JSON.stringify({
            promptContext: payload.promptContext,
            activity: payload.agentActivity,
            session: payload.agentSession,
          }),
          attributes: { deliveryId },
        },
      });
    }
  },
});

// Linear's native union has a catch-all member that keeps `type` widened, so a
// literal `type` check alone does not narrow. Combine it with a nested field.
function isCommentEvent(
  payload: LinearWebhookPayload,
): payload is EntityWebhookPayloadWithCommentData {
  return payload.type === "Comment" && "body" in payload.data;
}

function isAgentSessionEvent(
  payload: LinearWebhookPayload,
): payload is AgentSessionEventWebhookPayload {
  return payload.type === "AgentSessionEvent" && "agentSession" in payload;
}

/** The subset of `LinearConversationRef` actually needed to post a message. */
export type LinearMessageRef =
  | { type: "agent-session"; agentSessionId: string }
  | { type: "issue"; issueId: string; threadCommentId?: string };

export function postMessage(ref: LinearMessageRef) {
  return defineTool({
    name: "post_linear_message",
    description: "Post a message to the Linear conversation bound to this agent.",
    input: v.object({ text: v.pipe(v.string(), v.minLength(1)) }),
    async run({ data }) {
      const { text } = data;
      if (ref.type === "agent-session") {
        const result = await client.createAgentActivity({
          agentSessionId: ref.agentSessionId,
          content: { type: "response", body: text },
        });
        return { output: { success: result.success } };
      }

      const result = await client.createComment({
        issueId: ref.issueId,
        ...(ref.threadCommentId ? { parentId: ref.threadCommentId } : {}),
        body: text,
      });
      return {
        output: {
          success: result.success,
          ...(result.commentId === undefined ? {} : { commentId: result.commentId }),
        },
      };
    },
  });
}
```

Use `accessToken` instead of `apiKey` for an installed OAuth application. OAuth installation storage and organization-specific token selection remain application concerns.

`initialData` is the instance’s creation data: recorded once when the event creates the instance and ignored afterward, so the channel passes it on every dispatch. It carries the issue or agent-session fields the tool needs — the agent reads them with `useInitialData()` instead of parsing the instance id — plus the issue title when the webhook includes one. Per-message facts stay on the signal’s `attributes`.

## Wire the agent

```ts
"use agent";
import { useInitialData, useModel, useTool } from "@flue/runtime";
import * as v from "valibot";
import { postMessage } from "../channels/linear.ts";

const initialData = v.variant("type", [
  v.object({
    type: v.literal("agent-session"),
    agentSessionId: v.string(),
    issueTitle: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("issue"),
    issueId: v.string(),
    threadCommentId: v.optional(v.string()),
    issueTitle: v.optional(v.string()),
  }),
]);

export function Assistant() {
  useModel("anthropic/claude-haiku-4-5");
  const data = useInitialData<v.InferOutput<typeof initialData>>();
  if (!data) throw new Error("This agent is created by the Linear channel dispatch.");
  useTool(postMessage(data));
  const issueTitle = data.issueTitle ? ` on "${data.issueTitle}"` : "";
  return `Reply concisely in the bound Linear conversation${issueTitle}.`;
}

Assistant.initialData = initialData;
```

The agent’s `initialData` static validates the dispatched `initialData` when the instance is created; `useInitialData()` returns the parsed value on every render.

## Resource webhooks

Create a Linear webhook for the resource families the application handles, typically Comments, Issues, and Projects. The package verifies the exact body against `Linear-Signature`, rejects signed timestamps outside one minute, and optionally checks configured organization and webhook ids.

The handler receives the provider-native `payload`, typed by Linear’s official `LinearWebhookPayload` union (re-exported from `@linear/sdk/webhooks`). Entity deliveries are discriminated on `type` (`'Comment'`, `'Issue'`, `'Project'`, …) and carry `action` and `data`; Flue forwards the body unmodified, including verified deliveries the union does not model. The union has a catch-all member that keeps `type` widened to `string`, so a literal `type` check alone does not narrow it — pair the literal with a discriminating nested field in a small application-side type guard (as in the channel module above).

The application derives instance ids from native fields. Top-level comments use the issue conversation; replies pass the root comment id as `threadCommentId` for the nested thread.

## Agent sessions

Enable Agent session events on a Linear OAuth application configured as an app actor. Install it with the scopes required by your operations and `app:mentionable` when users should mention the agent.

`created` events carry the `agentSession` and may include Linear’s formatted `promptContext`, `previousComments`, and `guidance`. `prompted` events carry the new `agentActivity`. The application builds a stable agent-session instance id from `payload.agentSession.id`.

Linear expects the webhook response within five seconds and a new session to receive an activity or external URL update within ten seconds. Keep the verified handler focused on durable dispatch admission, then use the project-owned SDK client to post progress and results.

## Delivery behavior

Returning nothing produces an empty `200`. Return JSON for a response body or use the Hono context for explicit status control. A failure or non-`200`response asks Linear to retry.

Linear treats a delivery as failed if it does not return `200` within five seconds, then retries after one minute, one hour, and six hours. The channel does not enforce a timer; admit durable work quickly (dispatch, then return) and rely on idempotency rather than blocking on slow work before responding.

The channel requires Linear’s UUID-v4 `Linear-Delivery` header and exposes it for application-owned deduplication, but does not persist delivery state. Instance ids validate syntax, not authorization.

See the [@flue/linear README](https://github.com/withastro/flue/tree/main/packages/linear#readme).

## Docs Navigation

Current page: [Linear](https://flueframework.com/docs/ecosystem/channels/linear/)

### Sections

- [Guide](https://flueframework.com/docs/guide/getting-started/)
- [Reference](https://flueframework.com/docs/reference/agent-api/)
- [CLI](https://flueframework.com/docs/cli/overview/)
- [Agent SDK](https://flueframework.com/docs/sdk/overview/)
- [Ecosystem](https://flueframework.com/docs/ecosystem/)

- [Overview](https://flueframework.com/docs/ecosystem/)

### Channels

- [Discord](https://flueframework.com/docs/ecosystem/channels/discord/)
- [Facebook](https://flueframework.com/docs/ecosystem/channels/messenger/)
- [GitHub](https://flueframework.com/docs/ecosystem/channels/github/)
- [Google Chat](https://flueframework.com/docs/ecosystem/channels/google-chat/)
- [Intercom](https://flueframework.com/docs/ecosystem/channels/intercom/)
- [Linear](https://flueframework.com/docs/ecosystem/channels/linear/)
- [Microsoft Teams](https://flueframework.com/docs/ecosystem/channels/teams/)
- [Notion](https://flueframework.com/docs/ecosystem/channels/notion/)
- [Resend](https://flueframework.com/docs/ecosystem/channels/resend/)
- [Salesforce](https://flueframework.com/docs/ecosystem/channels/salesforce-marketing-cloud/)
- [Shopify](https://flueframework.com/docs/ecosystem/channels/shopify/)
- [Slack](https://flueframework.com/docs/ecosystem/channels/slack/)
- [Stripe](https://flueframework.com/docs/ecosystem/channels/stripe/)
- [Telegram](https://flueframework.com/docs/ecosystem/channels/telegram/)
- [Twilio](https://flueframework.com/docs/ecosystem/channels/twilio/)
- [WhatsApp](https://flueframework.com/docs/ecosystem/channels/whatsapp/)
- [Zendesk](https://flueframework.com/docs/ecosystem/channels/zendesk/)

### Sandboxes

- [boxd](https://flueframework.com/docs/ecosystem/sandboxes/boxd/)
- [Cloudflare Computer](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare-computer/)
- [Cloudflare Sandbox](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare/)
- [Daytona](https://flueframework.com/docs/ecosystem/sandboxes/daytona/)
- [E2B](https://flueframework.com/docs/ecosystem/sandboxes/e2b/)
- [exe.dev](https://flueframework.com/docs/ecosystem/sandboxes/exedev/)
- [islo](https://flueframework.com/docs/ecosystem/sandboxes/islo/)
- [Mirage](https://flueframework.com/docs/ecosystem/sandboxes/mirage/)
- [Modal](https://flueframework.com/docs/ecosystem/sandboxes/modal/)
- [Vercel Sandbox](https://flueframework.com/docs/ecosystem/sandboxes/vercel/)

### Deploy

- [AWS](https://flueframework.com/docs/ecosystem/deploy/aws/)
- [Cloudflare](https://flueframework.com/docs/ecosystem/deploy/cloudflare/)
- [Docker](https://flueframework.com/docs/ecosystem/deploy/docker/)
- [Fly.io](https://flueframework.com/docs/ecosystem/deploy/fly/)
- [GitHub Actions](https://flueframework.com/docs/ecosystem/deploy/github-actions/)
- [GitLab CI/CD](https://flueframework.com/docs/ecosystem/deploy/gitlab-ci/)
- [Node.js](https://flueframework.com/docs/ecosystem/deploy/node/)
- [Railway](https://flueframework.com/docs/ecosystem/deploy/railway/)
- [Render](https://flueframework.com/docs/ecosystem/deploy/render/)
- [SST](https://flueframework.com/docs/ecosystem/deploy/sst/)

### Databases

- [libSQL](https://flueframework.com/docs/ecosystem/databases/libsql/)
- [MongoDB](https://flueframework.com/docs/ecosystem/databases/mongodb/)
- [MySQL](https://flueframework.com/docs/ecosystem/databases/mysql/)
- [Postgres](https://flueframework.com/docs/ecosystem/databases/postgres/)
- [Redis](https://flueframework.com/docs/ecosystem/databases/redis/)
- [Supabase](https://flueframework.com/docs/ecosystem/databases/supabase/)
- [Turso](https://flueframework.com/docs/ecosystem/databases/turso/)
- [Valkey](https://flueframework.com/docs/ecosystem/databases/valkey/)

### Tooling

- [Braintrust](https://flueframework.com/docs/ecosystem/tooling/braintrust/)
- [Jetty](https://flueframework.com/docs/ecosystem/tooling/jetty/)
- [OpenTelemetry](https://flueframework.com/docs/ecosystem/tooling/opentelemetry/)
- [Sentry](https://flueframework.com/docs/ecosystem/tooling/sentry/)
- [Vitest Evals](https://flueframework.com/docs/ecosystem/tooling/vitest-evals/)
