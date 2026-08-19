---
description: Send Flue errors, logs, and AI traces to Sentry on Node.js and Cloudflare.
title: Sentry | Flue
image: https://flueframework.com/docs/og4.jpg
---

# Sentry

Last updated Jul 21, 2026[View as Markdown](https://flueframework.com/docs/ecosystem/tooling/sentry/index.md)

## Quickstart

Add Sentry observability to an existing Flue project with the [Sentry](https://sentry.io) blueprint. Run the following command in your terminal or coding agent of choice:

```sh
flue add tooling sentry
```

## Overview

The Sentry blueprint creates a source-root `sentry.ts` and imports it once from `app.ts`. It delivers three signals that share one trace per conversation: terminal failures as issues, every `log.*` call as Sentry Logs, and — when `SENTRY_TRACES_SAMPLE_RATE > 0` — Flue’s `invoke_agent` → `chat` / `execute_tool` span hierarchy with token usage, following the OpenTelemetry GenAI semantic conventions. On Node.js, the core of the generated integration looks like this:

```ts
import { createOpenTelemetryInstrumentation } from '@flue/opentelemetry';
import { instrument } from '@flue/runtime';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate, // clamped from SENTRY_TRACES_SAMPLE_RATE, default 0
  traceLifecycle: 'stream', // deliver gen_ai children that outlive their parent
  streamGenAiSpans: true,
  enableLogs: true,
  integrations: (defaults) => defaults.filter((i) => !SENTRY_AI_PROVIDER_INTEGRATIONS.has(i.name)),
});

// Sentry owns the global OTel tracer provider, so Flue's spans land in
// Sentry directly; the content policy keeps model/tool content out of
// traces unless the record flags opt in.
if (tracesSampleRate > 0) {
  instrument(createOpenTelemetryInstrumentation({ content: contentPolicy() }));
}

instrument({
  key: Symbol.for('flue.sentry.bridge'), // dev reloads replace, never stack
  observe(event) {
    if (event.type === 'operation' && event.isError) {
      // Issues are built from the live `errorInfo`, which carries the
      // throw-site stack; the failed submission's settlement is skipped
      // so each failure raises exactly one issue.
      captureTerminalFailure(event.errorInfo ?? event.error, correlationTags(event));
      if (event.submissionId) capturedFailedSubmissions.add(event.submissionId);
      return;
    }
    if (event.type === 'submission_settled') {
      /* capture only un-captured failures */
    }
    if (event.type === 'log') {
      Sentry.logger[event.level](event.message, logAttributes(event));
    }
  },
  interceptor: (_operation, _ctx, next) => next(),
  async dispose() {
    await Sentry.flush(2000);
  },
});
```

On Cloudflare, the generated `sentry.ts` contains the same bridge and instrumentation without calling `Sentry.init()`. Instead, the blueprint adds a module-local `cloudflare` extension to every agent. The extension wraps the final generated Durable Object class with `instrumentDurableObjectWithSentry(...)`, which initializes the SDK — tracing and logs included — per isolate, while leaving the outer Worker uninstrumented.

## Configure

| Variable                     | Purpose                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| SENTRY\_DSN                  | **Required for event delivery** — Identifies the Sentry project and permits event submission.      |
| SENTRY\_ENVIRONMENT          | **Optional** — Identifies the deployment environment in Sentry.                                    |
| SENTRY\_RELEASE              | **Optional** — Associates events with a deployed release.                                          |
| SENTRY\_TRACES\_SAMPLE\_RATE | **Optional** — 0 to 1. 0 (default) sends errors and logs only; above 0 also sends AI traces.       |
| SENTRY\_AI\_RECORD\_INPUTS   | **Optional** — true includes prompts, instructions, and tool definitions/arguments in trace spans. |
| SENTRY\_AI\_RECORD\_OUTPUTS  | **Optional** — true includes model output, tool results, and exception messages/stacks in spans.   |

Only `SENTRY_DSN` is needed to deliver events. A Sentry DSN permits event submission but does not grant read access to project data. Keeping it in deployment configuration rather than application source makes rotation and abuse mitigation easier; use a secret or environment binding according to your project’s policy.

The blueprint installs `@sentry/node` or `@sentry/cloudflare` plus `@flue/opentelemetry`, initializes the SDK at the appropriate runtime boundary, and registers the event bridge and span instrumentation through `instrument(...)`. Model and tool content stays out of traces unless the record flags opt in.

See [Observability](https://flueframework.com/docs/guide/observability/#choose-an-observability-provider) to compare Sentry with OpenTelemetry and Braintrust.

The integration uses different SDKs by target:

* **Node.js** — `@sentry/node`, initialized with a module-scoped `Sentry.init(...)` in application source.
* **Cloudflare** — `@sentry/cloudflare`, initialized with `instrumentDurableObjectWithSentry(...)` around each generated agent Durable Object.

Do not use `@sentry/node` on Cloudflare.

## Choose what to report

The generated integration reports:

* **Issues** — `operation` events with `isError: true` (a failed prompt, skill, task, shell, or compact operation) and `submission_settled` events with `outcome: 'failed'` that weren’t already captured from their operation, so one failure raises one issue;
* **Logs** — every `log.info`, `log.warn`, and `log.error` call at its own level in Sentry Logs, with scrubbed attributes and trace correlation. Error logs are logs, not issues: an agent that reports a recoverable error and continues never raises an issue;
* **Traces** — the span hierarchy Flue’s OpenTelemetry instrumentation emits, sampled by `SENTRY_TRACES_SAMPLE_RATE`. Sentry’s own AI provider integrations are suppressed so model calls aren’t double-counted.

Captures include `flue.*` correlation tags — agent instance, agent name, conversation, session, operation, and submission — matching the attributes on the trace spans. See [Observability](https://flueframework.com/docs/guide/observability/) for Flue’s identity and observer model.

With the record flags off, spans carry timing, token usage, model identifiers, and correlation ids but no message or tool content. Enabling a record flag routes that direction’s content through a scrubbing transform with a 16 KiB per-attribute budget. Make an explicit data-handling decision before widening that policy.

## Target behavior

On Node.js, module-scoped initialization is sufficient for the bridge’s captures and Flue’s spans. Complete Sentry HTTP or database auto-instrumentation requires Sentry’s preload setup before application imports and should be verified against the built Flue server. Shutdown flushing is best-effort: SIGINT/SIGTERM listeners call `Sentry.flush(...)` without owning process exit, so traces and issues sent during the run are safe while very-recently-buffered logs can be cut short.

On Cloudflare, Flue applies a module-local `wrap` extension to the final generated Durable Object class for every instrumented agent. This preserves Flue’s routing and durability behavior while allowing Sentry to initialize from the current binding environment, once per isolate. The wrapper does not cover the outer Worker or an authored Hono application; add HTTP middleware separately when request instrumentation is required.

## Verify

With `SENTRY_TRACES_SAMPLE_RATE=1` against a non-production Sentry project, prompt a tool-using agent and confirm one trace with `invoke_agent`, `chat`, and `execute_tool` spans plus its logs in Sentry Logs. Trigger one terminal failure and confirm exactly one issue with the original error and throw-site stack. Confirm the expected `flue.*` correlation fields, that no model content appears while the record flags are off, on Cloudflare that a wrapped agent delivers from workerd, and that the application still starts without a configured DSN.

## Docs Navigation

Current page: [Sentry](https://flueframework.com/docs/ecosystem/tooling/sentry/)

### Sections

* [Guide](https://flueframework.com/docs/guide/getting-started/)
* [Reference](https://flueframework.com/docs/reference/agent-api/)
* [CLI](https://flueframework.com/docs/cli/overview/)
* [Agent SDK](https://flueframework.com/docs/sdk/overview/)
* [Ecosystem](https://flueframework.com/docs/ecosystem/)

* [Overview](https://flueframework.com/docs/ecosystem/)

### Channels

* [Discord](https://flueframework.com/docs/ecosystem/channels/discord/)
* [Facebook](https://flueframework.com/docs/ecosystem/channels/messenger/)
* [GitHub](https://flueframework.com/docs/ecosystem/channels/github/)
* [Google Chat](https://flueframework.com/docs/ecosystem/channels/google-chat/)
* [Intercom](https://flueframework.com/docs/ecosystem/channels/intercom/)
* [Linear](https://flueframework.com/docs/ecosystem/channels/linear/)
* [Microsoft Teams](https://flueframework.com/docs/ecosystem/channels/teams/)
* [Notion](https://flueframework.com/docs/ecosystem/channels/notion/)
* [Resend](https://flueframework.com/docs/ecosystem/channels/resend/)
* [Salesforce](https://flueframework.com/docs/ecosystem/channels/salesforce-marketing-cloud/)
* [Shopify](https://flueframework.com/docs/ecosystem/channels/shopify/)
* [Slack](https://flueframework.com/docs/ecosystem/channels/slack/)
* [Stripe](https://flueframework.com/docs/ecosystem/channels/stripe/)
* [Telegram](https://flueframework.com/docs/ecosystem/channels/telegram/)
* [Twilio](https://flueframework.com/docs/ecosystem/channels/twilio/)
* [WhatsApp](https://flueframework.com/docs/ecosystem/channels/whatsapp/)
* [Zendesk](https://flueframework.com/docs/ecosystem/channels/zendesk/)

### Sandboxes

* [boxd](https://flueframework.com/docs/ecosystem/sandboxes/boxd/)
* [Cloudflare Computer](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare-computer/)
* [Cloudflare Sandbox](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare/)
* [Daytona](https://flueframework.com/docs/ecosystem/sandboxes/daytona/)
* [E2B](https://flueframework.com/docs/ecosystem/sandboxes/e2b/)
* [exe.dev](https://flueframework.com/docs/ecosystem/sandboxes/exedev/)
* [islo](https://flueframework.com/docs/ecosystem/sandboxes/islo/)
* [Mirage](https://flueframework.com/docs/ecosystem/sandboxes/mirage/)
* [Modal](https://flueframework.com/docs/ecosystem/sandboxes/modal/)
* [Vercel Sandbox](https://flueframework.com/docs/ecosystem/sandboxes/vercel/)

### Deploy

* [AWS](https://flueframework.com/docs/ecosystem/deploy/aws/)
* [Cloudflare](https://flueframework.com/docs/ecosystem/deploy/cloudflare/)
* [Docker](https://flueframework.com/docs/ecosystem/deploy/docker/)
* [Fly.io](https://flueframework.com/docs/ecosystem/deploy/fly/)
* [GitHub Actions](https://flueframework.com/docs/ecosystem/deploy/github-actions/)
* [GitLab CI/CD](https://flueframework.com/docs/ecosystem/deploy/gitlab-ci/)
* [Node.js](https://flueframework.com/docs/ecosystem/deploy/node/)
* [Railway](https://flueframework.com/docs/ecosystem/deploy/railway/)
* [Render](https://flueframework.com/docs/ecosystem/deploy/render/)
* [SST](https://flueframework.com/docs/ecosystem/deploy/sst/)

### Databases

* [libSQL](https://flueframework.com/docs/ecosystem/databases/libsql/)
* [MongoDB](https://flueframework.com/docs/ecosystem/databases/mongodb/)
* [MySQL](https://flueframework.com/docs/ecosystem/databases/mysql/)
* [Postgres](https://flueframework.com/docs/ecosystem/databases/postgres/)
* [Redis](https://flueframework.com/docs/ecosystem/databases/redis/)
* [Supabase](https://flueframework.com/docs/ecosystem/databases/supabase/)
* [Turso](https://flueframework.com/docs/ecosystem/databases/turso/)
* [Valkey](https://flueframework.com/docs/ecosystem/databases/valkey/)

### Tooling

* [Braintrust](https://flueframework.com/docs/ecosystem/tooling/braintrust/)
* [Jetty](https://flueframework.com/docs/ecosystem/tooling/jetty/)
* [OpenTelemetry](https://flueframework.com/docs/ecosystem/tooling/opentelemetry/)
* [Sentry](https://flueframework.com/docs/ecosystem/tooling/sentry/)
* [Vitest Evals](https://flueframework.com/docs/ecosystem/tooling/vitest-evals/)
