---
description: Run Flue agent work inside Cloudflare container-backed sandboxes.
title: Cloudflare Sandbox | Flue
image: https://flueframework.com/docs/og4.jpg
---

# Cloudflare Sandbox

Last updated Jul 21, 2026[View as Markdown](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare/index.md)

Cloudflare Sandbox uses `@cloudflare/sandbox` to provide a container-backed Linux environment to a Flue application deployed on Cloudflare. This integration is platform-native: it is not an adapter module for a Node-target application.

## Quickstart

Add container-backed Linux sandbox capability to an existing Flue project with the [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox) blueprint. Run the following command in your terminal or coding agent of choice:

```bash
flue add sandbox cloudflare
```

## Overview

Cloudflare Sandbox is a Cloudflare target integration rather than a generated adapter. In a Cloudflare-targeted project, the blueprint installs `@cloudflare/sandbox`; the agent function obtains the bound Durable Object with `getSandbox(...)`, wraps it with Flue’s `cloudflareSandbox(...)`, and attaches it with `useSandbox(...)`.

```ts
"use agent";
import { env } from "cloudflare:workers";
import { type AgentProps, useModel, useSandbox } from "@flue/runtime";
import { cloudflareSandbox } from "@flue/runtime/cloudflare";
import { getSandbox } from "@cloudflare/sandbox";

interface Env {
  Sandbox: DurableObjectNamespace;
}

export function CodingAgent({ id }: AgentProps) {
  useModel("anthropic/claude-opus-4-7");
  const { Sandbox } = env as unknown as Env;
  useSandbox(cloudflareSandbox(getSandbox(Sandbox, id)));
}
```

The blueprint also exports `Sandbox` from the source-root `cloudflare.ts`, adds its Durable Object binding, a new migration entry, and its container declaration to `wrangler.jsonc`, and creates a project-root `Dockerfile` whose image tag matches the installed package version. Agent shell and file operations run in the container-backed sandbox keyed by the agent instance id. Cloudflare’s direct delete API does not expose recursive or force controls, so `cloudflareSandbox()` implements either option by running `rm` in the container, matching Node’s `fs.rm` semantics. A Node-targeted project must migrate to the Cloudflare target before using this integration.

## Configure

| Requirement                                  | Purpose                                                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare target                            | **Required** — Runs the platform-native sandbox integration.                                                                 |
| @cloudflare/sandbox package                  | **Required** — Provides the Sandbox Durable Object and RPC client.                                                           |
| Container image                              | **Required** — Defines the Linux filesystem and command environment.                                                         |
| Durable Object/container binding             | **Required on Cloudflare** — Exposes the sandbox through Wrangler platform configuration; it is not an environment variable. |
| Stable sandbox identity and retention policy | **Required** — Controls lifecycle and reuse for the application.                                                             |
| Environment-variable credentials             | **Not required** — The platform integration uses Cloudflare bindings and deployment configuration instead.                   |

Cloudflare Sandbox requires a Worker deployment, Durable Object/container configuration, and a container image. Add the dependency to a Cloudflare-targeted project and export its Durable Object class from your Cloudflare deployment module:

```ts
// <source-root>/cloudflare.ts
export { Sandbox } from "@cloudflare/sandbox";
```

Declare the sandbox binding in Wrangler configuration, then wrap the RPC stub returned by `getSandbox(...)` with `cloudflareSandbox(...)` and pass it to an agent:

```ts
import { env } from "cloudflare:workers";
import { getSandbox } from "@cloudflare/sandbox";
import { type AgentProps, useModel, useSandbox } from "@flue/runtime";
import { cloudflareSandbox } from "@flue/runtime/cloudflare";

interface Env {
  Sandbox: DurableObjectNamespace;
}

export function Assistant({ id }: AgentProps) {
  useModel("anthropic/claude-sonnet-4-6");
  const { Sandbox } = env as unknown as Env;
  useSandbox(cloudflareSandbox(getSandbox(Sandbox, id)), { cwd: "/workspace" });
}
```

## Choose this integration when

Use Cloudflare Sandbox when an agent on Cloudflare needs git, package installation, native binaries, or other Linux tooling. Prefer Cloudflare Shell instead when a durable workspace with Workspace-oriented operations is sufficient and a Linux toolchain is unnecessary.

Treat network egress, mounted data, credentials, and side effects as application security decisions. See [Sandboxes](https://flueframework.com/docs/guide/sandboxes/#remote-sandboxes) and [Deploy on Cloudflare](https://flueframework.com/docs/ecosystem/deploy/cloudflare/).

## Docs Navigation

Current page: [Cloudflare Sandbox](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare/)

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
