---
description: Give agents a durable Cloudflare workspace with a real shell.
title: Cloudflare Computer | Flue
image: https://flueframework.com/docs/og4.jpg
---

# Cloudflare Computer

Last updated Aug 4, 2026[View as Markdown](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare-computer/index.md)

The Cloudflare Computer adapter wraps a [@cloudflare/computer](https://github.com/cloudflare/computer) `Workspace` — a durable, SQLite-backed virtual filesystem that lives in the agent’s own Durable Object — into a Flue sandbox on the Cloudflare target. Commands run through the package’s worker-shell backend, a just-bash shell in a Dynamic Worker operating directly on the durable files, so agents get Flue’s full standard tool set (`bash`/`grep`/`glob`/`read`/`write`/`edit`) with no substitutions and no container.

`@cloudflare/computer` is an early preview from Cloudflare — suitable for experiments and prototypes, not production.

## Quickstart

Add durable workspace sandbox capability to an existing Flue project with the Cloudflare Computer blueprint. Run the following command in your terminal or coding agent of choice:

```bash
flue add sandbox cloudflare-computer
```

## Overview

The blueprint creates the adapter at `<source-root>/sandboxes/cloudflare-computer.ts`. Shell commands don’t run in your Worker: the adapter mints a Dynamic Worker through a [Worker Loader](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/) binding and runs just-bash there, against the durable filesystem. That binding — currently beta-gated, so your Cloudflare account needs access — and the `experimental` compatibility flag its Dynamic Worker requires are the two Wrangler additions; there are no API keys or environment variables:

```jsonc
{
	"compatibility_flags": ["nodejs_compat", "experimental"],
	"worker_loaders": [{ "binding": "LOADER" }]
}
```

Two one-line re-exports complete the wiring: the project’s `cloudflare.ts` re-exports `WorkspaceServiceProxy` (the loopback the shell dials back through), and each sandbox-using agent module re-exports the generated `workspaceHost` extension so its Durable Object hosts the workspace.

```ts
// flue-blueprint: sandbox/cloudflare-computer@1
import { Workspace, type WorkspaceOptions /* ... */ } from '@cloudflare/computer';
import { WorkerShellBackend } from '@cloudflare/computer/backends/worker-shell';
import { createGitClient } from '@cloudflare/computer/git';
import type { Sandbox, SandboxFactory /* ... */ } from '@flue/runtime';
import { extend, getDurableObjectIdentity } from '@flue/runtime/cloudflare';

/** Re-export from each agent module: `export { workspaceHost as cloudflare } ...` */
export const workspaceHost = extend({
	base: (Base) =>
		class extends Base {
			/* ... captures the Durable Object state; exposes the workspace stub ... */
		},
});

/** One durable Workspace per agent instance, shared with the sandbox. */
export function getComputerWorkspace(options: GetComputerWorkspaceOptions): Workspace {
	/* ... memoized construction: DO storage + git client + WorkerShellBackend ... */
}

export function getComputerSandbox(options: GetComputerWorkspaceOptions): SandboxFactory {
	return {
		async createSandbox(): Promise<ComputerSandboxEnv> {
			const workspace = getComputerWorkspace(options);
			await workspace.fs.mkdir('/workspace', { recursive: true });
			return { ...createWorkspaceSandbox(workspace, '/workspace'), workspace };
		},
		// No `tools` override: exec() works here, so the framework's standard
		// set (bash/grep/glob/read/write/edit) applies as-is.
	};
}
```

Pass the `worker_loaders` binding to `getComputerSandbox(...)` inside the agent:

```ts
'use agent';
import { env } from 'cloudflare:workers';
import { useModel, useSandbox } from '@flue/runtime';
import { getComputerSandbox } from '../sandboxes/cloudflare-computer';

export { workspaceHost as cloudflare } from '../sandboxes/cloudflare-computer';

export function Assistant() {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useSandbox(getComputerSandbox({ loader: env.LOADER }));
	return 'You explore and edit your durable workspace with the standard file and shell tools.';
}
```

Application-owned hydration and inspection go through the workspace’s native surface: `getComputerWorkspace(...)` (or `computerWorkspace(harness.sandbox)`) exposes `workspace.git` for clones and commits and `workspace.fs` for out-of-band reads and writes, and the adapter’s `workspace` option reshapes the generated `WorkspaceOptions` — read-only R2 mounts, a `defaultGitIdentity`, an observer, additional backends. Import all of these helpers from your project adapter file, not from `@flue/runtime/cloudflare`.

## Choose this adapter when

Use Cloudflare Computer when files must be stored durably in the agent’s own Durable Object and shell-expressible work covers the agent’s needs — no container to provision, no cold start beyond the Dynamic Worker. Filesystem state survives Durable Object restarts and is capped around 10 GB (it shares the DO’s SQLite storage).

It is not a Linux box: commands run in a JavaScript shell without native binaries or package managers. That is the adapter’s default wiring, not the package’s ceiling — `@cloudflare/computer` can register additional execution backends against the same durable files, including its full-Linux `CloudflareContainerBackend`, appended through the adapter’s `workspace` option as an application-owned configuration. If the agent’s baseline need is language toolchains, native tools, or writable bucket mounts, use [Cloudflare Sandbox](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare/) (Containers) instead.

See [Sandboxes](https://flueframework.com/docs/guide/sandboxes/) and [Deploy on Cloudflare](https://flueframework.com/docs/ecosystem/deploy/cloudflare/).

## Docs Navigation

Current page: [Cloudflare Computer](https://flueframework.com/docs/ecosystem/sandboxes/cloudflare-computer/)

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
