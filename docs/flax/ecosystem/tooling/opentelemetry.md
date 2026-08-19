---
description: Export Flue agents, model calls, and tools with OpenTelemetry GenAI semantics.
title: OpenTelemetry | Flue
image: https://flueframework.com/docs/og4.jpg
---

# OpenTelemetry

Last updated Jul 21, 2026[View as Markdown](https://flueframework.com/docs/ecosystem/tooling/opentelemetry/index.md)[@flue/opentelemetry](https://www.npmjs.com/package/@flue/opentelemetry)

`@flue/opentelemetry` projects Flue’s live runtime observations into standard OpenTelemetry GenAI spans and metrics. It does not configure an SDK, exporter, sampling, credentials, or deployment-specific flushing.

The package implements the Development GenAI conventions pinned at commit `4c8addb53718b544134be47e256237026fe88875`. Its Flue-to-GenAI projection revision is `5` and its Flue extension revision is `4`; the vocabulary, projection, and revision constants live in `@flue/runtime/telemetry` and are shared verbatim with the [native Cloudflare tracing adapter](https://flueframework.com/docs/guide/cloudflare-target/#createcloudflaretracing), so a payload written for one backend reads identically on the other. Updating any revision requires an explicit compatibility review.

## Configure

Install the adapter and OpenTelemetry API alongside an SDK and exporter compatible with your deployment target:

```sh
pnpm add @flue/opentelemetry @opentelemetry/api
```

Configure the SDK first, then register one instrumentation instance:

```ts
import { createOpenTelemetryInstrumentation } from '@flue/opentelemetry';
import { instrument } from '@flue/runtime';

const instrumentation = createOpenTelemetryInstrumentation();
const disposeInstrumentation = instrument(instrumentation);
```

Pass configured tracer, meter, or structural Logger instances when the application owns them. Generated Node applications automatically dispose registrations created while evaluating `app.ts` after admissions and active work drain. Call `await disposeInstrumentation()` yourself only when registering outside that lifecycle, then flush or shut down the application-owned SDK/exporter separately.

## Trace model

* A prompt or skill operation becomes `invoke_agent <agent>`.
* A delegated task becomes one task-owned `invoke_agent <agent>`.
* Provider inference becomes a `chat <requested-model>` client span.
* A GenAI tool execution becomes `execute_tool <name>`.
* A caller shell execution becomes `flue.operation shell`.
* A context compaction becomes `flue.compaction` with child chat spans.

Provider chat spans cover provider inference only. The projection reads canonical model telemetry directly: semantic `request.providerName` becomes `gen_ai.provider.name`, while `request.providerId` remains the Flue registration identity. Local tools are sibling spans under the agent invocation and correlate with model output through `gen_ai.tool.call.id`.

`gen_ai.conversation.id` identifies one persisted Flue session. It is not a submission, dispatch, operation, trace, session name, or provider-affinity key. Flue correlation fields remain under documented `flue.*` attributes when no exact standard field exists.

## Protect content

**Content is enabled by default** — model messages, reasoning, system instructions, tool definitions, arguments/results, and exception messages and stack traces all ship as span attributes. The explicit `instrument(...)` call is the consent (a deliberate deviation from the wider OTel GenAI convention of content off behind an env-var opt-in). Review the receiving backend’s retention and access controls, and apply one of the two controls below before exporting to a backend not cleared for conversation data.

```ts
// content-free spans
const instrumentation = createOpenTelemetryInstrumentation({ content: false });

// policy in code
const instrumentation = createOpenTelemetryInstrumentation({
  content: {
    transform(content, scope) {
      if (scope.contentType === 'exception_stacktrace') return undefined; // strip stacks
      return redactSecrets(content);
    },
  },
});
```

A detached converted value passes through `transform` once per content type; returning `undefined` omits that content, and a throwing transform emits a `[flue]` failure sentinel instead of the unredacted value. `scope` carries the content type, event type, execution identity, and `traceId`/`spanId`. For byte budgets, slice inside the transform or use the exported `truncateContent(content, { maxBytes })`. After the transform, a 56 KiB per-span content budget is enforced **in-band**: everything content-bearing a span carries — messages, system instructions, tool definitions and payloads, exception message/stack — shares one pool, with a reserve held so response content has room beside large prompts. Payloads stay valid JSON, oldest messages drop first behind a `role: "flue"` sentinel message, and oversized strings are cut with a `[flue:truncated, …]` suffix — there are no side-channel truncation marker attributes; search payloads for `[flue]` instead.

Object-shaped tool arguments/results use standard `gen_ai.tool.call.*` attributes; other shapes use `flue.tool.call.arguments` or `flue.tool.call.result` under the same policy.

## Metrics and Logs

The instrumentation emits client-operation, token-usage, agent-invocation, and tool-duration histograms. Metric dimensions exclude execution IDs; review your application-controlled agent, tool, provider, and model names for appropriate cardinality. Input token totals include cache-read and cache-creation input tokens.

Logs require explicit Logger injection. Failed inference operations emit the standard `gen_ai.client.operation.exception` event at WARN/13\. Error type is always recorded; exception messages and throw-site stack traces (`exception.stacktrace`) ride the content gate — included by default, transformed by your `transform`, absent under `content: false`. Logger absence does not affect traces or metrics.

## Propagation and recovery

Flue validates and persists `traceparent` and optional `tracestate` at direct-agent admission. Baggage is not persisted. Durable direct-agent processing activates its extracted admission context, and execution interceptors activate owning spans around agent, model-stream, tool, and task work. `dispatch(...)` does not currently propagate trace context.

Recovery does not replay provider or tool execution. Stored stream chunks create no chat spans or usage observations, and synthetic interrupted-tool repairs create no `execute_tool` spans.

## Streaming limitation

Pi does not expose authoritative raw provider stream-item timing. Flue therefore omits time-to-first-chunk and time-per-output-chunk metrics instead of deriving inaccurate values from semantic text/reasoning deltas or recovered chunks.

## Unsupported operations

Flue does not emit invented spans for agent creation, planning, embeddings, retrieval, memory operations, remote agent clients, or evaluations. These operations remain absent until Flue exposes a genuine corresponding boundary.

## Verify

Use an in-memory OpenTelemetry exporter in tests to verify hierarchy, names, kinds, status, attributes, metrics, and your content policy (including that `content: false` or your transform actually removes what you expect). Hosted backend rendering is backend-specific; standards-correct OTel output is the portable contract.

## Docs Navigation

Current page: [OpenTelemetry](https://flueframework.com/docs/ecosystem/tooling/opentelemetry/)

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
