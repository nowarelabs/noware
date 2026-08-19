---
description: Run the Flue Node server as a long-running Railway service.
title: Deploy Agents on Railway | Flue
image: https://flueframework.com/docs/og4.jpg
---

# Deploy Agents on Railway

Last updated Jul 21, 2026[View as Markdown](https://flueframework.com/docs/ecosystem/deploy/railway/index.md)

Flue’s Node target is a long-running HTTP server, not a serverless function, so it deploys to Railway as a standard service that stays up between requests. This guide covers the Railway-specific setup; the build itself is the same `node` target described in [Deploy Agents on Node.js](https://flueframework.com/docs/ecosystem/deploy/node/) — `npx vite build` (with the `flue()` plugin in `vite.config.ts`) produces `dist/server.mjs`, which you start with `node dist/server.mjs`.

Railway owns the platform — building the repo, injecting `PORT`, running the start command, provisioning Postgres. Flue owns the server it starts. The two meet at the build command, the start command, and a handful of environment variables.

## Build and start

Railway builds a connected repo with [Railpack](https://railpack.com), which auto-detects Node projects with zero configuration. Set the build and start commands so Railpack compiles the Flue Node target and launches the generated server:

* **Build command** — `npm ci && npx vite build`
* **Start command** — `node dist/server.mjs`

The build externalizes your dependencies rather than bundling them, so `node_modules` must be present at runtime. `npm ci` installs them; keep `vite` and `@flue/vite` available to the build command. The built server reads only the environment present when it starts — it does not load `.env` — so configuration lives in Railway variables, not a committed file.

To build from a container instead, drop the Dockerfile from [Deploy Agents with Docker](https://flueframework.com/docs/ecosystem/deploy/docker/) at the repo root. Railway detects a root `Dockerfile` (capital `D`) and builds with it in place of Railpack; point at a non-standard path with the `RAILWAY_DOCKERFILE_PATH` variable.

## Config as code

Pin the build and deploy settings in a `railway.json` (or `railway.toml`) at the repo root so they travel with the code rather than living only in the dashboard:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "npm ci && npx vite build"
  },
  "deploy": {
    "startCommand": "node dist/server.mjs",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

Set `build.builder` to `DOCKERFILE` (with `build.dockerfilePath` if non-standard) to use the Docker path instead. `deploy.healthcheckPath` only works if your application exposes that route — see [Health and streaming](#health-and-streaming) below.

## Environment variables

Set variables on the service’s **Variables** tab. Flue needs the API key for your model provider, plus an optional model specifier:

| Variable                               | Purpose                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ANTHROPIC\_API\_KEY / OPENAI\_API\_KEY | Authenticates calls to your model provider.                                                           |
| MODEL\_SPECIFIER                       | Optional default model, e.g. anthropic/claude-sonnet-4-6, if your app reads one from the environment. |

Use the variable name your provider expects, and **seal** the provider key so its value is supplied to builds and deploys but never readable back through the dashboard or API (sealing is one-way — a sealed variable cannot be un-sealed). Railway injects `PORT` automatically and the server binds it on `0.0.0.0` (defaulting to `3000` only when unset), so leave `PORT` unset and let Railway choose it — binding to `0.0.0.0` rather than `localhost` is what lets Railway’s proxy reach the service.

## Persistence

The Node target keeps canonical agent conversations and accepted submissions in memory by default. That state is lost on every restart and redeploy.

For durable process or host replacement, add a Railway Postgres service (**\+ New > Database > PostgreSQL**) to the same project. A shared database does not enable active-active ownership of one agent instance: route each instance to one live Node process and avoid overlapping owners during replacement. The database exposes a `DATABASE_URL`; wire it into your Flue service with a reference variable rather than copying the value:

```plaintext
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Then install the adapter and read that variable in `db.ts`:

```bash
npm install @flue/postgres
```

```typescript
import { postgres } from '@flue/postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default postgres({
  query: async (text, params) => (await pool.query(text, params)).rows,
  transaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn({
        query: async (text, params) => (await client.query(text, params)).rows,
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  close: () => pool.end(),
});
```

Flue discovers `db.ts` at build time and wires it into the generated server. Schema creation, canonical streams, attachments, and durable submission state are handled by the adapter. See [Database](https://flueframework.com/docs/guide/database/) for the adapter contract and alternatives, and [Postgres](https://flueframework.com/docs/ecosystem/databases/postgres/) for the bring-your-own-driver details.

## Health and streaming

Flue does not generate a `/health` route. If you set `deploy.healthcheckPath`, define the matching route in `app.ts` — otherwise Railway’s check never passes and the deploy is held back. Without a health check, Railway considers the deploy ready once the process binds `PORT`.

Agent conversations are streamed through long-lived `GET` reads on the conversation URL (long-poll or SSE). Message admission returns `streamUrl`, `offset`, and `submissionId`; clients can reconnect and resume the conversation stream from an offset. Railway’s edge proxy keeps active streams open, but treat any attached request as bounded; move genuinely long work to a scheduled trigger or separate worker. See the [Streaming Protocol](https://flueframework.com/docs/reference/streaming-protocol/).

## Going further

* **Scheduled agents.** Invoke the deployed application’s authenticated agent endpoint from a **Cron Schedule** — a `POST` to the agent’s conversation URL with a `kind: 'signal'` message. This avoids rebuilding and starting a second application runtime for every fire. Railway enforces a minimum interval of five minutes, evaluates schedules in UTC, and skips a fire if the previous run is still active. See [Schedules](https://flueframework.com/docs/guide/schedules/).
* **Queue-backed workers.** For continuous, queue-driven delivery, run a second always-on service that makes attached agent requests and waits for results, or have application code call `dispatch(...)` for asynchronous delivery identified by the receipt’s `submissionId`. A worker service has no public port; it just runs `node dist/server.mjs` (or a custom entry) and processes work.

## References

* [Config as code](https://docs.railway.com/reference/config-as-code) — official `railway.json`/`railway.toml` field reference (`build.builder`, `buildCommand`, `startCommand`, `healthcheckPath`, `restartPolicyType`).
* [Variables](https://docs.railway.com/guides/variables) — official guide to variables, sealed secrets, and the `${{Service.VAR}}` reference syntax.
* [Cron jobs](https://docs.railway.com/reference/cron-jobs) — official scheduling rules: UTC, five-minute minimum, skip-if-active.
* [Deploy an Express app](https://docs.railway.com/guides/express) — Railway’s worked example of deploying a standard Node server.

## Docs Navigation

Current page: [Deploy Agents on Railway](https://flueframework.com/docs/ecosystem/deploy/railway/)

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
