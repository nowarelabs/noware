---
description: Grade Flue agent output and compare results across versions with Jetty.
title: Jetty | Flue
image: https://flueframework.com/docs/og4.jpg
---

# Jetty

Last updated Jul 22, 2026[View as Markdown](https://flueframework.com/docs/ecosystem/tooling/jetty/index.md)

## Quickstart

Install the [Jetty TypeScript SDK](https://www.npmjs.com/package/@jetty/sdk) in an existing Flue project:

```sh
pnpm add @jetty/sdk
```

Jetty does not use a `flue add` blueprint. Follow Jetty’s [Flue integration guide](https://docs.jetty.io/docs/agent-integrations/flue) to create and deploy a grading runbook, then call the SDK from a workflow script.

## Overview

Jetty can grade output produced by a Flue agent and store the grading task as a trajectory. Labels on that trajectory can record the score, pass/fail result, evaluated configuration, and other dimensions that you want to compare across versions.

The following Node.js script starts the Flue runtime in-process, prompts its agent, sends the reply to a separately configured Jetty grader, and prints the grade with its Jetty trajectory ID:

```ts
import { init } from "@flue/runtime";
import { start } from "@flue/runtime/node";
import { gradeWithJetty, JettyClient } from "@jetty/sdk";
import { Triage } from "../src/agents/triage.ts";

interface TriageGrade {
  total: number;
  pass: boolean;
}

const ticket = process.argv[2] ?? "Summarize this support request.";
const jetty = new JettyClient();

await using flue = await start({ agents: [Triage] });

const agent = init(Triage, { id: `evaluate-${Date.now()}` });
const receipt = await agent.dispatch(ticket);
const reply = await agent.read(receipt);

const { grade, trajectoryId } = await gradeWithJetty<TriageGrade>(
  jetty,
  process.env.JETTY_COLLECTION!,
  process.env.JETTY_GRADE_TASK!,
  {
    files: [
      {
        filename: "case.json",
        data: JSON.stringify({ ticket, response: reply.text }),
      },
    ],
    useTrialKeys: process.env.JETTY_USE_TRIAL_KEYS === "true",
    labels: (result) => ({
      "eval.grade": String(result.total),
      "eval.pass": String(result.pass),
    }),
  },
);

console.log(JSON.stringify({ grade, trajectoryId }, null, 2));
```

The grading runbook must produce the `grade.json` file expected by `gradeWithJetty(...)`. Keep the grader separate from the agent being evaluated so that changing the agent does not silently change its rubric.

## Configure

| Variable             | Purpose                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| JETTY_API_TOKEN      | **Required** \- Authenticates the Jetty SDK. The SDK can also read \~/.config/jetty/token. |
| JETTY_COLLECTION     | **Required** \- Identifies the collection that owns the grading task.                      |
| JETTY_GRADE_TASK     | **Required** \- Identifies the deployed grading task.                                      |
| JETTY_USE_TRIAL_KEYS | **Optional** \- Set to true to use Jetty’s trial model keys for the grading task.          |

The Flue agent still needs model-provider credentials, which come from the process environment. Jetty credentials configure the separate grading operation.

`@jetty/sdk` and `start()` both require Node.js. To grade a deployed agent instead — including one on the Cloudflare target — prompt it over HTTP with the [Agent SDK](https://flueframework.com/docs/sdk/overview/) and pass the reply to the same `gradeWithJetty(...)` call from any Node.js process.

## Protect sensitive content

Jetty trajectories can persist the files, step inputs, and outputs used for grading. Redact credentials, personal information, and other sensitive content before sending agent output to Jetty. Use Jetty’s secret parameters for credentials needed by the grading runbook rather than including them in persisted initialization parameters or uploaded files.

Review Jetty’s retention, access, privacy, and compliance controls before grading production content.

## Verify

Deploy the grading runbook following Jetty’s integration guide, configure the required environment variables, and run the script:

```sh
node scripts/evaluate-triage.ts "Summarize this support request."
```

Confirm that the script prints the expected grade and trajectory ID, then inspect the trajectory in Jetty to verify its labels and captured content.

## Next steps

See [Evals](https://flueframework.com/docs/guide/evals/) for choosing cases, deterministic assertions, and model-based judges, and [Workflows](https://flueframework.com/docs/guide/workflows/) for the scripting surface used here — from `flue run` one-shots to durable orchestration. Flue’s [Vitest Evals integration](https://flueframework.com/docs/ecosystem/tooling/vitest-evals/) provides an alternative for running assertions and judges through Vitest, while Jetty stores each grading task as a comparable trajectory.

## Docs Navigation

Current page: [Jetty](https://flueframework.com/docs/ecosystem/tooling/jetty/)

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
