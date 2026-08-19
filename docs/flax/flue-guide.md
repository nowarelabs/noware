# Flue — Condensed Reference Guide

Condensed notes from the Flue docs and Cloudflare's "Agent Development Lifecycle" post. Use this as a quick reference for building Flue agents.

## What is Flue

- Open agent framework from the creators of Astro. React-like hooks API for building agents in TypeScript.
- Built on [Pi](https://pi.dev/docs/latest/providers) → supports all Pi providers (Anthropic, OpenAI, etc.). Model specifiers look like `anthropic/claude-sonnet-4-6`.
- Run locally or deploy: Node.js, Cloudflare Workers, GitHub Actions/CI.
- Requires Node `>=22.19.0`. API keys via `.env` (e.g. `ANTHROPIC_API_KEY=...`).
- Built on Hono (server framework) + Vite (build pipeline). Cloudflare uses `agents` (Cloudflare Agents SDK) underneath.

## Project setup

```bash
npm install @flue/runtime @flue/cli
# for deployment: npm install @flue/vite hono vite
# for Cloudflare: npm install -D @cloudflare/vite-plugin wrangler
```

`flue.config.ts`:

```ts
import { defineConfig } from '@flue/runtime/config';
export default defineConfig({ target: 'node' /* or 'cloudflare' */ });
```

`vite.config.ts` for deployment:

```ts
import { flue } from '@flue/vite';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [flue()] });
// Cloudflare: plugins: [flue(), cloudflare()]  (flue() must come FIRST)
```

## Agents — core concepts

An agent = **LLM + harness + specialized context**. Two core primitives:

### Agent Functions
- A JS function that returns the agent's `system` prompt (instructions). Runs on every turn (like a React render).
- Register via `'use agent'` directive at top of file. Build scans source root, registers every exported capitalized function as an agent.
- Function name = durable identity (keys conversation storage). Pin with static `TriageAgent.agentName = 'triage-agent'` to rename without migration.
- Avoid injecting dynamic data into instructions — it busts the LLM prompt cache (costs money).

```ts
'use agent';
import { useModel } from '@flue/runtime';

export function TriageAgent({ id }: AgentProps) {
  useModel('anthropic/claude-sonnet-4-6');
  return `Investigate GitHub issue #${id} and recommend the next action.`;
}
TriageAgent.agentName = 'triage-agent';
```

### Agent Hooks (`useX`)
| Hook | Purpose |
|---|---|
| `useModel` | selects the LLM |
| `useSandbox` | filesystem + command-execution environment |
| `useTool` | call application code / external systems |
| `useMcpConnection` | mount tools from MCP ecosystem |
| `useSkill` | load expertise on demand |
| `useSubagent` | delegate work to other agents |
| `usePersistentState` | durable custom data across agent lifetime |
| `useAgentStart` / `useAgentFinish` | lifecycle event hooks |
| `useDelivery` | read validated attributes from a dispatched signal |

### Interacting with agents (all share the same durability APIs)
1. **CLI**: `npx flue run src/agents/assistant.ts --id hello-1 --message "..."` — `--id` makes the conversation persistent.
2. **HTTP**: `POST /agents/support/ticket-8472` — fire-and-forget, returns `202` with `{ streamUrl, offset, submissionId }`. `GET` same URL to read history/updates.
3. **`dispatch(...)`**: server-side, for webhooks/queue events — async, returns a receipt.
4. **Standalone scripts**: `start({ agents, db })` + `init(Agent, { id })` + `dispatch`/`read` — for cron, CI, tests. DB adapters like `sqlite('./nightly.db')` persist conversations.

## Tools

Four parts: `name`, `description` (the model's only doc — be specific about what/when/returns), optional `input` schema (Valibot), and `run` function.

```ts
import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const lookupOrder = defineTool({
  name: 'lookup_order',
  description: 'Look up one order by id and return its current status.',
  input: v.object({ orderId: v.string() }),
  async run({ data }) {
    const order = await orders.get(data.orderId);
    return { output: { status: order.status, eta: order.eta } };
  },
});
```

Mount with `useTool(lookupOrder)`. Unique names required — `task`, `activate_skill`, `read_skill_resource` are reserved.

Key semantics:
- **Input**: Valibot top-level object schema; validated before `run`; failure returns error to model (never calls `run`).
- **Output**: return envelope `{ output?, terminate? }`, not a bare value. Bare string = shorthand for `{ output: string }`. `terminate: true` ends the turn.
- **Errors**: throw → model sees the error and can retry. Don't swallow.
- **`run` context**: `signal` (AbortSignal — pass to async work), `log` (progress logging, streamed as events, model never sees), `toolCallId`.
- **`harness: true`** → tool gets `harness.sandbox` (live env: readFile/writeFile/exec) and `harness.prompt(text, { result?, tools? })` (model op in a scratch conversation, repeatable). Never runs standalone.
- **`durable: true`** → tool gets `step`; all side effects go through `step.do(name, fn)`. Exactly-once-recorded, at-least-once-executed. On crash recovery, completed steps replay from records. Derive step names deterministically; keep step values small (point to sandbox for big artifacts); make external-effect steps idempotent.
- **Conditional tools**: gate `useTool` on `usePersistentState` — an unmounted tool can't be called (stronger than "don't use it"). Changing the toolset invalidates the prompt cache, so gate on rarely-changing state.
- **Protect access**: tool args are NOT an authorization boundary. Pull authorized identifiers from the delivered signal's `attributes` via `useDelivery()`; bind tokens/repos via closure. Trusted code decides scope, model picks values within it.

### Built-in sandbox tools
With a sandbox attached: `read` (truncated 2000 lines/50KB, offset/limit), `write`, `edit`, `bash`, `grep`, `glob`. Framework adds `task` (subagents, always), `activate_skill` (skills), `read_skill_resource` (skill resource files).

## Skills

Reusable expertise — markdown instructions (+ optional supporting files) loaded only when needed. Follows open [Agent Skills](https://agentskills.io) format. **Progressively disclosed**: always-present catalog = 1 line (name + description); full instructions load on activation via `activate_skill` tool call. System prompt never changes on activation → cached prompt survives.

On disk: a directory with `SKILL.md` (frontmatter `name` + `description`, body = instructions); everything else = supporting files (read-only, served from bundle at virtual paths).

```ts
'use agent';
import { useModel, useSkill } from '@flue/runtime';
import refunds from '../skills/refunds/SKILL.md';

export function SupportAgent() {
  useModel('anthropic/claude-haiku-4-5');
  useSkill(refunds);
  return 'Answer customer support questions clearly and accurately.';
}
```

- Import must be **static** (dynamic import = build error). One mount per name per render.
- Packaging refuses secrets (`.env`, private keys, symlinks) and skips repo noise.
- `defineSkill({ name, description, instructions, files? })` for inline/generated skills; pass `.md` string imports through it. Validated + frozen.
- Steering: instructions can direct activation ("Activate the `refunds` skill before..."). Harness prompts share the catalog.
- **Workspace skills**: `<cwd>/.agents/skills/<name>/SKILL.md` discovered at session start for sandboxed agents — no import needed. Read from disk at activation (edits picked up). Malformed ones are skipped w/ warning.
- For always-on content, use a markdown string import or `useInstruction(...)`, not a skill.

## Sandboxes

Execution environment (filesystem + shell). **An agent has none unless you `useSandbox()`.** At most once per render; can't be used inside a subagent (children share parent env). Factory is lazy — expensive work in `createSandbox()`, called once at init, receives agent instance id.

Adds: file/shell tools, workspace context in system prompt (cwd, dir listing, `AGENTS.md`), workspace skills, subagent env sharing, `harness.sandbox` access.

### Virtual sandbox (`bash(...)` from `just-bash`)
- In-memory filesystem + emulated bash (`ls`, `sed`, `awk`, `jq`, pipes, `curl`), no real processes.
- Isolated from host; network opt-in via `network: { allowedUrlPrefixes: [...] }`.
- Ephemeral — rebuilt fresh per new work. Keep durable knowledge in persistent state.
- Configurable: seed files, allowlist network, custom commands.

```ts
import { bash, useModel, useSandbox } from '@flue/runtime';
import { Bash, InMemoryFs } from 'just-bash';

export function CatalogAnalyst() {
  useModel('anthropic/claude-haiku-4-5');
  useSandbox(
    bash(() => new Bash({
      fs: new InMemoryFs({ '/data/catalog.csv': exportCatalogCsv() }),
      network: { allowedUrlPrefixes: ['https://api.example.com/'] },
    })),
  );
  return 'Answer questions about the product catalog in /data/catalog.csv.';
}
```

### Local sandbox (`local()` from `@flue/runtime/node`)
- Node only. Binds to host: real filesystem + real shell processes. NO isolation — don't use for untrusted requests/multi-tenant.
- Shell does NOT inherit process env. Allowlist passes through (`PATH`, `HOME`, `LANG`, ...); never API keys. Opt-in per var via `env: { GH_TOKEN: process.env.GH_TOKEN }`. Don't pass `{...process.env}` outside fully-trusted envs. Env snapshot taken once at construction.

### Remote sandboxes
- `flue add sandbox <provider>` (e2b, daytona, modal, cloudflare, ...) generates a thin adapter wrapping provider SDK. Adapters create/reuse/delete provider sandboxes; Flue never destroys infra.
- `createSandbox({ id })` keying on instance id = durable per-conversation workspace.
- Cancellation: `local()` kills for real; most providers abandon (remote command keeps running, output discarded).
- Sandbox-provided `tools` can **replace** the default tool set (e.g. swap bash/grep/glob for an executor tool).

### Conditional attachment
`useSandbox` can be gated on persistent state — a tool can flip it mid-conversation (e.g. `open_investigation`). Env swaps at next turn boundary; model told via an `environment` signal. System prompt stays frozen until next compaction.

## Routing (`app.ts`)

- `src/app.ts` is the single HTTP entrypoint; default export is the server (a Hono app). Flue never auto-mounts agents — mounting is explicit.
- `createAgentRouter(Agent)` from `@flue/runtime/routing` builds a sub-router. Pure factory, no options/side effects.

```ts
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { Support } from './agents/support.ts';

const app = new Hono();
app.route('/agents/support', createAgentRouter(Support));
export default app;
```

- Mount path is pure routing; conversation identity = function name/`agentName`, never the URL. Same agent can mount at two paths.
- **Conversation URL surface** (`/mount/:id`):
  - `POST /:id` — deliver message (202 admission)
  - `GET /:id` — snapshot; `?view=updates&offset=...` for live (long-poll/SSE)
  - `HEAD /:id`, `POST /:id/abort`, `GET /:id/attachments/:attachmentId`
- Fire-and-forget: no "wait for reply" mode. Reply lands in conversation, read it back.
- **Security**: no built-in auth — anyone reaching a conversation URL can talk to it. Protect with Hono middleware BEFORE the mount:
  1. Authentication — who is the caller?
  2. Authorization — can this caller access THIS conversation id? (ids are caller-chosen path segments)
  - Pattern: `app.use('/agents/support/*', ...)` then parse `conversationId` from path, verify ownership.
  - Prefer server-issued ids (`user-${user.id}`). Private agents: keep dispatch-only.
- **CORS**: router sets none. Dev (`vite dev`) allows permissive localhost. In prod, add `hono/cors` + `exposeHeaders: ['Stream-Next-Offset', 'Stream-Up-To-Date', 'Location']`.
- **Channels**: `slack.route()` mounts provider webhooks (e.g. `POST /channels/slack/events`).
- **Directory mounting**: `import.meta.glob('./agents/*.ts', { eager: true })` + mount each capitalized export.
- **Dispatch-only agents**: registered but never mounted — driven by webhooks/schedules. No `createAgentRouter` call.
- `Fetchable` interface types a custom fetch-compatible entry. On Cloudflare `env` = bindings; Node `ctx` is undefined.

## Cloudflare deployment

Two Vite plugins: `flue()` + `@cloudflare/vite-plugin` (flue first). Cloudflare target auto-detected. Flue builds on `agents` SDK (Durable Object base class).

- **One Durable Object class per agent.** Class name derives from identity with camel-boundary split + prefix: `Translator` → class `FlueTranslatorAgent`, binding `FLUE_TRANSLATOR_AGENT`. Requires `nodejs_compat` + compatibility_date >= 2026-04-01.
- **Migrations** (`wrangler.jsonc`): adding an agent = the `'use agent'` file + `app.route(...)` mount + a uniquely tagged `new_sqlite_classes` migration (SQLite required, not legacy `new_classes`). Append, never rewrite. Renaming identity → `renamed_classes`.
- **Dev**: `npx vite dev` (local workerd). Local keys in `.dev.vars` (or `.env`, not both). Deployed secrets: `npx wrangler secret put ANTHROPIC_API_KEY`. Or use `cloudflare/*` Workers AI model specifiers — no keys.
- **Build**: `npx vite build` writes Worker artifact + finalized config to `dist/`; `npx wrangler deploy` (with `--dry-run` first). Flue never rewrites authored `wrangler.jsonc`; merges into generated `.flue-vite.wrangler.jsonc`.
- **Assets**: if serving frontend + agents from one Worker, put every app API prefix (including agent/channel mounts) in `assets.run_worker_first`.
- **Extending DOs**: export `cloudflare = extend({ base?, wrap? })` from agent module for native SDK lifecycle (`onStart()`, `schedule()`, `queue()`). Don't override `fetch()`/`onRequest()`/`onFiberRecovered()`/`alarm()`.
- **Extending Worker**: optional `src/cloudflare.ts` — named exports become top-level Worker exports (e.g. your own Durable Objects); optional default export for non-HTTP handlers (`scheduled`). Must not export a `fetch` handler (that stays in `app.ts`).
- **Remote sandbox**: `@cloudflare/sandbox` → `src/cloudflare.ts` re-exports `Sandbox`, declare DO binding + migration + `containers[].image` (a `Dockerfile` from `docker.io/cloudflare/sandbox:<tag>`). `useSandbox(cloudflareSandbox(getSandbox(Sandbox, id)))` — keyed on id = persistent per-conversation container. Multiple sandboxes = aliased exports + per-container entries.
- **Outbound Workers**: programmable egress proxy on the Sandbox class — injects secrets at the proxy layer (`static outboundByHost`), zero-trust (container never sees tokens).
- **Persistence**: one append-only conversation stream per agent in DO SQLite; attachments in separate immutable store. Filesystem durability is a SEPARATE decision (virtual sandbox = ephemeral).
- **Interruption/recovery**: conservative — persists canonical input before provider processing; retries only when it can prove work didn't cross the boundary, otherwise appends an interruption advisory and terminalizes. Submission ids are idempotency keys for dispatch. Treat persisted inputs as sensitive. No in-place DB format migration (stamped `flue_meta` table).
- **Observability**: `observability: { enabled, traces }` in wrangler config → tool/hook logs + traces (agent-level spans `invoke_agent`, `chat`, `execute_tool`). Runtime-level (tokens, tool payloads, Sentry/OTel) via Observability guide.
- **Sandbox context**: `<cwd>/AGENTS.md` = agent system prompt from sandbox; `<cwd>/.agents/skills/<name>/SKILL.md` = discovered skills. Loaded at `init()`.


## Agent SDK (`@flue/sdk`)

The **Flue Agent SDK** (`@flue/sdk`) is a TypeScript client for one agent conversation of a deployed Flue application. ESM-only; runs anywhere `fetch` is available; one dependency, `@durable-streams/client`. Each client wraps a single **conversation URL** (agent router mount + caller-chosen conversation id).

```sh
npm install @flue/sdk
```

- No deployment-wide client, no name/id addressing. New conversation = new client with a fresh id on the mount URL; created on its first send. No API to enumerate/list/delete conversations.
- Construction is synchronous, does no I/O, doesn't verify the URL. `@flue/react`'s `useFlueAgent()` is built on this package.

```ts
const conversation = createFlueClient({ url, token: process.env.FLUE_TOKEN });
const admission = await conversation.send({ message: { kind: 'user', body: 'Hi' } });
const reply = await conversation.read(admission);
```

### HTTP surface each method wraps
- `send()` — `POST <url>`
- `wait()` — `GET <url>?view=updates` stream from the admission's offset until its `submission-settled` chunk
- `read()` — `wait()`'s stream follow, then one `history()` read
- `history()` — `GET <url>?view=history` (one materialized snapshot)
- `observe()` — `history()` to hydrate, then the `updates` stream; reconnection/rehydration/dedup handled internally
- `abort()` — `POST <url>/abort`
- `attachmentUrl()` — resolves `<url>/attachments/<attachmentId>`

### `createFlueClient()`
```ts
function createFlueClient(options: CreateFlueClientOptions): FlueClient;
type CreateFlueClientOptions = HttpClientOptions;   // both names exported

interface HttpClientOptions {
  url: string;
  fetch?: typeof fetch;
  headers?: RequestHeaders;
  token?: string;
}
```
- `url` — one conversation URL; trailing slashes stripped. In a browser, relative URLs resolve against `location.origin`; outside a browser, relative throws `TypeError: relative url requires a browser; pass an absolute URL`.
- `fetch` — HTTP impl for every request including stream reads. Defaults to global `fetch` bound to `globalThis`; a caller-supplied function is used as-is (bind it yourself if it's a method of another object).
- `headers` — merged into every request, after the token-derived header, so an `authorization` entry wins over `token`.
- `token` — sent as `authorization: Bearer <token>` on every request.
- No retry/timeout options; each JSON request is one fetch cancelled per call via `AbortSignal`; stream reads take `backoffOptions` per call on `wait()`/`observe()`.
- Every request (streams included) travels through `fetch`, so any fetch-shaped transport works (Cloudflare service bindings, test transports returning canned `Response`s).

```ts
type RequestHeaders =
  Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
```
Static, or a sync/async function re-evaluated once per JSON request and once per stream connection/reconnection (an async factory can refresh a short-lived token). Headers apply only to requests the client itself makes — `attachmentUrl()` returns a plain URL string with none attached.

### `FlueClient`
```ts
interface FlueClient {
  readonly url: string;
  send(options: AgentPromptOptions): Promise<AgentSendResult>;
  read(target: AgentSendResult | string, options?: AgentReadOptions): Promise<AgentReadResult>;
  wait(admission: AgentSendResult, options?: AgentWaitOptions): Promise<void>;
  abort(options?: { signal?: AbortSignal }): Promise<AgentAbortResult>;
  history(options?: FlueConversationHistoryOptions): Promise<FlueConversationSnapshot>;
  observe(options?: AgentConversationObserveOptions): AgentConversationObservation;
  attachmentUrl(attachmentId: string): string;
}
```
- `url` — fully resolved conversation URL, no trailing slash.
- Every HTTP method rejects with `FlueApiError` on non-2xx; stream-backed methods (`wait()`, `observe()`) also surface stream errors.

#### `send()`
`POST <url>`. Resolves on admission (HTTP 202) — durably accepted, not processed; no reply in the result. Wire body is the `DeliveredMessage` verbatim, with `initialData` and `uid` as reserved top-level siblings.

```ts
send(options: AgentPromptOptions): Promise<AgentSendResult>;

interface AgentPromptOptions {
  message: DeliveredMessage;
  initialData?: unknown;
  uid?: string | null;
  signal?: AbortSignal;
}
```
- `message` — the message to deliver.
- `initialData` — instance-creation data; consulted only when this send creates the conversation, validated against the agent's schema, recorded once, read via `useInitialData()`. Ignored on an existing conversation; pair with `uid: null` to error instead; cannot combine with a string `uid`.
- `uid` — send condition, instance uid as ETag. Omitted: unconditional (continue or create). String: continue only that incarnation; mismatch/missing instance rejects `404 FlueApiError` (`agent_instance_not_found`), nothing delivered. `null`: create only; existing instance rejects `409 FlueApiError` (`agent_instance_exists`, uid in `body.error.meta.uid`).
- `signal` — aborts the HTTP request, not agent work (that's `abort()`).

```ts
type DeliveredMessage =
  | { kind: 'user'; body: string; attachments?: DeliveredAttachment[] }
  | {
      kind: 'signal';
      type: string;
      body: string;
      attributes?: Record<string, string>;
      tagName?: string;
    };
```
`kind: 'user'` — direct chat turn. `kind: 'signal'` — structured event (webhooks, schedules, multi-user surfaces). Signal fields: `type` (caller-defined, non-empty); `body` (plain string; JSON-stringify structured payloads yourself); `attributes` (string metadata into model context); `tagName` (overrides the XML tag name; server rejects non-XML-name values).

```ts
interface DeliveredAttachment {
  type: 'image';
  data: string;        // base64; server rejects > 14 MiB of characters
  mimeType: string;
  filename?: string;
}
```
Images are the only supported attachment type.

```ts
interface AgentSendResult {   // all fields server-provided
  streamUrl: string;
  offset: string;
  submissionId: string;
  uid: string;
}
```
- `streamUrl` — fully resolved Durable Streams URL for the conversation's events.
- `offset` — opaque stream offset at admission; reading `streamUrl` from it yields exactly this prompt's events.
- `submissionId` — correlates the prompt with its messages and its settlement.
- `uid` — the contacted instance's uid (minted on create, echoed on continue); pass back as the `uid` option to reach the same incarnation.

#### `read()`
Composed one-shot round trip: `wait()` then one `history()` read for the reply. Target is the admission or a bare submission id (the **re-attach** path: follows from the stream origin, so any process holding the id can read the reply later; an already-settled submission resolves immediately).

```ts
read(target: AgentSendResult | string, options?: AgentReadOptions): Promise<AgentReadResult>;
type AgentReadOptions = AgentWaitOptions;

interface AgentReadResult {
  text: string;
  data: Record<string, unknown[]>;
  metadata?: Record<string, unknown>;
  submissionId: string;
  uid?: string;
}
```
- Rejects `FlueExecutionError` when the submission settles failed/aborted; the reply is fetched only after a completed settlement.
- Reply fields are `readSubmissionReply()`'s projection plus the settled `submissionId`; `uid` carries over when the admission had one.
- `options` are `AgentWaitOptions`.

#### `wait()`
Awaits one submission's settlement by following `admission.streamUrl` from `admission.offset` (through the client's `fetch` and headers). Settlement chunks for other submissions are ignored. The wait is an observer, not a driver — if the waiting process disappears, the submission still settles; recover with `wait()` again or `history()`/`observe()`.

```ts
wait(admission: AgentSendResult, options?: AgentWaitOptions): Promise<void>;

interface AgentWaitOptions {
  signal?: AbortSignal;
  backoffOptions?: BackoffOptions;   // from @durable-streams/client, re-exported
  onEvent?: (event: ConversationStreamChunk) => void | Promise<void>;
}
```
- Resolves `void` on `completed` settlement.
- Rejects `FlueExecutionError` on `failed`/`aborted` (its `error` carries the serialized failure when recorded); on `failure: 'terminal_event_missing'` when the stream ends without this submission's settlement; and with the signal's reason when `options.signal` aborts (`DOMException` `AbortError` when no reason).
- No reply returned — settlement chunks carry only the outcome.
- `signal` — cancels the wait and its stream connection; work keeps running (that's `abort()`).
- `onEvent` — invoked and awaited per chunk while waiting; suited to script progress output, prefer `observe()` for maintained UI. `ConversationStreamChunk` is exported but not stable application API.

#### `abort()`
`POST <url>/abort`. Aborts all in-flight and queued durable work; resolves once the intent is recorded; work settles `aborted` asynchronously (see via `wait()` → `failure: 'aborted'`, `observe()`, or `history()`). Already-settled work is unaffected.

```ts
abort(options?: { signal?: AbortSignal }): Promise<AgentAbortResult>;
interface AgentAbortResult { aborted: boolean; }
```
`aborted` — `true` when there was in-flight/queued work now being aborted; `false` when the conversation was idle.

#### `history()`
`GET <url>?view=history`. One materialized point-in-time snapshot, no live updates. Missing conversation → `404 FlueApiError`. Before returning, the SDK resolves a ready-to-use `url` onto every durably recorded `file` part.

```ts
history(options?: FlueConversationHistoryOptions): Promise<FlueConversationSnapshot>;
interface FlueConversationHistoryOptions { signal?: AbortSignal; }

interface FlueConversationSnapshot {
  v: 1;
  conversationId: string;
  offset: string;
  messages: FlueConversationMessage[];
  settlements: FlueConversationSettlement[];
}
```
- `v` — snapshot format version. `offset` — opaque checkpoint; pass back only through Flue's own observation machinery. `messages` — transcript in order. `settlements` — terminal outcomes of tracked submissions.

```ts
interface FlueConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  purpose: 'user' | 'assistant' | 'dispatch' | 'advisory';
  display: 'visible' | 'hidden' | 'diagnostic';
  submissionId?: string;
  turnId?: string;
  signal?: { tagName?: string; attributes?: Record<string, string> };
  settlement?: { outcome: 'failed' | 'aborted' };
  parts: FlueConversationPart[];
  metadata?: Record<string, unknown>;
}
```
- `id` — stable identity; for an assistant response, the first step's message id.
- `role` — coarse render lane; `system` covers every non-chat, non-answer message. `purpose` — stable semantic classification; may widen. `display` — how a transcript UI should treat it.
- `submissionId` — on messages produced by a tracked submission. `turnId` — per-turn grouping shared by messages in one model round-trip.
- `signal` — typed detail for messages projected from an internal runtime signal; only on system-role messages.
- `settlement` — marker only on the terminal advisory for failed/aborted settlements; completed submissions get none.
- `metadata` — entirely agent-authored (`useResponseStart`/`useResponseFinish` hooks, deep-merged in call order); the runtime stamps nothing.

```ts
type FlueConversationPart =
  | { type: 'text'; text: string; state: 'streaming' | 'done' }
  | { type: 'reasoning'; text: string; state: 'streaming' | 'done' }
  | { type: `data-${string}`; data: unknown }
  | {
      type: 'file';
      mediaType: string;
      id?: string;
      size?: number;
      url?: string;
      filename?: string;
    }
  | ({ type: 'dynamic-tool'; toolName: string; toolCallId: string } & (
      | { state: 'input-available'; input: unknown }
      | { state: 'output-available'; input: unknown; output: unknown; durationMs?: number }
      | { state: 'output-error'; input: unknown; errorText: string; durationMs?: number }
    ));
```
- `text`/`reasoning` — streamed model output; `state` `'streaming'` while deltas arrive, `'done'` once closed.
- `data-<name>` — named client-facing data part from `useDataWriter`; name is identity, later writes update the part in place.
- `file` — one attachment. `id` present once durably recorded (absent on local optimistic echo). `url` ready as `<img>`/`<a>` source (filled for recorded; `data:` URL preview on echo; absent when bytes not resolvable). `size` bytes when known.
- `dynamic-tool` — one tool call keyed by `toolCallId`; `durationMs` present once the outcome is known.

```ts
interface FlueConversationSettlement {
  submissionId: string;
  outcome: 'completed' | 'failed' | 'aborted';
  error?: unknown;
}
```
`error` carries the serialized failure detail when the server recorded one.

#### `readSubmissionReply()`
Pure function (no I/O), extracts one submission's reply from a materialized conversation — a `history()` snapshot or `observe()` state. It is the projection behind `read()`. The reply is the final assistant message stamped with `submissionId`; a submission that joined a busy response coalesces into the host's response, so prefer this over `messages.at(-1)`.

```ts
function readSubmissionReply(
  conversation: { messages: FlueConversationMessage[] },
  submissionId: string,
): AgentSubmissionReply;

interface AgentSubmissionReply {
  text: string;
  data: Record<string, unknown[]>;
  metadata?: Record<string, unknown>;
}
```
- `text` — reply text parts joined with blank lines; `''` when none. `data` — named data parts keyed by name, each in emit order. `metadata` — agent-authored response metadata, when present.

#### `observe()`
Maintains the materialized conversation across history catch-up and live updates. Returns synchronously with no network activity; starts on the first `subscribe()`. On start: one history snapshot published, then the updates stream from the snapshot's offset, reducing each chunk into `FlueConversationState`.

```ts
observe(options?: AgentConversationObserveOptions): AgentConversationObservation;

interface AgentConversationObserveOptions {
  live?: ConversationLiveMode;
  signal?: AbortSignal;
  backoffOptions?: BackoffOptions;
}

type ConversationLiveMode = 'long-poll' | 'sse';
```
- `live` — live update mode; defaults to `'long-poll'`. `long-poll` = offset-resumed polling; `sse` = long-lived stream, lower-latency token-by-token updates. Both safe under redelivery.
- `signal` — closes the observation when aborted. `backoffOptions` — per-connection-attempt retry beneath the observation's own rehydrate loop.

Failure handling:
- Stream failure / unexpected end → phase `connecting` (with error), retry with exponential backoff (1 s doubling, capped 30 s), rehydrating a fresh snapshot rather than resuming incrementally. Attempt counter resets on every applied chunk and successful hydration.
- HTTP 400/401/403 → fatal, phase `error`, no auto retry; `refresh()` tries again.
- 404 on history read → phase `absent`; no polling — call `refresh()`.
- Signal abort or `close()` → terminal phase `closed`.

At-least-once safe: every chunk carries a monotonic position; chunks at or below the last applied position are dropped, so a replayed batch never double-applies. `getSnapshot`/`subscribe` match `useSyncExternalStore`; each published update is a new snapshot object identity.

```ts
interface AgentConversationObservation {
  getSnapshot(): AgentConversationObservationSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): void;
  close(reason?: unknown): void;
}

interface AgentConversationObservationSnapshot {
  conversation: FlueConversationState | undefined;
  offset: string | undefined;
  phase: AgentConversationObservationPhase;
  error: Error | undefined;
}

type AgentConversationObservationPhase =
  'loading' | 'connecting' | 'live' | 'absent' | 'error' | 'closed';
```
- `getSnapshot()` — current snapshot; a new object per published update.
- `subscribe(listener)` — first call starts the observation; returns unsubscribe. Unsubscribing does not stop the stream — only `close()` or the signal does.
- `refresh()` — drops the connection and rehydrates from a fresh history snapshot; re-check an absent conversation or retry a fatal error. No-op once closed.
- `close(reason)` — terminal; publishes phase `closed`; reason normalized to an `Error` on the snapshot's `error`.
- Phases: `loading` (first hydration in flight, no state); `connecting` (state may be present; (re)establishing the live connection); `live` (following live updates); `absent` (history returned 404); `error` (fatal 400/401/403); `closed` (terminal).
- `conversation` — undefined before first hydration and when absent. `offset` — opaque checkpoint the state corresponds to. `error` — most recent connection failure, fatal failure, or normalized `close(reason)`.

```ts
interface FlueConversationState {
  conversationId: string;
  messages: FlueConversationMessage[];
  settlements: FlueConversationSettlement[];
}
```
`FlueConversationSnapshot` without the `v`/`offset` envelope (offset lives on the observation snapshot).

#### `attachmentUrl()`
```ts
attachmentUrl(attachmentId: string): string;
```
Absolute URL for one `file` part's bytes — `<conversation url>/attachments/<attachmentId>`, id URL-encoded — suitable as `<img>`/`<a>` source. `GET` only; 404 for unknown id. No request made, no auth attached (the caller's request must satisfy route middleware). Rarely needed directly — `history()`/`observe()` already resolve `url` on recorded `file` parts.

### Events — two vocabularies
- **Materialized state**: `FlueConversationState`, `FlueConversationSnapshot` — complete renderable conversations; what `observe()` maintains and `history()` returns; the level application code should consume.
- **Incremental protocol**: `ConversationStreamChunk` — the `updates`-view chunk union, documented on the Streaming Protocol reference; delivered raw by `wait()`'s `onEvent`; not stable application API.
- The runtime's `FlueEvent` activity union is NOT part of the SDK.

Exported types: `FlueConversationSnapshot`, `FlueConversationState`, `FlueConversationMessage`, `FlueConversationPart`, `FlueConversationSettlement`, `ConversationStreamChunk`, `PromptUsage` (aggregated token/cost usage on settlements; shape matches the runtime export, pinned by wire-conformance test).

#### `FlueEventStream`
```ts
interface FlueEventStream<T = ConversationStreamChunk> extends AsyncIterable<T> {
  cancel(reason?: unknown): void;
  readonly offset: string;
}
```
Async iterable of events over a Durable Streams connection with automatic reconnection, offset-based replay, live tailing. Consume with `for await...of`; breaking out cleans up the connection.

- `cancel(reason?)` — cancels and aborts the connection; iteration then ends `done: true`, not throwing.
- `offset` — resume checkpoint; advances to a batch's next-offset only once every event in the batch has been yielded (at-least-once).
- Each streamed value passes a caller-supplied validator; a throwing validator is terminal (connection cancelled, later `next()` rethrows). The SDK validates against the materialized-conversation protocol (`ConversationStreamError`, `name: 'ConversationStreamError'`, not exported).

```ts
interface FlueStreamOptions {
  offset?: string;
  live?: LiveMode;              // boolean | 'long-poll' | 'sse', re-exported
  signal?: AbortSignal;
  backoffOptions?: BackoffOptions;
}
```
- `offset` — starting offset; defaults to `'-1'` (full history).
- `live` — default `true` (long-poll); `false` reads to the current end and completes.
- `signal` — aborts; iteration ends without throwing.
- `backoffOptions` — `initialDelay`, `maxDelay`, `multiplier`, callbacks, per `@durable-streams/client`.

#### Offsets and redelivery
Offsets are opaque string checkpoints surfaced on `FlueConversationSnapshot`, `AgentSendResult`, `AgentConversationObservationSnapshot`, `FlueEventStream`. Never parse or do arithmetic; compare for equality if you must. Chunk `position` values are not offsets. Delivery is **at-least-once**: a mid-batch drop reconnects from the pre-batch offset and replays the in-flight batch.

- `observe()` dedupes by chunk `position` and rehydrates a fresh snapshot on reconnect.
- `wait()` watches only its submission's terminal `submission-settled` chunk (idempotent); its `onEvent` receives the raw stream — the same chunk can appear more than once after a reconnect, and it sees every chunk from the admission offset, not only the awaited submission's. Dedupe by `position` if it matters.
- Both `'long-poll'` and `'sse'` carry the same chunks with the same guarantees.

### Errors
Two SDK-owned error classes plus four re-exported stream error classes from `@durable-streams/client`. Every class sets `name` to its class name; discriminate with `instanceof`; message strings are not API.

```ts
class FlueApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly ref: string | undefined;
  constructor(status: number, body: unknown, headerRef?: string);
}
```
Rejection of every SDK JSON request on non-2xx (`send()`, `abort()`, `history()`). Exactly one fetch per request, no retries.

- `status` — HTTP status. `body` — parsed JSON body, else raw text, else `''` when no body; deliberately `unknown`. `ref` — server error correlation ref (`err_…`) from the envelope's `error.ref` (fallback: `flue-error-ref` response header); present on 500-class server-logged failures.
- `message` is composed from status, envelope `type`/`message`, and ref; match on `status`/`body`, not the string.
- `wait()` never produces it (stream transport failures are stream errors); `observe()` never throws — its internal history `FlueApiError`s land on the observation snapshot.

#### HTTP error envelope
Every Flue-runtime error response is `{ "error": ... }`:
```ts
{
  type: string;
  message: string;
  details: string;
  dev?: string;
  meta?: Record<string, unknown>;
}
```
- `type` — stable machine-readable id (snake_case, e.g. `agent_instance_not_found`); the field to branch on.
- `message` — one-sentence, caller-safe. `details` — longer caller-safe, always present (possibly empty).
- `dev` — developer guidance; only in local dev mode when there is dev-only guidance; absence is not a prod signal. `meta` — optional structured data.
- `body` stays `unknown` because non-Flue infrastructure can answer too; check the shape first.
- Two `uid`-conditioned rejections: `404 agent_instance_not_found` (uid-conditioned send named a missing/mismatched instance; nothing delivered; the two cases are deliberately indistinguishable) and `409 agent_instance_exists` (create-only send named an existing instance; `meta.uid` hands back the existing uid).

#### `FlueExecutionError`
```ts
type FlueExecutionTarget = 'agent_submission';
type FlueExecutionFailure = 'failed' | 'aborted' | 'terminal_event_missing';

class FlueExecutionError extends Error {
  readonly target: FlueExecutionTarget;
  readonly targetId: string;
  readonly failure: FlueExecutionFailure;
  readonly error: unknown;
  constructor(options: {
    target: FlueExecutionTarget;
    targetId: string;
    failure: FlueExecutionFailure;
    error?: unknown;
  });
}
```
Rejection of `wait()` (and `read()`): admitted and executed, but settled other than `completed`. A `FlueApiError` means the request never got in; a `FlueExecutionError` means the agent ran and didn't finish.

- `target` — single member today: `'agent_submission'`. `targetId` — the awaited submission's `submissionId`. `failure` — `'failed'`, `'aborted'` (e.g. after `abort()`), or `'terminal_event_missing'` (stream ended without a terminal settlement event).
- `error` — the settlement's error payload when carried; `undefined` for `terminal_event_missing`. Runtime-serialized errors follow:
```ts
{
  name?: string;
  message: string;
  type?: string;
  details?: string;
  dev?: string;
  meta?: Record<string, unknown>;
}
```
`type`/`details`/`meta` present for typed runtime errors; plain errors serialize as `name` and `message` only.

- `abort()`-triggered server-side abortion → `FlueExecutionError` (`failure: 'aborted'`); the caller's own `AbortSignal` → the signal's reason, not a `FlueExecutionError`.
- A protocol mismatch on the wire raises an internal `ConversationStreamError` (not exported): `observe()` recovers by rehydrating; from `wait()` it propagates as a rejection.

#### Stream errors (re-exported from `@durable-streams/client`)
Shapes are owned by that package and track its releases.

```ts
class DurableStreamError extends Error {
  code:
    | 'NOT_FOUND' | 'CONFLICT_SEQ' | 'CONFLICT_EXISTS' | 'BAD_REQUEST'
    | 'BUSY' | 'SSE_NOT_SUPPORTED' | 'UNAUTHORIZED' | 'FORBIDDEN'
    | 'RATE_LIMITED' | 'ALREADY_CONSUMED' | 'ALREADY_CLOSED'
    | 'PARSE_ERROR' | 'STREAM_CLOSED' | 'UNKNOWN';
  status?: number;
  details?: unknown;
}
```
Protocol-level stream failure (malformed response, unsupported SSE upgrade, mapped HTTP status). The `DurableStreamErrorCode` type alias itself is not re-exported.

```ts
class StreamClosedError extends DurableStreamError {
  readonly code = 'STREAM_CLOSED';
  readonly status = 409;
  readonly streamClosed = true;
  readonly finalOffset?: string;
}
```
Operation against an already-closed stream; `finalOffset` when the response provided one.

```ts
class FetchError extends Error {
  status: number;
  text?: string;
  json?: object;
  headers: Record<string, string>;
  url: string;
}
```
Stream HTTP failure without protocol-level classification. The stream layer retries transient failures (429, 503, all 5xx, network errors) with exponential backoff — by default indefinitely (bound via `backoffOptions`), so with defaults a `FetchError` surfaces for non-retryable 4xx other than 429.

```ts
class FetchBackoffAbortError extends Error {}
```
A stream request abandoned because its signal aborted during retry backoff. No extra fields. Most caller-initiated aborts don't surface it (iteration ends quietly; `wait()` rejects with the signal's reason); can appear when the stream layer's abort races its retry loop.

#### Errors in `observe()`
Never throws or rejects; failures surface on the snapshot (`phase`/`error`):
- 404 from initial history → `phase: 'absent'`, no error.
- 400/401/403 (any error with a numeric `status`, e.g. `FlueApiError`, `FetchError`) → fatal `phase: 'error'`, no retry.
- Everything else (network, 5xx, unexpected end) → rehydrate with exponential delay (1 s doubling, capped 30 s), `phase: 'connecting'` with the pending error.
- `close()`/signal → `phase: 'closed'`.

#### Aborts are not SDK errors
- `send()`, `abort()`, `history()` reject with whatever fetch throws for an aborted request (`DOMException` named `AbortError` under standard fetch).
- `wait()` rejects with `signal.reason`, or `DOMException` `AbortError` when no reason.
- `FlueEventStream` iteration doesn't throw on cancellation — ends `done: true`.
- Check `error.name === 'AbortError'` (or your own `signal.reason`) before treating a rejection as a failure.

#### Construction errors
`createFlueClient()` throws synchronously with native errors, not SDK classes:
- Relative `url` outside a browser → `TypeError: relative url requires a browser; pass an absolute URL`.
- Non-valid `url` → native `TypeError` from the `URL` constructor.
- No network activity at construction; everything else fails at call time through the classes above.

## React (`@flue/react`)

- `useFlueAgent({ url })` observes one conversation → live React state; `sendMessage()` optimistic (resolves on admission, stream reconciles the durable copy).
- No provider setup. Address = mount URL + conversation id. Agent must be mounted in `app.ts`.
- `status` distinguishes connection/submission/streaming/error. `historyReady` true once durable history loads as coherent snapshot.
- Messages are `FlueConversationMessage` with parts: `text`, `reasoning`, `dynamic-tool` (validated structured output for custom tool UI), `file` (durable parts carry ready `url`; optimistic uploads have `data:` preview). NOT AI SDK types.
- Auth/custom fetch: create your own `createFlueClient(...)` (memoized) and pass `{ client }`. Hook doesn't take ownership — share the instance for programmatic needs.
- SSR: hook returns empty idle state, no connections, connects after hydration.
- Live updates default SSE, fallback Durable Streams long-poll (`live: 'long-poll'`). For one-shot reads use `history()` directly.
- `refresh()` re-runs catch-up for out-of-band conversations (wakeup/queue/webhook).

## Cloudflare ADLC — the bigger picture

Blog: "The Agent Development Lifecycle" (Aug 2026). AI made implementation (the slowest SDLC step) cheapest/fastest, overwhelming every other SDLC step. Answer: empower agents across the WHOLE SDLC, not just codegen.

- **SDLC = for software teams; ADLC = for software factories.** Software factory = agent-driven systems that take input (bug report, error, feature idea) and autonomously build/improve/deploy/manage software. Goal: shift human time to inspiration/taste/judgment.
- For agents to drive, every manual step must be: **programmatic** (APIs, no ClickOps), **horizontally scalable** (per-agent preview matching prod), **reproducible**, **real-time push-based** (events trigger agents, not dashboards), **atomic** (independently testable/releasable/reversible), **permissioned** (escalation paths — you'd never give an agent prod SSH, but it needs a way to get more rights), **self-improving** (learn from experience like a human junior).
- Trust analogy: self-driving cars needed purpose-built sensors (lidar, remote takeover) to go 80% → 99%+ safe. Same for software factories — GitHub Actions YAML isn't enough.
- **Workflows are the orchestration primitive**: chain steps, retry, persist state for minutes→weeks; dynamically defined; can spawn agents/containers/browsers; `step.do` for durable steps. Example: nightly review Workflow collecting findings → `init(Reviewer, { id })` → dispatch → read review. Pattern shown in `@cloudflare/ci`.
- **Cloudflare primitives per SDLC stage**:
  - Plan/Design/Implement: Vite/Rolldown/Oxc toolchain, local dev parity, Local Explorer/Traces, remote bindings (run local code w/ real prod resources), Preview URLs per PR.
  - Test: Browser Run (programmable headless browsers), Vitest in Workers runtime.
  - Deploy: Flagship (feature flags per change), Gradual Deployments (percentage rollouts).
  - Maintain/Retire: Workers Logs (agents tail/query live logs), Agent Traces (capture sessions to improve), Cloudflare MCP Server + Dynamic Workers, Analytics Engine (high-cardinality usage analytics).
- Takeaway: the primitives exist — build your machine-that-builds-the-machine on Cloudflare, starting with `@cloudflare/ci` and Flue agents, and make as much of the SDLC autonomous as you can.


## Subagents

A **subagent** is a named delegate an agent hands a focused task to: it works in its own fresh context with its own instructions/capabilities, and only its final answer returns to the parent's conversation.

### Declaring
- `useSubagent()`; three required fields: `name`, `description`, `agent` (an ordinary agent function returning the delegate's instructions; can compose hooks). `name` + `description` = catalog identity — the description is the line the parent's model reads when deciding whether to delegate (write it like a tool description).

```ts
'use agent';
import { useModel, useSubagent } from '@flue/runtime';

function Summarizer() { return 'You summarize support cases in three sentences.'; }
export function CaseAgent() {
  useModel('anthropic/claude-sonnet-4-6');
  useSubagent({ name: 'summarizer', description: 'Summarizes one support case.', agent: Summarizer });
  return 'Investigate the case. Delegate the summary to the `summarizer` subagent.';
}
```

- Delegate functions are **not** exported: no `useModel()`, no conversation id, no HTTP surface. Keep them unexported inside `'use agent'` modules (the build registers every exported capitalized function as a top-level agent), or define them in ordinary modules. Declarable conditionally (like tools/skills); declaring two delegates with the same name in one render throws.

### How delegation works
- Model-driven. Every agent's tool set includes a framework-owned `task` tool; delegates are cataloged by name+description in an "Available Agents" section of the system prompt. The model calls `task` with the delegate's name and a prompt.
- Flow: runtime renders the delegate's `agent` function fresh at delegation time in its own frame → child runs as a detached session in the parent's environment (own context window, to completion) → only the child's final message returns as the `task` tool's result. Nothing else (reasoning, tool calls, file reads) enters the parent's conversation.
- `task` is always present, but its `agent` parameter resolves only against declared delegates; optional `cwd` points the child elsewhere; images forward by attachment id.
- The prompt is the entire briefing (the child never sees parent history); tasks parallelize — tool calls in one batch run concurrently, so five checks become five concurrent child sessions.
- Nested `useSubagent()` allowed; delegation depth capped at **four levels**. Child sessions write durable records, so an interrupted task resumes (Delegated tasks in Durability). A harness tool's `harness.prompt(...)` conversation can also delegate to declared subagents.

### What a subagent inherits
- Inherits the parent's **environment**: sandbox + harness tools (read, write, bash, …); workspace context (`AGENTS.md`, workspace skills); parent's model and reasoning effort (unless overridden).
- Inherits **nothing** about the conversation: not history, instructions, tools, skills, subagents, persistent state, or initial data. Parent and child share a sandbox, so files are a natural hand-off surface (delegate writes `report.md`, parent reads it after the task returns).
- Inside a delegate render, `useTool()`, `useSkill()`, `useInstruction()`, custom hooks, and nested `useSubagent()` compose normally. Instance-scoped hooks **throw**: `usePersistentState()`, `useSandbox()`, `useModel()` (model comes from the definition), and the client-facing hooks (`useDataWriter()`, event hooks, `useDispatchMessage()`).
- Two override fields: `model` (model specifier) and `thinkingLevel` (reasoning effort) — each inherits from the parent when omitted. Routing a delegate to a cheaper model (e.g. `model: 'anthropic/claude-haiku-4-5'`) is a common pattern.

### The general-purpose delegate
- `GeneralSubagent` — ready-made blank delegate mounting under the framework-reserved name `flue-general`. Its agent function is empty: the child gets only the shared environment (sandbox tools, workspace context, parent's model), so prompts to it must be complete briefings. Opt-in: delegation resolves only against declared subagents.

### Sharing across agents
- `defineSubagent({ name, description, agent })` — like `defineTool(...)`/`defineSkill(...)`: a typing helper that validates at module load (not first render) and returns the definition frozen. Mount from any agent; per-mount overrides spread cleanly: `useSubagent({ ...issueClassifier, model: 'anthropic/claude-haiku-4-5' })`.

### When to use
- Exploratory work that floods the parent's context but yields a short answer; one phase needing different instructions/tools/skills; independent parallel work; work that should run on a different model or reasoning effort.
- vs. a tool (bounded deterministic function your code executes) and a skill (adds instructions to the *current* agent). A subagent is not a second registered agent — no conversation id, persistent state, or address; to message an agent over time, register a real agent and `dispatch()` to it.

## Database (db.ts)

Flue durably stores agent conversations in a database configured by one file, `db.ts`. A **Node.js** concern — on Cloudflare every conversation is a Durable Object with built-in SQLite (nothing to configure; a `db.ts` is rejected at build time).

### What Flue stores
- Runtime durable state only, not business data:
  - **Canonical conversations** — one append-only stream per conversation (user messages, assistant output, tool calls/results, compaction, recovery facts); the single source of truth for later turns, reconnecting clients, crash recovery.
  - **Accepted submissions** — prompts / `dispatch(...)` inputs recorded durably *before* processing, with claims and leases tracking which process owns the work.
  - **Persisted state** — every `usePersistentState` write recorded in the conversation's stream.
- Attachment payloads (images, binary) stored alongside as immutable records the stream references. Does **not** store: sandbox files/installed deps, external API side effects, provider credentials, or your application's data.

### The db.ts entry module
- Create `db.ts` in the source directory; default-export a persistence adapter:

```ts
import { sqlite } from '@flue/runtime/node';
export default sqlite('./data/flue.db');
```

- Discovered by convention — `vite dev`, `vite build`, `flue run` all resolve it from the source root (`.flue/`, `src/`, or the project root); other location → set the `db` path in your config file. Ordinary TypeScript: adapters can read env connection strings and build a driver pool. Flue calls `migrate()` once at boot to create/verify tables, then awaits `connect()` — a misconfigured database fails at startup. Standalone `start()` scripts skip the build and don't pick up `db.ts` — pass the adapter via the `db` option instead.

### The in-memory default
- Without `db.ts`: in-memory SQLite — everything works but **a restart loses everything**. Dev commands soften it: `vite dev` → cache file `node_modules/.cache/flue/dev.db` (history survives code reloads, resets on cold-start); `flue run` → `node_modules/.cache/flue/run.db` (never reset, so `--id` continues conversations); `vite build` → in-memory (process lifetime). With a `db.ts`, all three use your adapter.

### The built-in `sqlite()` adapter
- Ships with the runtime, no extra dependencies — runs on Node's built-in `node:sqlite`. Creates the file (and missing parent dirs) on first boot, opens in WAL mode. No argument or `':memory:'` = the in-memory default. File-backed covers a single host: survives restarts/redeploys on the same machine, not host loss — for that, or many replicas, use an external database.

### Ecosystem adapters
- Blueprints (a Markdown implementation guide, not a package installer); blueprint name = backend's lowercase name: `flue add database postgres`.
- Catalog: Postgres `@flue/postgres`, Supabase `@flue/postgres`, libSQL `@flue/libsql`, Turso `@flue/libsql`, MySQL `@flue/mysql`, MongoDB `@flue/mongodb`, Redis `@flue/redis`, Valkey `@flue/redis`.
- **Bring-your-own-driver**: the adapter never picks/configures a driver — you wrap your configured driver in `query`, `transaction`, and `close` functions. Postgres shape (with `Pool` from `pg`, `process.env.DATABASE_URL`): `postgres({ query: async (text, params) => (await pool.query(text, params)).rows, transaction: async (fn) => { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await fn({ query: async (text, params) => (await client.query(text, params)).rows }); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }, close: () => pool.end() })`.
- No hand migrations: `migrate()` provisions tables idempotently, reuses on restart, stamps a format version — a DB written by an incompatible Flue version refuses to start.
- A shared database does **not** enable active-active: each conversation still needs exactly one live Node owner at a time (see Durability).

### Writing a custom adapter
- An adapter is an object with `connect()` (returning the three stores: submissions, conversation streams, attachments) plus optional `migrate()` and `close()`; types in `@flue/runtime/adapter` — `export default { migrate() {}, connect() { return { submissionStore, conversationStreamStore, attachmentStore }; }, close() {} } satisfies PersistenceAdapter`.
- Strict atomicity/ordering requirements (idempotent admission, fenced producer claims, append-only streams) — the Data Persistence API is the spec; run the contract test suites from `@flue/runtime/test-utils`.

### Choosing a database
- Local development → the defaults. Single-host Node deployment → file-backed `sqlite()`. Host-loss survival / many replicas → an ecosystem adapter with one live owner routed per conversation. Cloudflare → nothing to configure. Backend not in catalog → a custom `PersistenceAdapter`.

## Workflows

A workflow is any script or program that runs an agent — the patterns for scripted automation outside the deployed "chatbot" experience.

### Choosing an approach
| Approach | When to use it |
| --- | --- |
| `flue run` | Initialize + prompt a local agent from the terminal. Best for CI. |
| The Flue JS API | Initialize + control a local agent from Node.js (scripts, cron jobs). |
| The Flue Agent SDK | Initialize + control a hosted agent over HTTP (production agents). |
| Durable Workflows | Hosted agent from a hosted runtime, with durability (multi-step orchestration). |

Not mutually exclusive: a durable workflow uses the same `start()`/`init()` API as a standalone script; a CI job wraps the same `flue run`.

### flue run
- Loads the agent module in-process, submits one message, prints the final reply to stdout, exits with a success/failure code. Everything except the reply streams to stderr; `--json` swaps the plain reply for a result envelope; `-m` is the `--message` shorthand.

```bash
flue run src/agents/triage.ts --message "Triage issue 17307." --id issue-17307
```

- Conversations persist in the configured database, so reusing an `--id` continues one conversation across runs. CI: `--new` + a deterministic `--id` makes conversation creation exactly-once (a retried job can't double-create). The envelope carries outcome, reply, and conversation id; credentials from the job env, e.g. `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`.

### The Flue JS API
- `start()` (from `@flue/runtime/node`) boots the runtime in your own process — no server, no `app.ts`. `init()` returns a handle; `dispatch()` submits a message and resolves with its durable receipt; `read()` awaits the settled reply: `await using flue = await start({ agents: [Reporter], db: sqlite('./nightly.db') })` → `const reporter = init(Reporter, { id: 'nightly-2026-07-17' })` → `const receipt = await reporter.dispatch('Produce the nightly report.')` → `const reply = await reporter.read(receipt)` → `console.log(reply.text)`.
- A failed or aborted run rejects `read()` with `AgentRunError` — plain `try`/`catch` suffices. The `db` option decides whether conversations outlive the script.

### The Flue Agent SDK
- `createFlueClient` from `@flue/sdk` wraps one conversation URL over HTTP. `send()` resolves at admission with the submission's identifiers; `read()` awaits settlement (throwing `FlueExecutionError` on failure/abort) and also takes a bare submission id, so a process that persisted just the admission can re-attach later. Use `start()` when your script runs the agents; the SDK when they run in a deployment.

### Durable Workflows
- Flue guarantees a durable outcome per individual send (see Durability), but not the script around the sends. A durable workflow is a hosted script whose steps checkpoint results, so it can retry a failed step and resume across restarts. Examples: Cloudflare Workflows, Inngest, Temporal — no special Flue integration; call Flue like any other service.
- Pattern: the dispatch runs in its own step so the receipt (the durable claim ticket) is checkpointed the moment it exists; a second step reads the settled reply. A completed dispatch step never re-runs the send; a crashed read step re-attaches with the same receipt. The split also splits per-step time bounds: a 20-minute step timeout becomes up to 40 minutes end-to-end — checkpoint one deadline and have the read step enforce the remainder.
- Cloudflare: write the `WorkflowEntrypoint` class in the same Worker, call the `init()` handle from `step.do(...)` steps; class exported from `src/cloudflare.ts`, binding in `wrangler.jsonc`. Inngest: send inside a `step.run` (call `init()` in-process, or the Agent SDK as a separate service); Temporal: dispatch and read each live inside an activity.

### Re-attaching after a crash
- `read()` holds no in-memory state: settlement and reply are durable records, so any process can read a submission later, and one that settled while the workflow was down resolves immediately.
- The one crash window is inside the dispatch step: the send was admitted but the receipt wasn't checkpointed. The engine re-runs the step and sends again — the instance's send condition decides:
  - Unconditional send (no `uid`) → the duplicate is delivered and joins the live response at a turn boundary; both submissions settle with the same coalesced reply.
  - Create-only send (`uid: null`) → the duplicate rejects at admission with `AgentInstanceExistsError` — nothing reaches the agent twice; the rejection is the signal to fail the run or fall back.

## Schedules

A schedule delivers agent input at a fixed cadence: a cron trigger fires and your code calls `dispatch(...)`. Flue has no scheduler of its own — each target pairs its cron mechanism with the same dispatch surface.

### How a schedule works
- Three parts: a **trigger** (Node: in-process cron in `app.ts`; Cloudflare: Worker Cron Trigger; managed platforms: the platform's cron hitting your HTTP surface); a **delivery** (`dispatch(agent, { id, message })` — resolves when durably admitted, does not wait for the model); a **conversation** (the `id` you pass names the conversation receiving every fire).
- Dispatch addresses the registered agent function directly — a scheduled agent needs no HTTP mount (Dispatch-only agents). The agent is ordinary; nothing marks it as scheduled. Put application-controlled steps (data sources, reports, APIs) behind a harness tool so they behave identically each fire.

### Scheduling on Node.js
- The server process is long-lived, so an in-process cron library in `app.ts` module scope is the simplest trigger. Flue's example uses [croner](https://www.npmjs.com/package/croner):

```ts
import { dispatch } from '@flue/runtime';
import { Cron } from 'croner';
import { Hono } from 'hono';
import { Reporter } from './agents/reporter.ts';

const app = new Hono();
new Cron(
  '0 9 * * *',
  { timezone: 'America/New_York', protect: true, catch: (error) => console.error('Scheduled dispatch failed', error) },
  async () => {
    await dispatch(Reporter, {
      id: 'daily-summary',
      message: { kind: 'signal', type: 'schedule', body: 'Review recent activity and prepare the daily summary.', attributes: { scheduledAt: new Date().toISOString() } },
    });
  },
);
export default app;
```

- The `Cron` instance is created at module load, so the schedule starts with the server — `node dist/server.mjs` in production, `vite dev` in development; gate construction on an environment variable when dev fires are unwanted. An in-process schedule runs in every replica — gate it to a single replica or move it to a platform scheduler.
- croner: standard five-field cron pattern (optional seconds field), IANA `timezone` option, `protect: true` (skip a fire while the previous callback is running), `catch` for callback errors. Only the `dispatch(...)` call is Flue-specific. Runnable example: `examples/node-schedules`.

### Scheduling on Cloudflare
- The Worker isn't long-lived, so the platform owns the trigger. Declare a Cron Trigger in `wrangler.jsonc`: `{ "triggers": { "crons": ["0 9 * * *"] } }`. Cloudflare evaluates cron expressions in **UTC**; no timezone option.
- The fire arrives as a Worker `scheduled` event; contribute the handler from the default export of `src/cloudflare.ts` (Flue merges it into the generated Worker entry) and call `dispatch(...)` inside, with message `attributes` `{ cron: controller.cron, scheduledAt: new Date(controller.scheduledTime).toISOString() }`.
- `dispatch(...)` in a `scheduled` handler works as in an HTTP route: no mount, bypasses HTTP middleware, durably admits to the agent's Durable Object. One `scheduled` handler per Worker; with several `crons` patterns, `controller.cron` identifies which fired.
- For a schedule belonging to one *existing* conversation (a follow-up timer inside a running DO), use the Agents SDK `schedule()`/`scheduleEvery()` through the per-module `extend()` extension point; those callbacks share the conversation's DO and fire after a running response settles. A Cron Trigger addresses/creates conversations from outside.

### What a fire delivers
- Deliver a structured event as a `kind: 'signal'` message: caller-defined `type`, instruction in `body`, flat string metadata in `attributes`. It renders into the model conversation as an XML-tagged block, e.g. `<signal type="schedule" scheduledAt="2026-07-17T13:00:00.000Z">Review recent activity and prepare the daily summary.</signal>`.
- Hooks and tools read the same delivery in code with `useDelivery()` (a tool can consume `attributes` without relying on the model). Full message shape incl. the `tagName` override: `DeliveredMessage`.

### Choosing the conversation id
- Fixed (`'daily-summary'`) → every fire continues one conversation; the agent sees previous runs and keeps persistent state across them. Per fire (`daily-${isoDate}`) → each fire creates a fresh conversation with bounded context; pair with `initialData` to seed the new instance.

### Awaiting a scheduled run
- `dispatch(...)` is fire-and-forget. For the run's result, use the `init()` handle: `dispatch()` admits and resolves with a receipt, `read()` awaits the settled reply — works in a cron callback and a `scheduled` handler alike. `read()`'s promise is not itself durable: if the process dies mid-await the run still settles, but anything after the `await` is gone — must-not-lose side effects belong inside the agent (a tool call). For crash-surviving orchestration see Workflows. Schedules outside a Flue application: boot the runtime with `start()` and use the same handle.

### External schedulers
- Platform cron services (Fly scheduled Machines, Render cron jobs, Railway cron) trigger the deployed app over HTTP instead of running a second process: `POST /agents/reporter/daily-summary` with `Content-Type: application/json` and `Authorization: Bearer <scheduler-token>`, body `{ "kind": "signal", "type": "schedule", "body": "Review recent activity and prepare the daily summary." }`. The server responds `202` at admission, exactly like `dispatch(...)`.
- Requires the agent to be mounted; mounted agents have no built-in auth — protect the mount with middleware verifying the scheduler's credential.

### One-shot runs from CI
- A scheduler that can run a command drives the same agent with `flue run`: `flue run src/agents/reporter.ts --message "..." --id "daily-$(date +%F)"`. Each invocation compiles the module locally, delivers one `kind: 'user'` message (no signal form), streams activity to stderr, prints the reply to stdout, and exits.

### Operational behavior
- **Missed fires** — an in-process Node scheduler fires only while the server runs: fires during downtime/deploys are skipped and never replayed. Use a platform scheduler, or track the last completed run and catch up at startup. On Cloudflare the platform fires on cadence with no traffic; nothing durable exists until `dispatch(...)` resolves, so keep the handler thin.
- **Overlap** — deliveries to one conversation never run concurrently: inputs process in accepted order and a message arriving mid-response joins at a turn boundary; overlapping fires against a fixed id queue or coalesce (never double-run). Croner's `protect: true` additionally skips a fire while the callback runs. Per-fire ids are independent conversations and do run concurrently.
- **Durability** — `dispatch(...)` resolves at admission. On Node with the in-memory default, admitted work lasts only as long as the process — configure a durable database so a replacement process recovers it. On Cloudflare, admission is durable in the DO and delivery is **at-least-once** — design a scheduled agent's external side effects to be idempotent.

## Channels

A **channel** connects an external provider (Slack, GitHub, Stripe) to your agents: verified HTTP ingress that authenticates each delivery and hands your code the provider's native payload to route into conversations with `dispatch(...)`. Channels are inbound-only; outbound provider calls stay in your application via the provider's own SDK.

### Adding a channel
- Every supported provider ships as a [blueprint](https://flueframework.com/docs/cli/add/): `flue add channel slack`.
- Slack blueprint installs `@flue/slack` (ingress: request verification + HTTP routes) and `@slack/web-api` (Slack's SDK for outbound calls). Result: `src/channels/slack.ts` exporting the configured `channel` and the SDK `client`, plus a mount in `app.ts` and a reply tool bound into the target agent. Slack env: `SLACK_SIGNING_SECRET` (inbound verification), `SLACK_BOT_TOKEN` (outbound).

### The channel module
- A channel module configures the provider's `create*Channel()` factory with a verification secret and one handler per protocol surface. The package verifies each request (signatures against the exact raw bytes, replay windows, handshakes such as Slack's URL verification answered internally) and calls your handler only for authenticated deliveries, passing native payload types alongside the Hono context `c`:

```ts
import { dispatch } from '@flue/runtime';
import { createSlackChannel } from '@flue/slack';
import { Assistant } from '../agents/assistant.ts';

export const channel = createSlackChannel({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  async events({ payload }) {
    if (payload.type !== 'event_callback') return;
    if (payload.event.type !== 'app_mention') return;
    const event = payload.event;
    const thread = { teamId: payload.team_id, channelId: event.channel, threadTs: event.thread_ts ?? event.ts };
    await dispatch(Assistant, {
      id: channel.instanceId(thread),
      idempotencyKey: payload.event_id,
      initialData: { channelId: thread.channelId, threadTs: thread.threadTs, startedBy: event.user },
      message: { kind: 'signal', type: 'slack.app_mention', body: event.text, attributes: { eventId: payload.event_id } },
    });
  },
});
```

- Shared conventions:
  - **Handlers select routes** — `events` → `/events`, `interactions` → `/interactions`, …; omit a handler and its route doesn't exist. Most providers expose a single `webhook` handler at `/webhook`.
  - **Return values become responses** — nothing → empty `200`; a JSON-compatible value → JSON; a `Response` passes through (for surfaces whose protocol reads the ack body).
  - **Acknowledge quickly** — `dispatch(...)` resolves at durable admission; the agent runs asynchronously. Admit and return rather than awaiting agent output.
  - **Deliveries can repeat** — packages are stateless and don't dedupe. Pass the provider's redelivery-stable id as the dispatch `idempotencyKey` (e.g. `idempotencyKey: payload.event_id`); a redelivered event converges on the original submission — same receipt (marked `deduplicated: true`), at most one answer. Reusing a key with a different payload rejects with a 409 `submission_conflict`. Carrying the id in signal `attributes` keeps it visible for tracing.

### Mounting
- A channel serves HTTP only where `app.ts` mounts it. `channel.route()` is a pure, mountable sub-router serving the channel's declared routes relative to the mount: `app.route('/channels/slack', slack.route())` → Slack's Events API endpoint `POST /channels/slack/events`.
- `/channels/<provider>` is a convention, not a requirement — suffixes shift with your mount; the URL you register with the provider is the mount plus the suffix. The dispatch-target agent needs no mount: `'use agent'` registration is all `dispatch(...)` requires.
- Channel routes need no additional auth middleware for provider traffic — verification against the provider's secret is the authentication and happens inside the channel before your handler runs.

### Delivering into a conversation
- **The conversation id** — every delivery to the same `id` lands in the same durable conversation. Conversation-shaped providers (Slack thread, GitHub issue, Teams chat) map one agent conversation per provider destination and expose an `instanceId()` helper deriving a canonical, collision-free id: `channel.instanceId({ teamId, channelId, threadTs })` → `"slack:v1:T0123:C0456:1721760000.123456"`. `parseInstanceId(id)` recovers the destination fields (an escape hatch — prefer `initialData`). The id identifies; it doesn't authorize. Event-feed providers (Stripe, Shopify, Notion, Resend) have no `instanceId()` helper — choose the id from the event yourself.
- **Signals** — deliveries are `kind: 'signal'`, not `kind: 'user'` (a thread/issue is multi-participant; `user` would present every participant as the agent's own user). Fields: `type` (namespaced event name, e.g. `'slack.app_mention'`), `body` (plain string), `attributes` (string-to-string map of structured facts the verified handler attaches). Keep short-lived provider capabilities (interaction tokens, `response_url`) out of the message — signals enter model context and durable history. Full shape: `DeliveredMessage`.
- **Creation data** — `initialData` is recorded once when the dispatch creates the conversation and ignored by later sends; it carries what the conversation *is* (thread, repo, ticket). When the agent declares an `initialData` schema static, it's validated at admission, so a creating dispatch that omits or malforms it fails instead of seeding a broken conversation.

### Reading deliveries in the agent
- `useInitialData()` returns the creation data; `useDelivery()` returns the message currently in front of the model as the same `DeliveredMessage` the channel dispatched. Both give code the same access the model has — thread facts bind a reply tool without the model choosing a destination, and signal `attributes` carry identifiers tools can trust because verified channel code attached them. Example: agent declares `Assistant.initialData = v.object({ channelId: v.string(), threadTs: v.string(), startedBy: v.optional(v.string()) })` (valibot) and binds a `replyInThread(data)` tool via `useTool(replyInThread(data))`.

### Use provider SDKs
- Channels are ingress-only: Flue has no outbound messaging API, no reply routing. Outbound behavior is application code against the provider's own SDK — the blueprint installs one and exports a configured client from the channel module (e.g. `new WebClient(process.env.SLACK_BOT_TOKEN)`). OAuth installation, token storage, rotation are application concerns.
- To let the *model* act on the provider, wrap exactly the actions the app needs as tools, binding the destination in trusted code: `replyInThread(ref: { channelId: string; threadTs: string })` → `defineTool({ name: 'reply_in_slack_thread', description: 'Reply in the Slack thread bound to this conversation.', input: v.object({ text: v.pipe(v.string(), v.minLength(1)) }), async run({ data }) { const result = await client.chat.postMessage({ channel: ref.channelId, thread_ts: ref.threadTs, text: data.text }); return { output: { ts: result.ts ?? null } }; } })`.
- The model selects the reply text; it cannot select the workspace, thread, credential, or Web API method — those are fixed by the factory argument from creation data. Avoid generic provider tools exposing arbitrary destinations/API methods. Because the SDK is the provider's own, everything it documents works without framework support (Slack assistant status/streaming-reply APIs, Octokit, Stripe typed events) from tools, event hooks, or any application code.

### The channel catalog
- Ingress packages are built on Fetch and Web Crypto and run on both the Node and Cloudflare targets. Blueprints (provider → blueprint): Slack `slack`, Discord `discord`, Microsoft Teams `teams`, Google Chat `google-chat`, Telegram `telegram`, WhatsApp `whatsapp`, Facebook Messenger `messenger`, Twilio `twilio`, GitHub `github`, Linear `linear`, Notion `notion`, Intercom `intercom`, Zendesk `zendesk`, Stripe `stripe`, Shopify `shopify`, Resend `resend`, Salesforce Marketing Cloud `salesforce-marketing-cloud`.
- **Providers without a blueprint** — pass a documentation URL and the generic channel blueprint guides the same shape (verified ingress, provider SDK outbound, narrow application-owned tools): `flue add channel https://developers.provider.example/webhooks`.
- Or write one by hand. A channel is an object with declarative routes; `createChannelRouter(routes)` from `@flue/runtime` builds the same mountable sub-router `route()` returns: `export const channel = { routes: [{ method: 'POST', path: '/webhook', handler: webhook }] };` mounted via `app.route('/channels/acme', createChannelRouter(acme.routes))`.
- Verify signatures against the exact unconsumed request body; keep every route suffix a non-empty path beginning with `/`; test valid and invalid signatures plus protocol handshakes. Channels model verified HTTP delivery — long-lived sockets, polling loops, and provider-managed background transports stay in application-owned infrastructure.

## Evals

### What an eval is

- An **eval** = automated test that runs an agent against a live model and asserts observable behavior (reply, tool calls, emitted data). No dedicated eval framework — an eval is a [Vitest] test driving the agent through the same public surfaces every caller uses.
- Unit tests can't cover the model's contribution (instructions, model, tools together); evals run the complete loop and assert the outcome.
- Two properties shape evals: **nondeterministic** (assert the behavioral contract — required tool calls, key facts, structured-data shape — not exact output strings) and **spend real tokens and real time** (own suite, config, credentials, timeouts, run cadence, separate from unit tests).
- Integration: [vitest-evals] layers eval harnesses, judges, and CI reporting.

### Set up an eval suite

- Dedicated Vitest config: `include: ['src/evals/**/*.eval.ts']`, `testTimeout: 60_000` (replaces Vitest's 5-second default, which a single live model turn can exceed).
- Script: `"evals": "vitest run --config vitest.evals.config.ts"`.
- Eval files live under `src/evals/` and are named for the capability/scenario they evaluate (`service-health.eval.ts`, `refund-policy.eval.ts`), not one file per agent.

### Write an eval in-process

- `start()` from `@flue/runtime/node` boots the Flue runtime inside the test process (no server, no build); the `init()` handle sends a message and awaits the settled reply.
- `init(agent)` with no `id` addresses a fresh, uniquely named conversation per case — saved history can't affect other cases. A memory test reuses one handle across several `dispatch(...)`/`read(...)` pairs.
- `reply.text` = final assistant text; `reply.data` carries named `useDataWriter` parts (assert structured results). A failed or aborted run rejects `read()` with `AgentRunError`, failing the test.
- `read()`'s `onEvent` callback receives every conversation chunk as recorded; `tool-input` chunks carry the `toolName` and `input` of each tool call.
- Hooks, durability, and sandboxes behave exactly as in a server — `start()` is the same assembly without an HTTP surface.
- Constraints: one process holds one Flue runtime — call `start()` once per test file and stop it at file end (Vitest's default isolation gives each file its own worker); provider credentials come from the test-process environment; an agent depending on build-resolved imports (e.g. a SKILL.md import) needs the Flue build and should be evaluated over HTTP.

### Evaluate over HTTP

- Drive the mounted agent through its HTTP surface with the Flue Agent SDK — the same boundary a deployed app serves, including route middleware. A fresh conversation is a fresh id appended to the mount URL: `process.env.FLUE_AGENT_URL ?? 'http://127.0.0.1:5173/agents/service-status'`.
- Prompts are fire-and-forget: `send({ message: { kind: 'user', body: ... } })` admits, `wait(admission)` awaits completion, `history()` returns the finished conversation (assistant reply + tool-call parts). When the route is protected, pass `token` or `headers` to `createFlueClient(...)`.
- Choose the surface by what the eval should exercise: in-process (`start()`) exercises the agent itself (instructions, model, hooks, tools) and needs provider credentials in the test env; HTTP (`@flue/sdk`) also exercises `app.ts` routing/middleware and needs a running dev server or deployment. Both are public APIs — the integration point for other eval libraries and hosted platforms such as Braintrust.

### vitest-evals

- Add the integration with a blueprint: `flue add tooling vitest-evals`. It creates the eval configuration/scripts and generates `src/evals/harness.ts` — a harness driving one conversation per case through `@flue/sdk`, converting reply, tool calls, and usage into the normalized `vitest-evals` result.
- Cases are written with `describeEval('...', { harness }, (it) => { it('...', async ({ run }) => { const result = await run(prompt); ... }) })`, binding the harness to a suite and handing each test a `run(...)` function. Assert with `expect(result.output).toContain('operational')` and `toolCalls(result)`.
- `agentUrl` comes from `process.env.FLUE_AGENT_URL ?? 'http://127.0.0.1:5173/agents/service-status'`.

### Judges

- Deterministic assertions cover exact contracts (required/prohibited tools, structured output, stable content). For semantic behavior — factual consistency, tone, policy adherence — `vitest-evals` provides **judges**: scorers that grade a result and fail the case below a threshold. LLM-backed judges run on a _judge harness_, its own model connection configured separately from the agent under evaluation.
- Usage: `await expect(result).toSatisfyJudge(FactualityJudge(), { expected: 'The checkout service is currently operational.', threshold: 0.6 })`.
- Built-ins: `FactualityJudge`, `ToolCallJudge`, `StructuredOutputJudge`. `createJudge(...)` defines custom judges, deterministic or LLM-backed. Prefer deterministic assertions first; add a judge only where the behavior can't be checked exactly.

### Run evals locally and in CI

- Locally: `pnpm run evals` (in-process suites need provider credentials in the environment). HTTP suites additionally need a reachable target — start the app in another terminal or set the URL to a deployment: `FLUE_AGENT_URL=https://preview.example.com/agents/service-status pnpm run evals`.
- CI: an eval suite is an ordinary Vitest run that exits non-zero on failure, so it gates a pipeline; keep it a separate job from unit tests (slower, spends tokens, can fail without a code change) — on merge, on a schedule, or on demand. Credentials from CI secrets; for HTTP, build+start the app in the job or target a preview deployment.
- Reporting: the vitest-evals blueprint adds an `evals:json` script writing a `vitest-results.json` artifact. Inspect with `vitest-evals serve vitest-results.json`, or publish from CI with the `getsentry/vitest-evals` GitHub Action. Reports can contain prompts, outputs, tool arguments/results, and errors — review retention and access requirements before uploading.

## Observability

### Two event surfaces

- **Conversation stream** (product surface): one conversation's durable, render-ready messages, data parts, and settlements, over HTTP via `createFlueClient(...)` `observe()` / `history()` — covered by Routing.
- **Runtime event stream** (operational surface): live activity across every agent in the process — model requests, tool executions, logs, token counts, failures — via `observe()` from `@flue/runtime`. Same name, different shape: the SDK client's `observe()` maintains one conversation's materialized message state; the runtime's `observe()` delivers raw activity events. Telemetry, metering, and error reporting belong here.
- Correlation: a conversation message's `submissionId` matches the runtime events its submission produced.

### Event stream

- `observe((event) => {})` from `@flue/runtime` registers a global subscriber for all agent activity in the process (direct prompts, dispatched work, subagent tasks, harness activity). Register once at startup, at module top level in `app.ts` (or a module `app.ts` imports). Returns an unsubscribe function — telemetry subscribers typically never remove themselves; the return value exists for tests and dynamic wiring.
- Subscriber rules: **stay cheap** (runs synchronously on the emission path — branch on `event.type`, return early, queue async work); **read-only** (each delivery is a detached, frozen observation; never alters what other subscribers or the runtime see); **failures contained** (a throwing subscriber is logged and skipped; returned promises observed for rejection but not awaited).
- Isolate-scoped and live-only: no durable replay, no cross-process aggregation. On Node one process hosts all agents, so one registration sees everything; on Cloudflare each conversation runs in its own Durable Object isolate, so a subscriber from `app.ts` runs per isolate and sees that isolate's activity only. Caveat (shared with `setProvider()`): `flue run` loads only the agent module, never `app.ts` — register in the agent module to also run under the CLI.
- Envelope: every event carries format version `v: 3`, a per-context `eventIndex`, a `timestamp`, plus correlation fields as applicable: `agentName`, `conversationId`, `instanceId`, `submissionId`, `operationId`, `turnId`, `taskId`.
- Event families: `agent_start`, `agent_end`, `idle` (agent loop lifecycle); `submission_settled` (durable submission reached completed/failed/aborted — the reliable terminal signal); `operation_start`, `operation` (prompt, skill, task, shell, compact boundaries, with duration and rolled-up usage); `turn_start`, `turn_request`, `turn`, `turn_messages` (model turns); `message_*`, `text_delta`, `thinking_*` (live message/reasoning progress); `tool_start`, `tool` (tool execution, correlated by `toolCallId`); `task_start`, `task` (subagent delegation, with result, error state, duration); `compaction_start`, `compaction` (context compaction, message counts and usage); `log` (structured logs).
- Deltas are live progress signals, not authoritative message state — the `message_end` event carries the completed message. Nested errors don't necessarily fail the containing work (an agent can recover from a failed turn or tool call), so alert on `submission_settled` outcomes and read nested `isError` events as diagnostic context.
- Live-only extras: `observe()` delivers each event as a `FlueObservation` — the event plus live-only fields such as normalized tool arguments, effective results, and classified `errorInfo` including the throw-site stack — never persisted or replayed. `turn_request` is in-process only: the full model-visible request (provider identity, settings, system prompt, messages, tools), never persisted or served over HTTP.

### Token usage

- Each completed model call emits a `turn` event: `request` summarizes what was sent (provider, requested model, API, settings); `response` carries output, finish reason, and `usage`. Usage fields: `input`, `output` (tokens sent/generated); `cacheRead`, `cacheWrite` (prompt-cache tokens); `totalTokens` (total across components); `cost` (estimated from model catalog rates, per component plus total).
- Per-agent metering: observe `event.type === 'turn'`; `metrics.increment('llm.tokens', usage.totalTokens, { agent: event.agentName, model: event.request.requestedModel, purpose: event.purpose })` where `purpose` is `'agent' | 'compaction' | 'compaction_prefix'`; cost via `metrics.increment('llm.cost', usage.cost.total, { agent: event.agentName })`.
- Roll-ups: `operation` and `compaction` events carry aggregate usage for the work they bound. Sum one level only — `turn` values are the leaves and roll-ups already include them; duration values at different levels overlap the same way and must not be added together.
- Inside the agent, `useResponseFinish()` receives the whole response's aggregate usage — the right place to stamp token counts onto response metadata for your client.

### Providers

- A `turn` event's `response` is normalized — `finishReason` and `error` use Flue's vocabulary regardless of provider — plus allowlisted raw provider metadata: `providerFinishReason` (the provider's exact finish value before normalization, e.g. Workers AI's `tool_calls` behind the normalized `toolUse`) and `gatewayLogId` (the response's own Cloudflare AI Gateway log id, `cf-aig-log-id`, for correlating with the gateway dashboard).
- Both are telemetry only — never affect execution or replay — and present only when the provider records them; the Workers AI provider attaches both today. A diagnostic observer reads them from failed turns (`event.isError`).
- `request.providerId` = registration key from the model specifier; `request.providerName` = semantic provider identity, which differs when a gateway or custom registration fronts the model.
### Tool activity and logs

- Tool execution emits `tool_start` and `tool` events carrying the tool name, `toolCallId`, duration, error state, and result — for model-driven calls and programmatic shell activity. The live observation adds normalized arguments and effective result.
- The tool's `run` context provides a logger; lifecycle hook contexts like `useAgentStart` carry the same `log` interface. Each call emits a `log` event with a level, a message, and your attributes — tool logs additionally stamped with `tool` and `toolCallId`, hook logs with the hook that wrote them. The model never sees log lines; they exist for your application. Forward to a logging backend from an observer.

### Choose an observability provider

- [Sentry]: `flue add tooling sentry` — terminal failures as issues, every log in Sentry Logs, optional AI traces (content off by default).
- [Braintrust]: `flue add tooling braintrust` — LLM tracing: operations as traces with model, tool, task, and compaction spans plus usage.
- [OpenTelemetry]: add `@flue/opentelemetry` to your OTel SDK setup — standards-based GenAI spans, metrics, and logs for any OTel-compatible backend.
- Sentry/Braintrust blueprints generate a source-root module that `app.ts` imports (an event bridge plus provider initialization). Span-producing integrations register through `instrument(...)`, which pairs an observer with an execution interceptor so spans wrap live agent, model, tool, and task execution: `instrument(createOpenTelemetryInstrumentation())`.
- They compose — an error reporter and a tracer subscribe side by side. On Cloudflare each integration exports per isolate and final flushes are best-effort; each tooling page documents target-specific behavior.

### Cloudflare

- No Flue-side wiring needed: each agent response runs as one unit of platform work (admission answers immediately, then the response executes start-to-settlement as a single invocation). Workers Logs attribute tool and hook logs to the response that wrote them; Workers Traces capture one trace per response (model calls and subrequests as spans). Both enabled in `wrangler.jsonc`.
- Agent-shaped spans are built in: each response's trace carries an `invoke_agent` span wrapping the run, a `chat` span per model turn with token usage, and an `execute_tool` span per tool call — the same OpenTelemetry GenAI naming Cloudflare's own agent tracing emits.
- To customize the adapter (content policy, redaction), install it yourself once at `app.ts` module scope, replacing the default: `instrument(createCloudflareTracing({ content: false }))` from `@flue/runtime/cloudflare`. Set `tracing: false` in `flue.config.ts` to drop agent tracing from the build.
- Spans carry the conversation by default (input/output messages, system instructions, tool definitions/arguments/results). Raw error messages and stack traces never ship; failures record only a low-cardinality `error.type`. Options: `content: false` for content-free spans, or a `transform` to redact or drop content in code.
- Platform view and runtime stream are complementary: platform = fleet health, latency, subrequests, reading conversations; runtime events = full-fidelity stream — settlement outcomes, error details, anything a trace attribute can't hold.

### Protect sensitive content

- Runtime events can contain prompts, system instructions, reasoning, tool arguments/results, and error details — and both trace adapters capture conversation content by default. For every exporter leaving Cloudflare, installing an instrumentation with `instrument(...)` is the consent: nothing is emitted by merely deploying, but once that line exists, prompts and tool payloads flow to the backend. Workers Traces is the exception (built into the target; content stays within the account).
- Every adapter takes the same two controls: `content: false` turns capture off entirely; `content: { transform }` is the policy hook — redact, drop by `scope.contentType`, or tighten the byte budget with `truncateContent`.
- Unconditional protections: `turn_request` events never leave the process; image content blocks never carry raw bytes (their `data` is replaced with the `IMAGE_DATA_OMITTED` sentinel). Per-exporter posture: Cloudflare never emits raw error messages or stacks; OpenTelemetry passes exceptions through the same content gate; Sentry keeps model/tool content out of traces unless record flags opt in; Braintrust is content-bearing with a masking hook. Review retention and access controls of whatever receives your traces.

## Durability

### The accepted-work contract

- Every input that reaches an agent — direct HTTP prompt, `dispatch(...)`, an `init()` handle's `dispatch(...)`, a channel delivery, a scheduled trigger — is admitted as a **submission**: the payload is recorded durably _before_ any model work begins. That admission record is what the `202` response and the dispatch receipt attest to.
- Contract: **every accepted submission reaches exactly one durable terminal outcome — `completed`, `failed`, or `aborted` — no matter how many crashes happen in between.** The outcome is written as a `submission_settled` record in the conversation's canonical stream, so anything waiting on the work observes it even across its own reconnects: the SDK's `wait()` resolves/rejects from that record, and an awaited `init().read(...)` resolves with the settled reply or rejects with the settled error.
- Submissions for one conversation form a durable queue processed in admission order: one runs at a time; messages arriving while the agent is busy join the live response at a turn boundary or wait their turn; a queued message is never lost — a delivery missing the live response runs as its own submission. Processing happens in **attempts**: a coordinator claims the submission, runs it, and settles it. An interruption consumes the attempt; recovery claims a new one, up to the retry budget.
- Aborts follow the same discipline: `POST /:id/abort` (or the SDK's `abort()`) records a durable abort intent on every unsettled submission for the conversation; each then settles with the distinct `aborted` outcome through the normal attempt machinery — even when the process running the work is already gone. Work already completed settles `completed`.

### Recovery

- A crash leaves no record of itself; recovery runs when a replacement owner wakes (how is per-target) and works exclusively from durable evidence: canonical conversation records, the submission's admission row, and its attempt bookkeeping.
- Two phases. First **converge** the stream: any partially streamed assistant output the dead attempt persisted is closed out as an aborted entry — unconditionally and idempotently, so no crash shape leaves the conversation mid-stream (the partial output stays preserved in history). Then **classify** what the records prove:
- Durable evidence → recovery action: input never persisted → requeue for a clean first attempt; completed assistant response → settle completed (finished work is never discarded, even past the retry budget); partial response with text/reasoning → tell the model its stream was interrupted and continue from the durable partial; tool turn with unresolved calls → repair the tool batch, then continue the turn loop; transient provider error (rate limit, outage) → retry the turn after backoff under a bounded error budget; context-overflow response → compact the conversation and retry; durable abort intent → settle aborted.
- Tool-batch repair is deliberately conservative: results recorded before the crash are preserved exactly — those calls never run again. An unresolved ordinary call is _not_ re-executed (the runtime can't know which side effects already happened); instead it settles with an explicit unknown-outcome error the model sees and can react to. Two kinds of calls resolve real outcomes instead of markers: `durable: true` tools re-execute with completed steps replaying from records, and in-flight delegated tasks resume from their own transcripts.
- Discipline: **at-least-once execution over exactly-once recording**. Work committed durably — recorded responses, recorded tool results, committed state writes — never re-runs. Interrupted work re-runs on the next attempt, including event-hook callbacks: their durable effects commit atomically and never duplicate, but an external side effect inside one (an email, a page) may rarely happen twice. Guard anything that must not repeat with persistent state or application-level idempotency.
- A recovered conversation always comes to rest where the next message processes normally — an interrupted submission can't wedge the queue. The interruption stays visible in the timeline: the aborted partial, interrupted-tool markers, and (on failed settlement) a terminal advisory signal.

### Retry budget and timeout

- Each interruption consumes one attempt. On exhaustion, or when the submission exceeds its wall-clock timeout, retrying stops: the conversation settles to a rest state, a `submission_interrupted` advisory lands in the timeline, and the submission settles `failed` — waiters reject with the structured error, including which tool calls were left with unknown outcomes.
- Defaults: **10 attempts and one hour per submission**. Override per agent with the `durability` static: `IssueTriage.durability = { maxAttempts: 5, timeoutMs: 7_200_000 }`. The static is applied by the platform while the agent function is not running, so it stays in force after a crash — including a crash in the agent's own render. The timeout is the total wall-clock budget from the first attempt's start; turn-boundary joins and response continuations do not extend it. Full field reference: `DurabilityConfig`.
- The timeout is enforced preemptively, not just between attempts: the coordinator supervises running attempts on its wake cadence and at the deadline fires the attempt's abort signal — work suspended on a signal-aware await (provider call, sandbox command, any tool) unwinds and settles through normal paths; a `run` that ignores its signal is abandoned rather than awaited; an attempt hung below the abandonable layer settles `failed` over the hung fiber after a short grace, its late writes fenced off. A hang delays settlement by at most deadline + grace; it can never strand the submission. Most stalls never reach the deadline: a model stream silent past its idle timeout fails as a transient provider error and the turn retries under the error budget.

### Durable tools and `step.do`

- An ordinary tool call interrupted mid-flight settles with an unknown-outcome error on recovery. For work that must complete — a payment, a provisioning job, a multi-step sync — declare the tool `durable: true`: its `run` receives `step`, every side effect goes through `step.do(name, fn)`, and recovery re-executes the call instead of marking it interrupted.
- `defineTool({ name: 'provision_workspace', description: ..., input: v.object({ customerId: v.string() }), durable: true, async run({ data, step }) { const tenant = await step.do('create-tenant', () => billing.createTenant(data.customerId)); ... } })`.
- Each completed `step.do` durably records its returned value before resolving. On recovery the whole call re-runs, completed steps return their recorded values without executing, and execution continues from the first step that never finished. Step records are operational bookkeeping — the model sees only the tool's final result — keyed to the tool call id, so they carry across attempts of the same call and are scoped to it (a fresh invocation runs every step fresh).
- Boundaries: **steps are exactly-once-recorded, at-least-once-executed** — a crash in the window between a step's function finishing and its record landing re-runs that one step, so steps around external effects should be individually idempotent. And a redeploy can withdraw the contract: if recovery finds the current render no longer declares the tool (or no longer marks it `durable`), the call falls back to the ordinary interrupted-marker path rather than guessing.

### Delegated tasks

- A subagent task runs as a child session with its own durable conversation stream, so a crash mid-task loses none of the child's progress. When recovery repairs a tool batch containing an unresolved `task` call, it doesn't settle with a marker — it reattaches to the child's durable transcript, resumes the child to completion under the same recovery rules, and commits the child's real final result as the parent's tool outcome. Recurses: a child interrupted inside _its_ delegate resumes the grandchild first. Several tasks interrupted in one parallel batch are all resumed before the batch commits.
- A delegate has no durability configuration of its own: resumed child work runs inside the parent's attempt, under the parent's retry budget and timeout.
- Edge cases: a delegate removed by a redeploy → that one call settles with an error outcome and the parent continues (a renamed/removed delegate can't be resumed under any retry); terminal settlement → when a submission exhausts its budget with a task still unresolved, the interrupted marker carries the child's conversation id, so the child's durable transcript remains inspectable.

### Persisted state

- Every `usePersistentState` write is a record in the conversation's canonical stream — state survives restarts for the life of the conversation. Recovery follows from _when_ writes commit: a write becomes durable atomically with the unit of work that made it — a tool write commits with that turn's tool batch, an event-hook write with the hook seam's checkpoint. If recovery settles the batch as interrupted, the write never happened; the re-attempt renders from the last committed state, exactly matching the work the model actually sees as done.
- That atomicity makes persistent state the correct guard for at-least-once callbacks: a `sent` flag set by the same unit of work that sent the email cannot end up `true` while the work it guarded rolled back.

### Recovery by target

- The durable records and recovery decisions are identical on both targets; what differs is who owns a conversation's work and how a replacement owner wakes up.

#### Node.js recovery

- On Node, a coordinator inside your server process owns submission processing. Ownership is lease-based: each running submission carries a short lease the owning process heartbeats while working. Two recovery triggers: **startup reconciliation** (a replacement process scans for interrupted work when it boots and requeues it, then serves immediately while it settles in the background; ordering preserved per conversation — recovered work runs ahead of newly delivered work) and **periodic lease scans** (expired leases reclaimed within seconds, so work stranded by a fast restart doesn't wait for another restart).
- Graceful shutdown aborts active submissions at the turn boundary and waits for them to settle; work that doesn't settle in time is left running with its lease intact and reclaimed by the next startup after expiry.
- Deployment consequences: recovery is only as durable as the database — the in-memory default survives interruptions within the process lifetime but a restart loses everything; cross-restart recovery requires a durable adapter in `db.ts`. And one live owner per conversation — a shared database lets a _replacement_ process recover accepted work but doesn't make two concurrent owners safe; multi-replica deployments must route each conversation to one owner and avoid overlapping owners during replacement.

#### Cloudflare recovery

- On Cloudflare every agent conversation is a Durable Object with its own SQLite storage, so ownership is structural — the platform guarantees one live instance per conversation and there's no lease protocol. Recovery is wake-driven: **wake on start** (whenever the Durable Object starts — after eviction, code deploy, or platform reset — Flue flags any attempt running when the previous instance died and reconciles it before serving new work; the platform's fiber-recovery callback triggers the same path) and a **durable wake schedule** (while unsettled work exists the object keeps a short self-renewing wake scheduled, so an interrupted submission recovers even if no external request arrives; each wake runs a bounded supervision pass — reconcile, enforce deadlines, start work — and re-arms its successor before anything that can fail, so a hung attempt or failed pass delays supervision by at most one wake; attempt execution runs detached from the wake that started it).
- Abort intents, attempt bookkeeping, and settlement records all live in the object's own storage, so an abort requested while the object was evicted is honored on the next wake.

### Deliberately not durable

- **Keep workspace state separate.** The conversation database does not store sandbox files. The virtual sandbox is ephemeral by design — its filesystem is rebuilt fresh each time the runtime initializes the agent for new work, and a recovered attempt re-initializes the environment the same way, so files an interrupted attempt wrote to an ephemeral workspace are gone on resume. Workspace persistence is a separate choice: a durable workspace comes from a sandbox adapter that keys the provider workspace on the agent instance id, so every submission — including a recovery attempt — resolves to the same filesystem. A durable database doesn't make a sandbox durable, and a durable workspace doesn't preserve conversation history. Keep knowledge the agent must not lose in persistent state; keep files that must last in a durable workspace.
- **In-flight local promises.** The promise from an awaited read — `init(...).read(...)` in a script, `client.wait(...)` in an application — is not itself durable. If the awaiting process exits, the accepted work continues under the configured store's recovery behavior; only the local promise is gone. To recover it, persist the `DispatchReceipt` that `dispatch(...)` resolved with (e.g. as a workflow step's durable result), and `read(receipt)` re-attaches from any process — if already settled, it resolves immediately. For standalone scripts using `start()`, the `db` option decides whether accepted work outlives the script at all.
- **Code outside the agent.** Flue does not checkpoint arbitrary TypeScript execution and resume a function from its last completed line. The checkpoint boundary is the agent itself: _inside_ it, a durable tool gives application-controlled work resumable `step.do` checkpoints backed by the conversation's own durability; _outside_ it — the endpoint, script, or cron job driving the agent — use your platform's workflow engine (Cloudflare Workflows, Inngest, or plain re-runs) and treat Flue like any other service. Redelivering a message is a new submission in the conversation, and the durable record shows what the previous attempt completed.
- **External side effects.** Flue records that a tool ran and what it returned — never the effect itself. A payment API call, a row written to your application's database, a Slack message: those live in your systems, outside the recovery model's reach. Recovery never blindly repeats uncertain effectful work, but at-least-once execution means an effect at the boundary can repeat — design external effects to be idempotent, key them on stable ids like `toolCallId` or `step.do` names, and guard one-shot actions with persistent state.

## CLI (`flue`)

`@flue/cli` requires Node.js 22.19 or newer. Commands:

### `flue init [directory] [--target <node|cloudflare>] [--deploy] [--root <path>] [--force]`

Scaffolds a complete project skeleton: `flue.config.ts`, `package.json`, `tsconfig.json`, `.gitignore`, `.env`, `src/agents/hello.ts`, `AGENTS.md`, `README.md`; plus `vite.config.ts` + `src/app.ts` when deploying, `src/db.ts` (Node only), `src/cloudflare.ts` (Cloudflare only). Writes files only — never installs dependencies.

- `--target node|cloudflare` — prompts interactively when omitted (error without a terminal); anything else rejected (`Invalid target: "bogus"`).
- `--deploy` — include the HTTP server setup; off by default for node; cloudflare always deploys (`--target cloudflare` implies `--deploy`).
- `--root <path>` — identical to the positional; passing both is rejected.
- `--force` — scaffold into a non-empty directory without confirmation and overwrite existing skeleton files (incl. `flue.config.*`); without it existing files are left alone and reported "kept existing".
- Directory basename, lowercased and restricted to `[a-z0-9-]`, becomes the `package.json` name and (Cloudflare) Worker name; fallback `my-flue-app`.
- A flag may be passed at most once; unknown flags, extra positionals, and arguments after a bare `--` are rejected.

### `flue run <path> --message <text> [--name <agent>] [--id <id>] [--data <json>] [--uid <uid> | --new] [--env <path>] [--json]`

Executes one agent module in the local Node.js process: submits one message, streams activity to stderr, prints the final reply to stdout, exits. No server, no build artifacts; only the agent module (and its imports) loads — never `app.ts`. A module importing `cloudflare:*` APIs fails.

- `-m, --message <text>` — required. `--name <agent>` — required when the module exports more than one agent (matches `agentName` static, else exported function name).
- `--id <id>` — conversation to create or continue; defaults to a fresh ULID printed on stderr. Conversations persist between invocations via the project's `db.ts` entry, or `node_modules/.cache/flue/run.db` without one.
- `--data <json>` — `useInitialData()` payload; consulted only when this run creates the conversation, silently ignored on continues; can't combine with `--uid`.
- `--uid <uid>` — continue only the instance with this uid; can't combine with `--new` or `--data`. `--new` — create only; rejected when the conversation already exists.
- `--env <path>` — load one alternate `.env`-format file instead of the default; project `.env` is auto-loaded (shell values win).
- `--json` — one envelope on stdout, discriminated by `outcome`: `completed` (with `message`), `failed`/`aborted` (with `error` = `{ message, type?, details?, dev? }`), `error` for setup/admission failures. Exit codes: `0` completed, `1` failed/setup errors, `130` aborts. `--json` always prints exactly one envelope.

### `flue add [<kind> <name|url>] [--print]`

Fetches a blueprint — a Markdown implementation guide for an AI coding agent to follow. Not a package installer: it prints the guide, your coding agent applies it. No args = list the catalog. Kind = `channel`, `database`, `sandbox`, or `tooling`; name (e.g. `slack`, `postgres`, `daytona`, `sentry`) or an absolute provider-docs URL (selects the kind's generic build-from-scratch guide). Prints to stdout when invoked by a coding agent (detected from environment markers) or with `--print`. Registry: `https://flueframework.com/cli/blueprints/`.

### `flue update <kind> <name|url> [--print]`

Same blueprint for upgrading an existing integration. Both arguments required (unlike `flue add`). Does not inspect or modify your project — the guide carries the update instructions. Output behavior matches `flue add`.

### `flue docs` / `flue docs read <path>` / `flue docs search <query>`

Browses documentation shipped inside `@flue/cli` (same pages as the website) — no network, always matches the installed version. `docs` lists every page (`<path> -- <title>`); `read` prints one page as markdown (`<path>` accepts the catalog path, website URL/absolute path, or source filename); `search` full-texts titles/headings/descriptions/body, prints JSON best-match-first (at most 8 results); pass a result's `path` to `docs read`.

## Ecosystem: Channels & Databases

### Channels

#### slack

- Blueprint: `flue add channel slack`
- Packages: `@flue/slack` (ingress) + `@slack/web-api` (official SDK)
- Generated file: `src/channels/slack.ts` — named exports `channel` (from `createSlackChannel`), `client` (`new WebClient(process.env.SLACK_BOT_TOKEN)`), generated `replyInThread()` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `SLACK_SIGNING_SECRET` (Required — verifies inbound request bytes), `SLACK_BOT_TOKEN` (Required — authenticates outbound Web API calls)
- Mount: `app.route('/channels/slack', slack.route())` with `import { channel as slack } from './channels/slack.ts'`
- Routes: `/channels/slack/events` (Event Subscriptions), `/channels/slack/interactions` (Interactivity), `/channels/slack/commands` (Slash commands) — add only surfaces the app handles; omitting a callback omits its route
- Factory: `createSlackChannel({ signingSecret, events?, interactions?, commands? })`; handlers `events({ payload })`, `interactions({ payload })`, `commands({ c, payload })`
- Verification: signing secret (Slack URL verification is answered internally after signature verification)
- `instanceId()`: `channel.instanceId({ teamId, channelId, threadTs })` where `threadTs: event.thread_ts ?? event.ts`
- Notes: does not filter bot messages, message subtypes, or event families; `app_rate_limited` reaches the callback; workspace/enterprise identity stays in the payload (no single-workspace model); snake_case wire fields preserved; `trigger_id`, `response_url`, view `response_urls` are short-lived — keep out of dispatched messages/context/logs; retries readable via `x-slack-retry-num` / `x-slack-retry-reason`; preserve `payload.event_id`; `initialData` recorded once when the event creates the instance; `client.assistant.threads.setStatus()` is a Slack API capability; v8 `WebClient` exposes `chatStream()` (`stream.append({ markdown_text })`, `stream.stop()`); OAuth storage, Socket Mode, token rotation are app concerns

#### discord

- Blueprint: `flue add channel discord`
- Packages: `@flue/discord` (ingress) + `@discordjs/rest` (community-maintained REST client; Discord ships no official JS REST SDK)
- Generated file: `src/channels/discord.ts` — named exports `channel` (from `createDiscordChannel`), project-owned `client` (`new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!)`), helper `destinationFromInteraction`, generated `postMessage` tool; `channel.instanceId(ref)`, `parseInstanceId()`
- Env: `DISCORD_PUBLIC_KEY` (Required — verifies inbound interaction request bytes), `DISCORD_BOT_TOKEN` (Required — authenticates outbound REST calls)
- Mount: `app.route('/channels/discord', discord.route())` with `import { channel as discord } from './channels/discord.ts'`
- Route: `/channels/discord/interactions` — set as "Interactions Endpoint URL" in the Discord Developer Portal (`https://example.com/channels/discord/interactions`); endpoint/command registration is provider setup owned by the app
- Factory: `createDiscordChannel({ publicKey, interactions })`; handler `interactions({ interaction })`
- Verification: Ed25519 public-key verification of signed interaction bytes; signed PING answered with PONG internally before app code runs; rejects signed requests whose timestamp is more than five minutes from the server clock
- `instanceId()`: `channel.instanceId(destination)` where `destination` is a `DiscordDestinationRef` derived from native `guild_id`, `channel.id`, `channel.type`, and `context`; some valid interactions (e.g. modal submissions) may omit a channel
- Notes: `interaction` is the native API v10 object; numeric `type` discriminant narrows commands, autocomplete, components, modal submissions; future numeric types are still forwarded; every non-PING interaction requires a response within three seconds (callback type `4` immediate, `5` deferred via webhook API); interaction tokens valid for follow-ups up to 15 minutes; `interaction.token` short-lived; preserve `interaction.id`; Gateway (persistent WebSocket) is outside the channel model; `postMessage` creates an ordinary bot-token channel message, not an interaction follow-up; runs on Node and Cloudflare Workers with `nodejs_compat` (REST package selects its Fetch-based export)

#### teams

- Blueprint: `flue add channel teams`
- Packages: `@flue/teams` (ingress) only — no third-party outbound SDK; project-owned Fetch client; runs on Node and Cloudflare Workers
- Generated files: `src/channels/teams.ts` + `lib/teams-client.ts` — exports `channel` (from `createTeamsChannel`), `client` (from `createTeamsClient({ appId, tenantId, appPassword })`), `postMessage(ref: TeamsMessageRef)` tool; type `TeamsMessageRef`; helper `channel.destination(activity)`
- Env: `TEAMS_APP_ID` (Required — constrains inbound JWT audience), `TEAMS_TENANT_ID` (Required — constrains activity tenant identity), `TEAMS_APP_PASSWORD` (Required — authenticates outbound OAuth requests)
- Mount: `app.route('/channels/teams', teams.route())` with `import { channel as teams } from './channels/teams.ts'`
- Route: `/channels/teams/activities` (Azure Bot messaging endpoint)
- Factory: `createTeamsChannel({ appId, tenantId, activities })`; handler `activities({ activity })`
- Verification: Bot Connector bearer token — Microsoft OpenID signing key and `RS256` signature; issuer, application audience, expiration; the signing key's `msteams` endorsement; the activity's exact `serviceUrl` against the signed token claim; host conversation and channel tenant against `TEAMS_TENANT_ID`. Defaults target Microsoft public cloud; sovereign deployments can provide their documented OpenID metadata URL, token issuer, and OAuth authority
- `instanceId()`: `channel.instanceId(channel.destination(activity))`; `channel.destination(activity)` derives `{ serviceUrl, conversationId, botId, threadId? }`; `initialData` = that destination
- Notes: callback receives native Bot Framework `Activity` (re-exported from `botframework-schema`); switch on `activity.type`; Azure holds the request open, so `dispatch(...)` and return — rely on idempotency; `invoke` activities expect a JSON acknowledgement and non-2xx is retried; preserve activity ids; bots receive channel messages when mentioned by default (resource-specific consent needed otherwise); `lib/teams-client.ts` exchanges credentials for a Connector token, caches until shortly before expiry

#### google-chat

- Blueprint: `flue add channel google-chat`
- Packages: `@flue/google-chat` (ingress) + `jose` (provider authentication library)
- Generated file: `src/channels/google-chat.ts` — named exports `channel` (from `createGoogleChatChannel`), `client` (Google Chat REST client built on the verified service account, signed with the private key), generated `replyInThread()` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `GOOGLE_CHAT_APP_ID` (Required — references the Google Cloud project), `GOOGLE_CHAT_SERVICE_ACCOUNT` (Required — authenticates/authorizes outbound REST), `GOOGLE_CHAT_AUTH_SERVICE_ACCOUNT` (Required — performs signed exchange)
- Mount: `app.route('/channels/google-chat', googleChat.route())` with `import { channel as googleChat } from './channels/google-chat.ts'`
- Route: `/channels/google-chat/events` (the single Google Chat push/HTTP endpoint; other paths under the mount return `404`)
- Factory: `createGoogleChatChannel({ events })`; handler `events({ payload })`
- Verification: authorization-header Bearer token signed with the service account's private key, verified with its public key; `401` on failure; requires ingress verification enabled in the app configuration
- `instanceId()`: `channel.instanceId({ spaceName, threadName })` where `spaceName: payload.space.name`, `threadName: payload.message.thread.name ?? ''` (a message without a thread becomes a thread with an empty name)
- Notes: provider-native payloads — synchronous `MESSAGE` and `ADDED_TO_SPACE`, plus async membership/space event types; return a JSON `message` to reply in the space, `{}` for empty success; preserve `payload.message.name`; message names are not conversation ids; the package does not make webhook-configuration calls — configure the app endpoint, enable verification, and supply the service account in the Google Chat App Configuration Console

#### telegram

- Blueprint: `flue add channel telegram`
- Packages: `@flue/telegram` (ingress) + `grammY` (official bot framework)
- Generated file: `src/channels/telegram.ts` — named exports `channel` (from `createTelegramChannel`), `client` (`new Bot(process.env.TELEGRAM_BOT_TOKEN)`, the grammY `Bot`), `sendMessage(chatId, text, opts)` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `TELEGRAM_BOT_TOKEN` (Required — authenticates outbound Bot API calls)
- Mount: `app.route('/channels/telegram', telegram.route())` with `import { channel as telegram } from './channels/telegram.ts'`
- Route: `/channels/telegram/webhook` (set as the webhook URL in BotFather)
- Factory: `createTelegramChannel({ bot, webhookSecret?, updates? })`; handler `updates({ update })`
- Verification: `webhookSecret?` is Telegram's `secret_token`, compared via the `X-Telegram-Bot-Api-Secret-Token` header when configured (strongly recommended); Telegram does not sign webhook payloads
- `instanceId()`: `channel.instanceId({ chatId })` where `chatId: update.message?.chat.id`
- Notes: callback receives native `Update` objects; no handler supplied → all updates answered `200`; return JSON to send it as a Telegram message via the Bot API (`{ text }`, `{ text, chat_id, ... }`), `{}` for empty 200; preserve `update.update_id`; one long-lived webhook endpoint per bot; the package does not call `setWebhook` and does not poll; bot tokens are capabilities — treat as secrets, never in client-side or agent-facing code

#### whatsapp

- Blueprint: `flue add channel whatsapp`
- Packages: `@flue/whatsapp` (ingress) + `@kapso/whatsapp-cloud-api` (community-maintained SDK)
- Generated file: `src/channels/whatsapp.ts` — named exports `channel` (from `createWhatsAppChannel`), `client` (a `WhatsAppCloudAPI` client using the token + phone number id), `sendTextMessage(to, text)` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (Required — answered during verification handshake), `WHATSAPP_ACCESS_TOKEN` (Required — authenticates outbound Graph API calls), `WHATSAPP_PHONE_NUMBER_ID` (Required — identifies the verified sending number)
- Mount: `app.route('/channels/whatsapp', whatsapp.route())` with `import { channel as whatsapp } from './channels/whatsapp.ts'`
- Route: `/channels/whatsapp/webhook` (callback URL set in the Meta App Dashboard)
- Factory: `createWhatsAppChannel({ verifyToken, webhookVerify?, messages? })`; handlers `webhookVerify({ mode, verifyToken, challenge })`, `messages({ payload })`
- Verification: GET handshake (`hub.mode === 'subscribe'`, token match → respond with `challenge`), then `X-Hub-Signature-256` sha256 HMAC with the app secret; app secret comes from the Meta App Dashboard
- `instanceId()`: `channel.instanceId({ phoneNumberId, from })` where `phoneNumberId: payload.metadata.phone_number_id`, `from: payload.contacts[0]?.wa_id`
- Notes: Graph API webhook format payload (e.g. text `message` entry, `contacts[0].profile.name`); return JSON to send a WhatsApp message, `{}` for empty 200; preserve `payload.messages[0].id`; token refresh and long-lived access tokens are app concerns; contact identity (`wa_id`) is an instance key, not a contact record

#### messenger

- Blueprint: `flue add channel messenger`
- Packages: `@flue/messenger` (ingress) only — no Messenger SDK dependency; calls the Graph API with Fetch directly; runs on Node and Cloudflare Workers
- Generated file: `src/channels/messenger.ts` — named exports `channel` (from `createMessengerChannel`), generated `reply({ psid, text })` tool (Graph API call with `recipient`/`message`); helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `MESSENGER_VERIFY_TOKEN` (Required — answered during verification handshake), `MESSENGER_ACCESS_TOKEN` (Required — authenticates outbound Graph API calls), `MESSENGER_APP_SECRET` (Required — verifies inbound signed payloads)
- Mount: `app.route('/channels/messenger', messenger.route())` with `import { channel as messenger } from './channels/messenger.ts'`
- Route: `/channels/messenger/webhook` (callback URL set in the Meta App Dashboard)
- Factory: `createMessengerChannel({ verifyToken, appSecret, webhookVerify?, messages? })`; handlers `webhookVerify({ mode, verifyToken, challenge })`, `messages({ payload })`
- Verification: GET hub handshake (mode `subscribe`, token match → echo `challenge`), then `X-Hub-Signature-256` sha256 HMAC over the raw body with the app secret
- `instanceId()`: `channel.instanceId({ psid })` where `psid: payload.sender?.id`
- Notes: Meta webhook `payload` (Graph API format — `messages` array with `sender`, `message.text`); return JSON to send a Messenger message, `{}` for empty 200; preserve `payload.messages[0].mid`; token refresh and long-lived tokens are app concerns; PSIDs are long-lived page-scoped conversation identifiers and instance keys, not user profile data

#### twilio

- Blueprint: `flue add channel twilio`
- Packages: `@flue/twilio` (ingress) only — no SDK dependency; writes TwiML response body directly; runs on Node and Cloudflare Workers
- Generated file: `src/channels/twilio.ts` — named exports `channel` (from `createTwilioChannel`), generated `reply({ to, from, body })` tool (messages.create TwiML response); helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `TWILIO_AUTH_TOKEN` (Required — verifies inbound request signatures)
- Mount: `app.route('/channels/twilio', twilio.route())` with `import { channel as twilio } from './channels/twilio.ts'`
- Route: `/channels/twilio/messages` (Messaging webhook configured in the Twilio Console)
- Factory: `createTwilioChannel({ authToken, messages? })`; handler `messages({ payload })`
- Verification: signature verification — HMAC-SHA1 of the canonical request with `TWILIO_AUTH_TOKEN`, validating the `X-Twilio-Signature` header; rejects missing/invalid (unverified requests get `401`)
- `instanceId()`: `channel.instanceId({ to, from })` where `to: payload.To`, `from: payload.From`
- Notes: `payload` is an array of Twilio form-encoded key/value pairs (`payload.find(([k]) => k === 'Body')?.[1]`); body via `Body`, number via `From`, destination via `To`; return nothing → empty `200` ack, JSON `{ body }` → reply SMS, `{ body: undefined }` or `{ twiml: '' }` → skip reply and ack; response status must be `200` for Twilio to acknowledge; preserve `MessageSid`; outbound messages, webhook config, `twiml` mode, and Studio flows are external to the channel

#### github

- Blueprint: `flue add channel github`
- Packages: `@flue/github` (ingress) + `@octokit/rest` (official SDK)
- Generated file: `src/channels/github.ts` — named exports `channel` (from `createGitHubChannel`), `client` (`new Octokit({ auth: process.env.GITHUB_TOKEN })`), generated `getRepositoryContents({ owner, repo, path })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `GITHUB_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `GITHUB_TOKEN` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/github', github.route())` with `import { channel as github } from './channels/github.ts'`
- Route: `/channels/github/webhook` (set in the repository's Webhooks settings)
- Factory: `createGitHubChannel({ webhookSecret, events? })`; handler `events({ event, payload })`
- Verification: HMAC-SHA256 with the webhook secret, header `X-Hub-Signature-256`; `401` on failure; `X-GitHub-Event` available on `c.req.header('x-github-event')`; with no handler the channel still answers all events with `200`
- `instanceId()`: `channel.instanceId({ owner, repo })` where `owner: payload.repository.owner.login`, `repo: payload.repository.name`
- Notes: callback receives native `event` name + `payload`; return JSON to post a comment on the issue/PR, `{}` for empty 200; preserve `payload.delivery` (X-GitHub-Delivery); webhook configuration and outbound API calls are app concerns

#### linear

- Blueprint: `flue add channel linear`
- Packages: `@flue/linear` (ingress) + `@linear/sdk` (official SDK)
- Generated file: `src/channels/linear.ts` — named exports `channel` (from `createLinearChannel`), `client` (`new LinearClient({ apiKey: process.env.LINEAR_API_KEY })`), generated `commentOnIssue({ id, body })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `LINEAR_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `LINEAR_API_KEY` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/linear', linear.route())` with `import { channel as linear } from './channels/linear.ts'`
- Route: `/channels/linear/webhook` (set in Linear admin settings)
- Factory: `createLinearChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: HMAC-SHA256 with the webhook secret; `401` on failure
- `instanceId()`: `channel.instanceId({ teamId })` where `teamId: payload.team.id`
- Notes: native webhook `payload` (issue events); return JSON to comment on the issue, `{}` for empty 200; preserve `payload.data.id`; webhook configuration and outbound API calls are app concerns

#### notion

- Blueprint: `flue add channel notion`
- Packages: `@flue/notion` (ingress) + `@notionhq/client` (official SDK)
- Generated file: `src/channels/notion.ts` — named exports `channel` (from `createNotionChannel`), `client` (`new Client({ auth: process.env.NOTION_API_KEY })`), generated `commentOnPage({ pageId, text })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `NOTION_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `NOTION_API_KEY` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/notion', notion.route())` with `import { channel as notion } from './channels/notion.ts'`
- Route: `/channels/notion/webhook` (set in Notion webhook settings)
- Factory: `createNotionChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: HMAC-SHA256 with the webhook secret; `401` on failure
- `instanceId()`: `channel.instanceId({ pageId })` where `pageId: payload.page_id` (or from the page object in the payload)
- Notes: native webhook `payload` (page updated events); return JSON to comment on the page, `{}` for empty 200; preserve `payload.id` (webhook event id); webhook configuration and outbound API calls are app concerns

#### intercom

- Blueprint: `flue add channel intercom`
- Packages: `@flue/intercom` (ingress) + `intercom-client` (official SDK)
- Generated file: `src/channels/intercom.ts` — named exports `channel` (from `createIntercomChannel`), `client` (`new Client({ token: process.env.INTERCOM_ACCESS_TOKEN })`), generated `replyToConversation({ conversationId, body })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `INTERCOM_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `INTERCOM_ACCESS_TOKEN` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/intercom', intercom.route())` with `import { channel as intercom } from './channels/intercom.ts'`
- Route: `/channels/intercom/webhook` (set in the Intercom developer hub)
- Factory: `createIntercomChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: HMAC-SHA256 with the webhook secret; `401` on failure
- `instanceId()`: `channel.instanceId({ conversationId })` from the conversation payload
- Notes: native webhook `payload` (conversation events); return JSON to reply to the conversation, `{}` for empty 200; preserve `payload.id`; webhook configuration and outbound API calls are app concerns

#### zendesk

- Blueprint: `flue add channel zendesk`
- Packages: `@flue/zendesk` (ingress) + `lossless-json` (community-maintained; Zendesk's API accepts only JSON without certain JS floating-point artifacts)
- Generated file: `src/channels/zendesk.ts` — named exports `channel` (from `createZendeskChannel`), `client` (Zendesk API Fetch client signed with the credentials), generated `replyToTicket({ ticketId, body })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `ZENDESK_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `ZENDESK_SUBDOMAIN` (Required — identifies the Zendesk subdomain), `ZENDESK_EMAIL` (Required — authenticates outbound API calls), `ZENDESK_API_TOKEN` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/zendesk', zendesk.route())` with `import { channel as zendesk } from './channels/zendesk.ts'`
- Route: `/channels/zendesk/webhook` (set in the Zendesk admin webhooks settings)
- Factory: `createZendeskChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: HMAC-SHA256 with the webhook secret; `401` on failure
- `instanceId()`: `channel.instanceId({ ticketId })` from the ticket payload
- Notes: native webhook `payload` (ticket events); return JSON to reply to the ticket, `{}` for empty 200; preserve `payload.id`; webhook configuration and outbound API calls are app concerns

#### stripe

- Blueprint: `flue add channel stripe`
- Packages: `@flue/stripe` (ingress) + `stripe` (official SDK)
- Generated file: `src/channels/stripe.ts` — named exports `channel` (from `createStripeChannel`), `client` (`new Stripe(process.env.STRIPE_SECRET_KEY)`), generated `getCustomer({ id })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `STRIPE_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `STRIPE_SECRET_KEY` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/stripe', stripe.route())` with `import { channel as stripe } from './channels/stripe.ts'`
- Route: `/channels/stripe/webhook` (signing secret set in the Stripe Dashboard)
- Factory: `createStripeChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: webhook signature via `stripe.webhooks.constructEvent` with the endpoint signing secret (`STRIPE_WEBHOOK_SECRET`)
- `instanceId()`: `channel.instanceId({ accountId })` where `accountId: payload.account` (Stripe connected account id)
- Notes: provider-native event `payload` typed by event type; return JSON to send it as an API operation, `{}` for empty 200; preserve `payload.id`; webhook configuration and outbound API calls are app concerns

#### shopify

- Blueprint: `flue add channel shopify`
- Packages: `@flue/shopify` (ingress) + `@shopify/admin-api-client` (official SDK)
- Generated file: `src/channels/shopify.ts` — named exports `channel` (from `createShopifyChannel`), `client` (admin API client for the configured shop), generated `getOrder({ id })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `SHOPIFY_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `SHOPIFY_SHOP_DOMAIN` (Required — identifies the Shopify shop), `SHOPIFY_ACCESS_TOKEN` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/shopify', shopify.route())` with `import { channel as shopify } from './channels/shopify.ts'`
- Route: `/channels/shopify/webhook` (set in the Shopify admin)
- Factory: `createShopifyChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: HMAC-SHA256 with the webhook secret; `401` on failure
- `instanceId()`: `channel.instanceId({ shop })` from the shop domain in the payload
- Notes: native webhook `payload` (order events); return JSON to send it as an API operation, `{}` for empty 200; preserve `payload.id`; webhook configuration and outbound API calls are app concerns

#### resend

- Blueprint: `flue add channel resend`
- Packages: `@flue/resend` (ingress) + `resend` (official SDK)
- Generated file: `src/channels/resend.ts` — named exports `channel` (from `createResendChannel`), `client` (`new Resend(process.env.RESEND_API_KEY)`), generated `sendEmail({ to, subject, text })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `RESEND_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `RESEND_API_KEY` (Required — authenticates outbound API calls)
- Mount: `app.route('/channels/resend', resend.route())` with `import { channel as resend } from './channels/resend.ts'`
- Route: `/channels/resend/webhook` (set in the Resend dashboard)
- Factory: `createResendChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: HMAC-SHA256 with the webhook secret; `401` on failure
- `instanceId()`: `channel.instanceId({ email })` from the recipient email in the payload
- Notes: email event payloads such as `email.delivered`, `email.bounced`; return JSON to send an email, `{}` for empty 200; preserve `payload.id`; webhook configuration and outbound API calls are app concerns

#### salesforce-marketing-cloud

- Blueprint: `flue add channel salesforce-marketing-cloud`
- Packages: `@flue/salesforce` (ingress) only — no SDK dependency; calls the Marketing Cloud API with Fetch directly; runs on Node and Cloudflare Workers
- Generated file: `src/channels/salesforce-marketing-cloud.ts` — named exports `channel` (from `createSalesforceMarketingCloudChannel`), `client` (Fetch-based Marketing Cloud REST client using `SALESFORCE_CLIENT_ID` + `SALESFORCE_CLIENT_SECRET`), generated `reply({ to, subject, body })` tool; helpers `channel.instanceId(...)`, `channel.parseInstanceId(id)`
- Env: `SALESFORCE_WEBHOOK_SECRET` (Required — verifies inbound webhook payloads), `SALESFORCE_CLIENT_ID` (Required — authenticates outbound OAuth calls), `SALESFORCE_CLIENT_SECRET` (Required — authenticates outbound OAuth calls)
- Mount: `app.route('/channels/salesforce-marketing-cloud', salesforce.route())` with `import { channel as salesforce } from './channels/salesforce-marketing-cloud.ts'`
- Route: `/channels/salesforce-marketing-cloud/webhook` (set in Marketing Cloud configuration)
- Factory: `createSalesforceMarketingCloudChannel({ webhookSecret, events? })`; handler `events({ payload })`
- Verification: HMAC-SHA256 with the webhook secret; `401` on failure
- `instanceId()`: `channel.instanceId({ contactKey })` from the Marketing Cloud payload
- Notes: native webhook `payload`; return JSON to send a message, `{}` for empty 200; preserve `payload.id`; webhook configuration and outbound API calls are app concerns

### Databases

#### postgres

- Blueprint: `flue add database postgres`
- Adapter: `@flue/postgres`; driver: `postgres` (Postgres.js)
- Generated file: `lib/postgres.ts` — `createPostgres({ url })` returns the Postgres.js `sql` client wrapper; module exports the client so the app can use Postgres.js directly
- Env: `DATABASE_URL` (Required — Postgres connection string)
- Notes: bring-your-own-driver model; runs on Node and Cloudflare Workers (with `nodejs_compat`); Drizzle/Prisma integration and connection pooling are app concerns

#### turso

- Blueprint: `flue add database turso`
- Adapter: `@flue/turso`; driver: `@libsql/client`
- Generated file: `lib/turso.ts` — `createTurso({ url, authToken })` returns the libSQL client; module exports the client for direct use
- Env: `TURSO_URL` (Required — Turso database URL), `TURSO_AUTH_TOKEN` (Required — Turso authentication token)
- Notes: uses libSQL's HTTP (Turso) transport; works on Node and Cloudflare Workers

#### libsql

- Blueprint: `flue add database libsql`
- Adapter: `@flue/libsql`; driver: `@libsql/client`
- Generated file: `lib/libsql.ts` — `createLibsql({ url, authToken? })` returns the libSQL client; module exports the client for direct use
- Env: `LIBSQL_URL` (Required — libSQL database URL), `LIBSQL_AUTH_TOKEN` (Optional — libSQL authentication token)
- Notes: can point at a local file, an embedded replica, or a Turso remote via URL

#### supabase

- Blueprint: `flue add database supabase`
- Adapter: `@flue/supabase`; driver: `@supabase/supabase-js`
- Generated file: `lib/supabase.ts` — `createSupabase({ url, anonKey })` returns the Supabase client; module exports the client for direct use
- Env: `SUPABASE_URL` (Required — Supabase project URL), `SUPABASE_ANON_KEY` (Required — Supabase anon/public key)
- Notes: the anon key is a public capability; row-level security and service-role tokens are app concerns

#### mysql

- Blueprint: `flue add database mysql`
- Adapter: `@flue/mysql`; driver: `mysql2`
- Generated file: `lib/mysql.ts` — `createMySql({ url })` returns a `mysql2` pooled client; module exports the client for direct use
- Env: `DATABASE_URL` (Required — MySQL connection string)
- Notes: uses `mysql2`'s promise API; runs on Node (and Cloudflare Workers with `nodejs_compat` and TCP support)

#### redis

- Blueprint: `flue add database redis`
- Adapter: `@flue/redis`; driver: `ioredis`
- Generated file: `lib/redis.ts` — `createRedis({ url })` returns the ioredis client; module exports the client for direct use
- Env: `REDIS_URL` (Required — Redis connection string)
- Notes: commonly used for session/idempotency storage; runs on Node

#### mongodb

- Blueprint: `flue add database mongodb`
- Adapter: `@flue/mongodb`; driver: `mongodb` (official driver)
- Generated file: `lib/mongodb.ts` — `createMongo({ url })` returns a `MongoClient`; module exports the client for direct use
- Env: `MONGODB_URL` (Required — MongoDB connection string)
- Notes: Atlas SRV strings are supported; runs on Node

#### valkey

- Blueprint: `flue add database valkey`
- Adapter: `@flue/valkey`; driver: `valkey-io` (Valkey.js)
- Generated file: `lib/valkey.ts` — `createValkey({ url })` returns the Valkey client; module exports the client for direct use
- Env: `VALKEY_URL` (Required — Valkey connection string)
- Notes: Redis-compatible protocol; commonly used for session/idempotency storage; runs on Node

## Ecosystem: Deploy, Sandboxes & Tooling

Condensed from `docs/ecosystem/deploy/*.md`, `docs/ecosystem/sandboxes/*.md`, `docs/ecosystem/tooling/*.md`. Exact identifiers and command flags preserved verbatim.

### Deploy

#### cloudflare

Platform: Cloudflare Workers + Durable Objects (workerd via `@cloudflare/vite-plugin`). Flue is two Vite plugins side by side: `flue()` from `@flue/vite` plus `@cloudflare/vite-plugin`. Auto-detected from presence of `cloudflare()` in the plugin array. Flue builds on Cloudflare's `agents` SDK (DO base class; `@flue/vite` ships it as its own dependency; a project-added `agents` copy wins).
Setup:
```bash
mkdir my-flue-worker && cd my-flue-worker
npm init -y
npm install @flue/runtime hono
npm install -D @flue/vite @cloudflare/vite-plugin vite wrangler
# for remote sandbox: npm install @cloudflare/sandbox
```
vite.config.ts: `plugins: [flue(), cloudflare()]` — `flue()` must come before `cloudflare()`. Scripts: `"dev": "vite dev"`, `"build": "vite build"`, `"deploy": "vite build && wrangler deploy"`.
Agent module (`'use agent'` directive): every exported capitalized function is an agent; function name = durable identity (optional `Translator.agentName = '...'` static override). `app.ts` is the only required file: Hono + `createAgentRouter(Translator)` from `@flue/runtime/routing` mounted via `app.route('/agents/translator', ...)`. POST returns `202 { "streamUrl": "...", "offset": "...", "submissionId": "..." }`; GET reads conversation.
wrangler.jsonc (required): `compatibility_date` ≥ `2026-04-01`, `compatibility_flags: ["nodejs_compat"]` (validated at build time). Migrations:
```jsonc
{ "migrations": [{ "tag": "flue-class-FlueTranslatorAgent", "new_sqlite_classes": ["FlueTranslatorAgent"] }] }
```
- Class naming: `Translator` → `FlueTranslatorAgent`, binding `FLUE_TRANSLATOR_AGENT`. Adding an agent = `'use agent'` file + `app.route(...)` mount + uniquely tagged migration.
- Must use `new_sqlite_classes`, never legacy `new_classes`. Never rewrite deployed migration entries; append only.
- Renaming function = storage-identity change: `renamed_classes` (`{ "from": "FlueOldNameAgent", "to": "FlueNewNameAgent" }`). Renaming file alone = no change; re-mount at different URL = not an identity change (no migration).
Secrets: local `.dev.vars` (gitignore `.dev.vars*`, `.env*`); use `.dev.vars` or `.env`, not both (`.dev.vars` wins). Deployed: `npx wrangler secret put ANTHROPIC_API_KEY`; CI: `wrangler deploy --secrets-file <path>`. Alternative: Workers AI binding (`cloudflare/...` model specifiers) — no API keys.
Dev/build/deploy:
```bash
npx vite dev        # local workerd, port 5173
npx vite build      # Worker artifact + finalized wrangler config into dist/
npx wrangler deploy # from project root, no --config flag; wrangler deploy --dry-run to validate
```
`flue run` is Node-local, does NOT emulate Cloudflare; `cloudflare:*` imports fail under it. Flue never rewrites authored `wrangler.jsonc`; layers contributions into generated gitignored `.flue-vite.wrangler.jsonc`. `FLUE_*_AGENT` binding-name collisions = build error.
Static assets: served before Worker unless `assets.run_worker_first` lists app API prefixes (default `["/api/*", "/agents/*", "/channels/*"]`).
Extending generated DOs — `cloudflare` extension descriptor (`extend` from `@flue/runtime/cloudflare`): `base` = native SDK lifecycle hooks (onStart/schedule/scheduleEvery/queue) + named methods; do NOT override `fetch()`, `onRequest()`, `onFiberRecovered()`, `alarm()`. `wrap` wraps the final generated class (e.g. Sentry `instrumentDurableObjectWithSentry`). Native SDK callbacks run as DO activity (no Flue harness/session).
Worker extension — `src/cloudflare.ts` (path configurable via `cloudflare` field in `flue.config.ts`): named exports become top-level Worker exports (e.g. app-owned `SalesforceAuthCache extends DurableObject`); declare binding + migration in `wrangler.jsonc`; agents access via `env.SALESFORCE_AUTH_CACHE`. Optional default export adds non-HTTP handlers (`scheduled`); must NOT export default `fetch` handler (HTTP stays in `app.ts`).
Subagents: `useSubagent({ name: 'triager', description: '...', agent: Triager })`. Virtual sandbox seeding (harness tool): `useTool({ name, description, input: v.object(...), harness: true, async run({ harness, data }) { ... } })`; built-in tools grep, glob, read (powered by just-bash).
Remote sandbox (`@cloudflare/sandbox`, platform-native): `export { Sandbox } from '@cloudflare/sandbox'`; declare DO binding + migration + container in `wrangler.jsonc` (`"containers": [{ "class_name": "Sandbox", "image": "./Dockerfile" }]`). Dockerfile: `FROM docker.io/cloudflare/sandbox:0.9.2` (pin tag to package version). Agent: `useSandbox(cloudflareSandbox(getSandbox(Sandbox, id)))`. Multiple sandboxes via alias exports + different Dockerfiles. Outbound (zero-trust egress): subclass `Sandbox` with `static outboundByHost = { 'api.github.com': (request, env, ctx) => ... }`.
Persistence: DO SQLite per agent instance, append-only canonical stream + separate immutable attachment store; no `db.ts`. `flue_meta` row stamps format version; refuses unknown/newer format; no in-place migration. Virtual sandbox fs is in-memory, not durable. Interruption: conservative replay keyed by `submissionId`. Observability: `{ "observability": { "enabled": true, "traces": { "enabled": true } } }`; spans `invoke_agent`, `chat`, `execute_tool`; `createCloudflareTracing()` customizes content capture; `tracing: false` opts out.
Deploy curl:
```bash
curl -X POST 'https://my-agent.<your-subdomain>.workers.dev/agents/translator/customer-123' \
  -H "Content-Type: application/json" -d '{"kind": "user", "body": "Translate to French: Hello world"}'
```
Sandbox progression: empty virtual → virtual with shell setup (`harness.sandbox`) → container (`@cloudflare/sandbox`).

#### docker

Platform: container image of the Flue Node build (see node). Long-running HTTP server — deploy as service, not scale-to-zero.
Multi-stage Dockerfile: build stage `FROM node:22-slim` runs `npm ci` then `npx vite build`; runtime stage `FROM node:22-slim`, `RUN npm ci --omit=dev`, `COPY --from=build /app/dist ./dist`, `USER node`, `ENV PORT=8080`, `EXPOSE 8080`, `CMD ["node", "dist/server.mjs"]`.
- `vite` + `@flue/vite` stay build-only devDependencies; externalized deps need `node_modules` in runtime image.
- `.dockerignore`: `node_modules`, `dist`, `.git`, `.env`.
- Run with init (`docker run --init`) or `tini`/`dumb-init` for SIGTERM/graceful shutdown and child reaping.
- Server binds `PORT` (default `3000`; image sets `8080`).
Build/run:
```bash
docker build -t flue-agents .
docker run --init -p 8080:8080 -e ANTHROPIC_API_KEY=sk-... flue-agents
docker run --init -p 8080:8080 -e MODEL_SPECIFIER=anthropic/claude-sonnet-4-6 -e ANTHROPIC_API_KEY=sk-... flue-agents
```

Env/secrets: built server reads only start-time env — does NOT load `.env`. Pass provider key + optional `MODEL_SPECIFIER` via platform secret store. Persistence (db.ts): without adapter, in-memory (lost on restart). Postgres `PersistenceAdapter` via `@flue/postgres` — `postgres({ query, transaction, close })` wrapping a `pg` Pool reading `process.env.DATABASE_URL`; `db.ts` discovered at build time. One live owner per agent instance (no active-active).
Health/streaming: Flue generates no health endpoint — define `/health` in `app.ts`. Admission returns `streamUrl`, `offset`, `submissionId`; clients reconnect/resume from offset.

#### fly

Platform: Fly.io Fly Machines (long-running Docker app). `fly launch` detects the Flue Dockerfile; `fly deploy` builds + deploys.
```bash
fly launch
fly deploy
```
Dockerfile builds `dist/server.mjs` (`npx vite build` with `flue()` plugin), starts `node dist/server.mjs`. Set `ENV PORT` in image and match `internal_port` in `fly.toml`. `node_modules` must be in image at runtime.
fly.toml essentials: `[http_service]` `internal_port = 8080` (must match image PORT/EXPOSE), `force_https = true`, `auto_stop_machines = "off"`, `auto_start_machines = true`, `min_machines_running = 1`, plus `[[http_service.checks]]` GET `/health` (must be defined in `app.ts`). `[[vm]]` `size = "shared-cpu-1x"`, `memory = "512mb"`. `auto_stop`/`auto_start` move together; scale-to-zero is wrong for Flue (severs in-flight streams, discards in-memory session state).
Secrets: `fly secrets set ANTHROPIC_API_KEY=sk-ant-...`, `fly secrets set MODEL_SPECIFIER=anthropic/claude-sonnet-4-6` (restarts Machines; `.env` not used in production).
Persistence: Fly Managed Postgres (MPG; unmanaged `fly postgres` unsupported). `fly mpg create` (flags `--name`/`--region`/`--plan`); `fly mpg attach <cluster-id> -a my-flue-agents` sets pooled `DATABASE_URL` secret + restarts. `npm install @flue/postgres`; `db.ts` same `postgres({ query, transaction, close })` shape.
Health: Fly HTTP checks expect 2xx, don't follow redirects — with `force_https = true` run check over `https` or add `X-Forwarded-Proto = "https"` header. Going further: `fly scale count` / `fly scale vm`; scheduled Machines POST `kind: 'signal'`.

#### github-actions

Platform: GitHub Actions CI. CI = `flue run` (one agent module, one message, no server/port; transport-free; prints reply to stdout).
Setup:
```bash
mkdir my-flue-project && cd my-flue-project
npm init -y
npm install @flue/runtime valibot
npm install -D @flue/cli
```
(`'use agent'` directive only matters for Vite builds; `flue run` takes module path directly.)
`local()` sandbox (`@flue/runtime/node`): runs agent on host filesystem + shell (checked-out repo + `$PATH` binaries); skills + `AGENTS.md` auto-discovered from project root. Only shell-essential env vars inherited; pass more via `local({ env: { GH_TOKEN: process.env.GH_TOKEN, NPM_TOKEN: process.env.NPM_TOKEN } })`.
Local test:
```bash
npx flue run src/agents/hello.ts --message "Say hello to World"
# --json for machine-readable envelope; progress → stderr, final reply → stdout
npx flue run src/agents/auto-triage.ts --message "Triage issue #42" --json | jq -r '.message'
npx flue run src/agents/auto-triage.ts --message "What did you conclude?" --id issue-42  # continue conversation
```

Workflow `.github/workflows/hello.yml`: `on: issues: types: [opened]`, `runs-on: ubuntu-latest`, `permissions: { issues: read }`, steps `actions/checkout@v4`, `actions/setup-node@v4` (node-version 22), `npm ci`, then env `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}` and `npx flue run src/agents/hello.ts --message 'Say hello to ${{ github.event.issue.user.login }}'`. Add `ANTHROPIC_API_KEY` as repository secret.
Issue-triage workflow: same with `timeout-minutes: 30`, `permissions: { contents: read, issues: write }`, env `ANTHROPIC_API_KEY` + `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (automatic), command `npx flue run src/agents/triage.ts --message 'Triage issue #${{ github.event.issue.number }}'`.
Harness: `harness.sandbox.exec(cmd)` → `{ stdout, stderr, exitCode }`; `harness.prompt(text, opts)` with `result` Valibot schema → `response.data` typed. Tight secret boundary: `useTool(...)`; tool reads secret from `process.env`, agent sees only params + result. Subagents: `useSubagent({ name: 'reviewer', description, agent: Reviewer })`. Typed orchestration (AutoTriage): `useTool({ name: 'triage-issue', input: v.object({ issueNumber: v.number() }), harness: true, ... })` with `result: v.object({ severity: v.picklist(['low','medium','high','critical']), ... })`.

#### gitlab-ci

Platform: GitLab CI/CD pipelines. Same `flue run` model, `local()` sandbox (uses `glab`), `@flue/runtime` + `valibot`, `@flue/cli` dev dep. Local test commands identical (`npx flue run ... --message`, `--json`, `--id`).
Pipeline `.gitlab-ci.yml` (hello):
```yaml
hello:
  image: node:22
  rules:
    - if: $CI_PIPELINE_SOURCE == "trigger" && $ISSUE_ACTION == "open"
  before_script:
    - npm ci
  script:
    - npx flue run src/agents/hello.ts --message "Say hello to $ISSUE_AUTHOR"
```

Issue-event triggers: GitLab doesn't pass issue data into CI vars. Create pipeline trigger token (Settings > CI/CD > Pipeline trigger tokens), add project webhook on Issue events pointing at a relay that POSTs to `GITLAB_URL/api/v4/projects/${PROJECT_ID}/trigger/pipeline` with `{ token: TRIGGER_TOKEN, ref: 'main', variables }`. Variables: for `object_kind === 'issue'` → `ISSUE_ACTION` (from `object_attributes.action`), `ISSUE_IID`, `ISSUE_AUTHOR`; for `object_kind === 'note' && issue` → `ISSUE_ACTION: 'note'`, `ISSUE_IID`.
Triage pipeline: `image: node:22`, `timeout: 30 minutes`, same trigger rules, `npx flue run src/agents/triage.ts --message "Triage issue !$ISSUE_IID in project $CI_PROJECT_ID"`; agent env `local({ env: { GITLAB_TOKEN: process.env.GITLAB_TOKEN } })`.
CI/CD variables (masked): `ANTHROPIC_API_KEY` (LLM provider key), `GITLAB_API_TOKEN` (project/personal access token with `api` scope). Subagent + orchestration examples mirror GitHub Actions with `input: v.object({ issueIid: v.number() })`.

#### node

Platform: Node.js server built by Vite. `vite dev` serves locally (hot reload, auto-loads `.env`, shell-exported values win); `vite build` → `./dist/server.mjs` (Hono under the hood; port 3000 default, configurable via `PORT`; externalizes deps so `node_modules` needed at runtime; `.env` credentials NOT bundled).
Setup:
```bash
mkdir my-flue-server && cd my-flue-server
npm init -y
npm install @flue/runtime hono valibot
npm install -D @flue/vite @flue/cli vite
```
vite.config.ts: `plugins: [flue()]`. Scripts: `"dev": "vite dev"`, `"build": "vite build"`. `app.ts`: same routing table; `createAgentRouter(Translator)` is a pure router factory; per-agent middleware = plain Hono at mount before `app.route(...)`. Env: `.env` (e.g. `OPENAI_API_KEY="your-api-key"`), gitignore `.env`.
Run:
```bash
npx vite dev
# POST http://localhost:5173/agents/translator/demo-1 (202), GET same URL to read
npx vite build
set -a; source .env; set +a
node dist/server.mjs
PORT=8080 node dist/server.mjs
```
`vite preview` serves built app (production behavior). One-shot: `npx flue run src/agents/translator.ts --message "Translate to French: Hello world"`.
Deployed routes per mounted agent (relative to mount): `POST /:id` (202 admission), `GET /:id` (materialized history or live updates via Durable Streams), `POST /:id/abort` (abort in-flight and queued). No health endpoint by default — define in `app.ts`.
Harness tool example (Reporter): `useTool({ name: 'compile-report', input: v.object({ period: v.string() }), harness: true, async run({ harness, data }) { ... } })`; drive via `flue run`, `dispatch()`, or SDK. `local()` sandbox: cwd = `process.cwd()`, shell via `child_process`; built-in tools read/write/edit/grep/glob/bash; env opt-in via `local({ env: {...} })`; no second isolation layer.
Remote sandboxes: project-owned adapters installed from `flue add` blueprints; `flue add` with no args lists supported; `flue add sandbox <url>` builds an adapter against the Sandbox Adapter API. Catalog: Daytona, E2B, Modal, Vercel Sandbox. Persistence: default in-memory SQLite in built server (lost on restart); `vite dev` points default at local disk file; add `db.ts` for restart/replacement recovery; one live Node owner per agent instance even with shared DB.
Sandbox progression: empty virtual → virtual with shell setup → local (`local()`) → remote (per-session isolation).

#### railway

Platform: Railway standard service (Railpack auto-detect, zero config). Railway owns build/`PORT`/start/Postgres; Flue owns the server. Build command `npm ci && npx vite build`; start command `node dist/server.mjs`.
Config as code `railway.json`:
```json
{
  "build": { "builder": "RAILPACK", "buildCommand": "npm ci && npx vite build" },
  "deploy": { "startCommand": "node dist/server.mjs", "healthcheckPath": "/health", "restartPolicyType": "ON_FAILURE" }
}
```
Docker path: `build.builder: "DOCKERFILE"` (+ `build.dockerfilePath` if non-standard); root `Dockerfile` overrides Railpack; non-standard path via `RAILWAY_DOCKERFILE_PATH`.
Env: `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (authenticate provider calls), `MODEL_SPECIFIER` (optional default model). Seal the provider key (one-way). Leave `PORT` unset — Railway injects it; server binds `0.0.0.0` (defaults to `3000` only when unset); binding `0.0.0.0` is what lets Railway's proxy reach the service.
Persistence: Railway Postgres; reference variable `DATABASE_URL=${{Postgres.DATABASE_URL}}` (reference, not copied value); `npm install @flue/postgres`; full `db.ts` with real transaction (pool.connect / BEGIN / COMMIT / ROLLBACK / release). No active-active same-instance ownership. Health/streaming: `/health` must exist if `healthcheckPath` set, else deploy held back; without health check, deploy ready once process binds `PORT`. Streams via long-lived `GET`; edge proxy keeps active streams open. Going further: Cron Schedule POSTs `kind: 'signal'` (minimum 5-min interval, UTC, skip-if-active); queue-backed workers = second always-on service running `node dist/server.mjs`, no public port, using `dispatch(...)` + receipt `submissionId`.

#### render

Platform: Render web service (long-running). One-click templates: Flue template and Flue + Postgres template.
Blueprint `render.yaml`:
```yaml
services:
  - type: web
    name: flue-agents
    runtime: node
    plan: free
    buildCommand: npm ci && npx vite build
    startCommand: node dist/server.mjs
    healthCheckPath: /health
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
```
Auto-deploy per push: `autoDeployTrigger: commit` (replaces deprecated `autoDeploy`).
Free plan: spins down after 15 min without inbound traffic; next request pays ~1-min cold start; in-memory state lost across restart. Use `starter`+ and Postgres for sporadic production traffic. Env/secrets: built server doesn't load `.env`; secrets with `sync: false` (prompted on first deploy; Render ignores them on Blueprint updates — rotate from Dashboard); non-secrets can carry `value:` (e.g. `MODEL_SPECIFIER`). Same variable table as Railway.
Persistence with `fromDatabase`:
```yaml
databases:
  - name: flue-db
    plan: basic-256mb
# services[].envVars:
#   - key: DATABASE_URL
#     fromDatabase: { name: flue-db, property: connectionString }
```
`fromDatabase` gives internal (private-network) connection string. `@flue/postgres` + `db.ts` (full transaction shape). `free` Postgres expires 30 days after creation; use `basic-256mb`+.
Health/streaming: `/health` must be defined if `healthCheckPath` set. Render has no fixed idle timeout; requests run up to **100 minutes**; retain `streamUrl` + `offset` and resume rather than holding one blocking request; SIGTERM shutdown delay default 30s, up to 300s via `maxShutdownDelaySeconds`. Going further: cron job POSTs `kind: 'signal'` (at most one instance, 12-hour max run); `type: worker` service (no public port, `dispatch(...)` + `submissionId`).

#### sst

Platform: SST v3 (Ion engine) → AWS, Flue as persistent Fargate container service via `sst.aws.Service` (NOT Lambda — streaming needs long-lived `GET` + in-memory coordinator). Builds image from the Docker guide's `Dockerfile`; `vite build` → `dist/server.mjs`, started `node dist/server.mjs`.
Service (`sst.config.ts`):
```ts
new sst.aws.Vpc('FlueVpc');
const cluster = new sst.aws.Cluster('FlueCluster', { vpc });
new sst.aws.Service('Flue', {
  cluster,
  image: { context: '.', dockerfile: 'Dockerfile' },
  loadBalancer: { rules: [{ listen: '80/http', forward: '8080/http' }] },
});
```
`forward` port must match the Dockerfile's listen port. `sst deploy` builds image → ECR → cluster/service/ALB; service URL printed at end.
Secrets: Flue server reads plain `process.env`, not SST `Resource` SDK — pass through `environment`, not just `link`:
```ts
const apiKey = new sst.Secret('AnthropicApiKey');
new sst.aws.Service('Flue', {
  cluster,
  image: { context: '.', dockerfile: 'Dockerfile' },
  loadBalancer: { rules: [{ listen: '80/http', forward: '8080/http' }] },
  link: [apiKey],
  environment: { ANTHROPIC_API_KEY: apiKey.value, MODEL_SPECIFIER: 'anthropic/claude-sonnet-4-6' },
});
```
`bash: sst secret set AnthropicApiKey sk-...` (per stage).
Persistence (`sst.aws.Postgres`): `new sst.aws.Postgres('FlueDb', { vpc })`; `DATABASE_URL: $interpolate`...; `@flue/postgres` + `db.ts`; same VPC → private network. Health: ALB health check defaults to path `/`; define `/health` in `app.ts` and point check via `loadBalancer.health` keyed by `'port/protocol'` (`health: { '8080/http': { path: '/health' } }`), or container-level ECS health `{ command: ['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1'] }`. Raise ALB idle timeout for streams.
Going further: stages via `sst deploy --stage production`/`dev`; `sst secret set` scoped per stage; `sst remove --stage <name>`; multiple tasks need shared durable storage + instance-affine routing.

#### aws

Platform: AWS, running the Docker image from deploy/docker.md. Node target is a long-running HTTP server — container service, not Lambda. Lives in `sandboxes/` but is a DEPLOY doc (no sandbox adapter).
ECR push:
```bash
aws ecr create-repository --repository-name flue-agents
docker build -t flue-agents .
docker tag flue-agents:latest <account>.dkr.ecr.<region>.amazonaws.com/flue-agents:latest
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker push <account>.dkr.ecr.<region>.amazonaws.com/flue-agents:latest
```
Image binds `PORT` (8080); built server reads only start-time env (no `.env`); provider key + `DATABASE_URL` from platform secret store.
Option 1 — ECS Express Mode (recommended; managed Fargate + ALB + auto scaling, no extra charge):
```bash
aws ecs create-express-gateway-service \
  --service-name flue-agents \
  --execution-role-arn arn:aws:iam::<account>:role/ecsTaskExecutionRole \
  --infrastructure-role-arn arn:aws:iam::<account>:role/ecsInfrastructureRoleForExpressServices \
  --primary-container '{
    "image": "<account>.dkr.ecr.<region>.amazonaws.com/flue-agents:latest",
    "containerPort": 8080,
    "environment": [{ "name": "MODEL_SPECIFIER", "value": "anthropic/claude-sonnet-4-6" }]
  }' \
  --health-check-path /health \
  --scaling-target '{"minTaskCount":1,"maxTaskCount":4}' \
  --monitor-resources
```
- Execution role pulls image; secrets via task secrets from Secrets Manager / SSM Parameter Store; keep key + `DATABASE_URL` out of image.
- `--health-check-path` = ALB target-group path; Flue generates none — define `/health` in `app.ts`.
- `--scaling-target` sets `minTaskCount`/`maxTaskCount`; keep `minTaskCount ≥ 1`.
- Raise ALB target-group idle timeout for long-lived conversation `GET` reads; retain `streamUrl`/`offset`.
Option 2 — EC2 (simplest, full control):
```bash
docker run -d --restart unless-stopped -p 80:8080 \
  -e ANTHROPIC_API_KEY=sk-... -e MODEL_SPECIFIER=anthropic/claude-sonnet-4-6 \
  <account>.dkr.ecr.<region>.amazonaws.com/flue-agents:latest
```
Or systemd unit: `WorkingDirectory=/opt/flue-agents`, `ExecStart=/usr/bin/node dist/server.mjs`, `Environment=PORT=8080`, `EnvironmentFile=/etc/flue-agents.env`, `Restart=always`. Secrets via `EnvironmentFile` (mode 600) or `docker run -e`, or SSM Parameter Store on boot. Nothing checks the process — point ALB/watcher at `/health`. Security group must open listening port; terminate TLS at reverse proxy/ALB; Node speaks plain HTTP.
Option 3 — ECS on Fargate: task definition references ECR image; `secrets` (each `{ "name", "valueFrom" }`) resolve Secrets Manager ARNs/SSM via task execution role; with `awsvpc` networking the target group must use **IP** target type; health check `/health`; open task security group to ALB; `healthCheckGracePeriodSeconds` longer than server startup; Application Auto Scaling adjusts desired task count.
Persistence: Amazon RDS for PostgreSQL in the service's VPC; `@flue/postgres` + `db.ts`; store connection string in Secrets Manager → `DATABASE_URL`. Shared storage = replacement recovery only, no active-active.
Not Lambda: Flue does not target Lambda; function platforms like Vercel/Netlify out of scope.

### Sandboxes

Sandbox adapter API: `flue add sandbox <name>` installs a project adapter; `flue add` with no args lists supported. Adapters wrap an app-owned provider resource into a `SandboxFactory` via `sandboxFromDriver` (from `@flue/runtime`). Generated files live at `<source-root>/sandboxes/<name>.ts` with marker `// flue-blueprint: sandbox/<name>@1`. Most providers require application-owned lifecycle (create/reuse/delete VM).

#### boxd

Provider: boxd (boxd.sh). Blueprint: `flue add sandbox boxd` — installs `@boxd-sh/sdk` when needed; creates `sandboxes/boxd.ts`. Adapter does NOT create/retain/delete the VM.
Generated: `export function boxd(box: BoxdBox, options?: BoxdAdapterOptions): SandboxFactory` where `BoxdAdapterOptions = { cwd?: string; readyTimeoutMs?: number }`. Imports `Box as BoxdBox` from `@boxd-sh/sdk`. Default cwd `/home/boxd`, `readyTimeoutMs` default `30_000` (polls `box.exec(['true'])` until ready). File ops via direct reads/writes; stat/readdir/mkdir/rm via quoted shell utilities; exec via `bash -lc`, forwards env + timeoutMs unchanged.
Env: `BOXD_API_KEY` (authenticates when short-lived token not used) or `BOXD_TOKEN` (provider-supported short-lived auth). One boxd credential required.

#### cloudflare-computer

Provider: Cloudflare Computer (`@cloudflare/computer`). Wraps a `Workspace` — durable SQLite-backed virtual filesystem in the agent's own Durable Object — into a Flue sandbox on the Cloudflare target. Commands run via worker-shell backend (just-bash in a Dynamic Worker); full standard tool set, no container. Early preview — not production.
Blueprint: `flue add sandbox cloudflare-computer` — creates `sandboxes/cloudflare-computer.ts`. Wrangler additions (only two; no API keys/env vars):
```jsonc
{ "compatibility_flags": ["nodejs_compat", "experimental"], "worker_loaders": [{ "binding": "LOADER" }] }
```
Worker Loader binding beta-gated. `cloudflare.ts` re-exports `WorkspaceServiceProxy`; each sandbox-using agent re-exports the generated `workspaceHost` extension (`export { workspaceHost as cloudflare } ...`) so its DO hosts the workspace.
Generated exports: `workspaceHost` (`extend({ base: ... })` from `@flue/runtime/cloudflare`), `getComputerWorkspace(options)` (memoized DO storage + git client + `WorkerShellBackend` from `@cloudflare/computer/backends/worker-shell`), and `getComputerSandbox(options): SandboxFactory` — `createSandbox()` does `workspace.fs.mkdir('/workspace', { recursive: true })`; no `tools` override (exec works, standard set applies). Imports `createGitClient` from `@cloudflare/computer/git`.
Agent wiring:
```ts
'use agent';
import { env } from 'cloudflare:workers';
import { getComputerSandbox } from '../sandboxes/cloudflare-computer';
export { workspaceHost as cloudflare } from '../sandboxes/cloudflare-computer';
export function Assistant() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  useSandbox(getComputerSandbox({ loader: env.LOADER }));
  return 'You explore and edit your durable workspace with the standard file and shell tools.';
}
```
Hydration: `getComputerWorkspace(...)` or `computerWorkspace(harness.sandbox)` → `workspace.git` (clones/commits), `workspace.fs` (out-of-band IO); `workspace` option reshapes `WorkspaceOptions` (read-only R2 mounts, `defaultGitIdentity`, observer, additional backends). Import helpers from the project adapter file, not `@flue/runtime/cloudflare`.
Choose when: durable files in agent's own DO; no container; ~10 GB cap (shares DO SQLite storage); survives DO restarts. NOT a Linux box (JS shell, no native binaries/package managers); full-Linux via `CloudflareContainerBackend`; for language toolchains use Cloudflare Sandbox.

#### cloudflare

Provider: Cloudflare Sandbox (`@cloudflare/sandbox`), platform-native container-backed Linux — NOT an adapter module for Node target. A Node-targeted project must migrate to the Cloudflare target first.
Blueprint: `flue add sandbox cloudflare` — installs `@cloudflare/sandbox`, exports `Sandbox` from source-root `cloudflare.ts`, adds DO binding + migration entry + container declaration to `wrangler.jsonc`, creates project-root `Dockerfile` with image tag matching installed package version.
Generated usage:
```ts
'use agent';
import { env } from 'cloudflare:workers';
import { cloudflareSandbox } from '@flue/runtime/cloudflare';
import { getSandbox } from '@cloudflare/sandbox';
interface Env { Sandbox: DurableObjectNamespace; }
export function CodingAgent({ id }: AgentProps) {
  useModel('anthropic/claude-opus-4-7');
  const { Sandbox } = env as unknown as Env;
  useSandbox(cloudflareSandbox(getSandbox(Sandbox, id)));
}
```
`useSandbox(cloudflareSandbox(getSandbox(Sandbox, id)), { cwd: '/workspace' })` variant. Sandbox keyed by agent instance `id`. Cloudflare's direct delete API lacks recursive/force controls → `cloudflareSandbox()` implements them by running `rm` in the container.
Requirements: Cloudflare target, `@cloudflare/sandbox`, container image, DO/container binding (via Wrangler platform config, not env var), stable sandbox identity + retention policy. Environment-variable credentials not required.
Choose when: needs git, package installation, native binaries, Linux tooling. Prefer Cloudflare Computer when a durable workspace suffices.

#### daytona

Provider: Daytona (daytona.io). Blueprint: `flue add sandbox daytona` — installs `@daytona/sdk` when needed; creates `sandboxes/daytona.ts`. Does not choose image/identity/retention/cleanup.
Generated: `export function daytona(sandbox: DaytonaSandbox): SandboxFactory`. Imports `Sandbox as DaytonaSandbox` from `@daytona/sdk`. cwd = `(await sandbox.getWorkDir()) ?? '/home/daytona'`. File ops via `sandbox.fs`; exec via `executeCommand()`, rounding `timeoutMs` up to whole seconds; recursive deletion supported but `force` rejected before deletion.
Env: `DAYTONA_API_KEY` — Required — authenticates with the Daytona API. `@daytona/sdk` Required; application-owned lifecycle Required.
Typical use:
```ts
import { Daytona } from '@daytona/sdk';
import { daytona } from '../sandboxes/daytona';
export function Assistant() {
  useModel('anthropic/claude-sonnet-4-6');
  useSandbox({
    async createSandbox(options) {
      const client = new Daytona({ apiKey: env.DAYTONA_API_KEY });
      const sandbox = await client.create();
      return daytona(sandbox).createSandbox(options);
    },
  });
}
```
Configure images/snapshots/regions/env vars/volumes through the SDK; `cwd` on `useSandbox(...)` narrows working directory (resolved once during `init()`).

#### e2b

Provider: E2B (e2b.dev). Blueprint: `flue add sandbox e2b` — installs `e2b` when needed; creates `sandboxes/e2b.ts`. Does not create/retain/close provider resources.
Generated: `export function e2b(sandbox: E2BSandbox): SandboxFactory`. Imports `Sandbox as E2BSandbox` from `e2b`. cwd = `/home/user`. File ops via `sandbox.files`; exec via `sandbox.commands.run()`, forwarding `timeoutMs` unchanged; recursive or force rejected before `sandbox.files.remove()`; reports only metadata E2B exposes.
Env: `E2B_API_KEY` — Required — authenticates with the E2B API. `e2b` package Required; provider-managed Linux sandbox Required; application-owned lifecycle Required (create + close/retain).
Typical use: `const sandbox = await Sandbox.create(); return e2b(sandbox).createSandbox(options);` inside `useSandbox({ createSandbox(options) { ... } })`.

#### exedev

Provider: exe.dev. Adapter uses SSH for commands + SFTP for files; depends on Node APIs and `ssh2` — Node target only, not Cloudflare.
Blueprint: `flue add sandbox exedev` — installs `ssh2` + its TS declarations; creates `sandboxes/exedev.ts`. Generated Node adapter uses SSH/SFTP for an existing VM + optional helpers for explicit VM creation, cloning, readiness checks, deletion.
Generated: `export function exedev(vm: ExeDevVm | string, options?: ExeDevAdapterOptions): SandboxFactory` — `typeof vm === 'string'` → `{ host: vm }`. Also exports `class ExeDevSandboxDriver implements SandboxDriver` with `exec(command, options?: { cwd?, env?, timeoutMs?, signal? })` → `{ stdout, stderr, exitCode }`. On `createSandbox()`: `sshConnect(resolvedVm, options ?? {})`, detect home dir via `exec('echo $HOME')` (fallback `/home/user`). `timeoutMs` stays ms and closes the SSH command stream at deadline → exit code `124`. File removal via SFTP directly; recursive/force rejected before mutation.
Env: `EXE_VM_HOST` (Required — identifies the VM), `EXE_SSH_KEY` (Optional — private SSH key file path), `SSH_AUTH_SOCK` (Optional — SSH agent auth instead of key), `EXE_API_TOKEN` (Required for lifecycle examples). Requirements: Node.js target, `ssh2`, existing SSH-reachable VM, SSH configuration.

#### islo

Provider: islo (islo.dev). Adapter invokes the local `islo` CLI; for Node server/container/CI runner with the binary installed. Not for Cloudflare Workers (no native child processes).
Blueprint: `flue add sandbox islo` — creates `sandboxes/islo.ts`; NO npm dependency added. Uses Node `child_process.spawn`; expects authenticated `islo` binary + application-managed sandbox name.
Generated: `export function islo(name: string, options?: IsloAdapterOptions): SandboxFactory` where `IsloAdapterOptions = { cwd?: string; cliPath?: string }` (default cliPath `'islo'`, default cwd `/workspace`). `exec()` builds a `timeout <s>` prefix from `timeoutMs/1000`, spawns `['--output', 'json', 'use', this.name, '--', 'bash', '-lc', remote]`; converts `timeoutMs` ms → seconds for GNU `timeout` inside sandbox.
Env: `ISLO_API_KEY` — Alternative authentication — when existing CLI auth unavailable. Requirements: existing CLI auth or API key, Node child-process capability, `islo` binary on PATH, named islo sandbox.

#### mirage

Provider: Mirage (docs.mirage.strukto.ai). Adapter wraps an application-owned Mirage `Workspace`. Runtime packages for Node AND browser-class runtimes (Node or Cloudflare with compatible resources).
Blueprint: `flue add sandbox mirage` — installs `@struktoai/mirage-node` (Node) or `@struktoai/mirage-browser` (Cloudflare) when needed; creates `sandboxes/mirage.ts`.
Generated: `export function mirage(workspace: MirageWorkspace, options?: MirageAdapterOptions): SandboxFactory` (`MirageAdapterOptions = { cwd?: string }`, default cwd `/`). Imports `Workspace as MirageWorkspace` from `@struktoai/mirage-core`. `createSandbox({ id })` calls `workspace.createSession(id)` (falls back to `getSession(id)`); session keyed by Flue context id. `stat()` maps `s.type === 'file'/'directory'`, omits `size`/`mtime` when null. `exec()` → `workspace.execute(command, { sessionId, cwd, env, signal })`; timeout via `AbortSignal.timeout(timeoutMs)` composed with caller signal via `AbortSignal.any([...])`; timeout only → exit code `124` with stderr `[flue:mirage] Command timed out after ... milliseconds.`; caller abort rethrows. `rm` rejects recursive/force before mutation.
Requirements: `@struktoai/mirage-node` on Node.js, `@struktoai/mirage-browser` on Cloudflare (browser-compatible Workspace resources only), application-owned resource configuration (mounts, credentials, writable boundaries, lifetime). Environment-variable credentials not required. SSH-/database-oriented Node resources must not be imported into a Cloudflare build.

#### modal

Provider: Modal (modal.com). Blueprint: `flue add sandbox modal` — installs `modal` SDK when needed; creates `sandboxes/modal.ts`. Provisioning, image selection, credentials, shutdown outside the adapter.
Generated: `export function modal(sandbox: ModalSandbox, options?: ModalAdapterOptions): SandboxFactory` (`ModalAdapterOptions = { cwd?: string }`, default cwd `/`). Imports `Sandbox as ModalSandbox` from `modal`. Adapts Modal open/read/write handles (closes every opened file); stat/readdir/mkdir/rm via quoted shell utilities; exec via `bash -lc`, forwards `timeoutMs`, drains both output streams. `stat` parser supports GNU and BusyBox output; `rm` receives recursive + force flags. Selected image must provide `bash` + compatible filesystem utilities.
Env: `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` — Required without `~/.modal.toml`. Requirements: `modal` package, Node.js 22 or later, suitable Modal image.

#### vercel

Provider: Vercel Sandbox (vercel.com/sandbox). Blueprint: `flue add sandbox vercel` — installs `@vercel/sandbox` when needed; creates `sandboxes/vercel.ts`. Auth, runtime selection, retention, cleanup app-owned.
Generated: `export function vercel(sandbox: VercelSandbox): SandboxFactory`. Imports `Sandbox as VercelSandbox` from `@vercel/sandbox`. cwd = `/vercel/sandbox`. `stat()` maps full `sandbox.fs.stat` (`isFile()`, `isDirectory()`, `isSymbolicLink()`, `size`, `mtime`). `exec()` → `sandbox.runCommand({ cmd: 'bash', args: ['-c', command], cwd, env, signal })`, drains `response.stdout({signal})`/`stderr({signal})`, `exitCode: response.exitCode`; timeout via `AbortSignal.timeout(timeoutMs)` composed via `AbortSignal.any([...])`; only timeout cancellation → exit code `124`, stderr `[flue:vercel] Command timed out after ... milliseconds.`; caller abort rethrows.
Env: `VERCEL_OIDC_TOKEN` — Required for OIDC auth — injected automatically on Vercel; set explicitly when using OIDC locally. Requirements: Vercel-supported authentication, `@vercel/sandbox`, application-owned lifecycle.
Typical use: `const sandbox = await Sandbox.create({ runtime: 'node24' }); return vercel(sandbox).createSandbox(options);` inside `useSandbox({ createSandbox(options) { ... } })`; imports `Sandbox` from `@vercel/sandbox`, `vercel` from `../sandboxes/vercel`.

### Tooling

#### braintrust

Integration: Braintrust. Blueprint: `flue add tooling braintrust`. Installs Braintrust **3.17**; creates source-root `braintrust.ts`, imported once from `app.ts`. Same module runs on Node and Cloudflare (Braintrust `workerd` export; no separate Cloudflare package or DO wrapper — unlike Sentry). Runs when API key present; else no init/subscribe, app continues without export.
Generated module: `if (process.env.BRAINTRUST_API_KEY) { initLogger({ projectName: process.env.BRAINTRUST_PROJECT_NAME ?? 'Flue', apiKey: process.env.BRAINTRUST_API_KEY }); observe((event, ctx) => { ... braintrustFlueObserver(compatible, ctx); }); }` — imports `observe` from `@flue/runtime`, `braintrustFlueObserver, initLogger` from `braintrust`. `compatibleEvent(...)` translates Flue tool/recovery events for installed version (Braintrust 3.17 expects previous `tool_call` name for terminal tool events; re-check before upgrading). Node import hook exists for auto-instrumentation but the generated manual observer is the portable path.
Env: `BRAINTRUST_API_KEY` (Required for trace export), `BRAINTRUST_PROJECT_NAME` (Optional; defaults to `Flue`). Never commit the key; on Cloudflare store as Worker secret, not Wrangler `vars`.
What it traces: prompt/skill/compaction → `flue.<kind>` task span; model turn → `llm:<model>` span (token usage + estimated cost); tool call → nested `tool:<name>` span; delegated task → nested task span; compaction → nested compaction span. Traces retain agent instance, session, operation, optional `submissionId`. Content-bearing: `setMaskingFunction(...)` before init when redaction needed. Cloudflare delivery caveat: async flush; observers can't attach final upload to DO execution lifetime → best-effort delivery, may lose final spans when isolate idles immediately after work; Node uses process-exit flush fallback.

#### jetty

Integration: Jetty (grading / evals). **No `flue add` blueprint.** Install: `pnpm add @jetty/sdk`. Follow Jetty's Flue integration guide (docs.jetty.io/docs/agent-integrations/flue) to create/deploy a grading runbook, then call the SDK from a workflow script. Grades Flue agent output; stores the grading task as a trajectory; labels record score/pass-fail/config for cross-version comparison.
Key APIs: `start({ agents: [...] })` from `@flue/runtime/node` (starts runtime in-process); `init(Triage, { id })` + `agent.dispatch(ticket)` + `agent.read(receipt)` from `@flue/runtime`; `gradeWithJetty<T>(jetty, collection, gradeTask, opts)` + `JettyClient` from `@jetty/sdk`. Runbook must produce the `grade.json` file `gradeWithJetty(...)` expects. Keep grader separate from evaluated agent.
Env: `JETTY_API_TOKEN` (Required — SDK can also read `~/.config/jetty/token`), `JETTY_COLLECTION` (Required — collection owning the grading task), `JETTY_GRADE_TASK` (Required — deployed grading task), `JETTY_USE_TRIAL_KEYS` (Optional — `true` uses Jetty's trial model keys).
Agent needs its own model-provider credentials. `@jetty/sdk` + `start()` both require Node.js. To grade a deployed agent (incl. Cloudflare target): prompt over HTTP with the Agent SDK, pass reply to same `gradeWithJetty(...)` from any Node process. Verify: `node scripts/evaluate-triage.ts "Summarize this support request."`.

#### opentelemetry

Integration: OpenTelemetry. Package: `@flue/opentelemetry` (+ `@opentelemetry/api`). Projects Flue runtime observations into standard OTel GenAI spans/metrics; does NOT configure SDK/exporter/sampling/credentials/flushing. Implements Development GenAI conventions pinned at commit `4c8addb53718b544134be47e256237026fe88875`; Flue-to-GenAI projection revision `5`; Flue extension revision `4`; constants live in `@flue/runtime/telemetry`, shared with `createCloudflareTracing`. Revision changes require explicit compatibility review.
Setup:
```sh
pnpm add @flue/opentelemetry @opentelemetry/api
```
```ts
import { createOpenTelemetryInstrumentation } from '@flue/opentelemetry';
import { instrument } from '@flue/runtime';
const instrumentation = createOpenTelemetryInstrumentation();
const disposeInstrumentation = instrument(instrumentation);
```
Configure SDK first, then register one instrumentation instance. Generated Node apps auto-dispose registrations created while evaluating `app.ts` after admissions and active work drain; call `await disposeInstrumentation()` yourself only outside that lifecycle; flush/shutdown SDK/exporter separately.
Trace model: prompt/skill → `invoke_agent <agent>`; delegated task → one task-owned `invoke_agent <agent>`; provider inference → `chat <requested-model>` client span; GenAI tool execution → `execute_tool <name>`; caller shell execution → `flue.operation shell`; context compaction → `flue.compaction` with child chat spans. `request.providerName` → `gen_ai.provider.name`. Local tools = sibling spans under agent invocation, correlated via `gen_ai.tool.call.id`. `gen_ai.conversation.id` = one persisted Flue session. Flue correlation under `flue.*` attributes.
Content control (content ON by default — explicit `instrument(...)` call is consent; deviates from OTel env-var opt-in):
```ts
const instrumentation = createOpenTelemetryInstrumentation({ content: false }); // content-free spans
// or a policy via content.transform(content, scope); undefined omits; throwing transform emits [flue] sentinel
```
`transform` runs once per content type. `truncateContent(content, { maxBytes })` exported. After transform: **56 KiB per-span content budget enforced in-band** (single shared pool); payloads stay valid JSON; oldest messages drop first behind `role: "flue"` sentinel; oversized strings cut with `[flue:truncated, …]` suffix; no side-channel marker attributes — search for `[flue]`. Object-shaped tool args/results use `gen_ai.tool.call.*`; other shapes use `flue.tool.call.arguments`/`flue.tool.call.result`.
Metrics and Logs: client-operation, token-usage, agent-invocation, tool-duration histograms; dimensions exclude execution IDs (watch agent/tool/provider/model name cardinality); input token totals include cache-read + cache-creation. Logs need explicit Logger injection; failed inference emits `gen_ai.client.operation.exception` at WARN/13; error type always recorded, messages/stack trace through content gate. Propagation: validates + persists `traceparent` + optional `tracestate` at direct-agent admission; baggage NOT persisted; `dispatch(...)` does NOT currently propagate trace context. Recovery does not replay provider/tool execution; stored stream chunks create no chat spans/usage; synthetic interrupted-tool repairs create no `execute_tool` spans.
Limitations: no authoritative raw provider stream-item timing → omits time-to-first-chunk / time-per-output-chunk metrics. Unsupported: no invented spans for agent creation, planning, embeddings, retrieval, memory ops, remote agent clients, evaluations.

#### sentry

Integration: Sentry. Blueprint: `flue add tooling sentry`. Creates source-root `sentry.ts`, imported once from `app.ts`. Three signals sharing one trace per conversation: terminal failures as issues, every `log.*` call as Sentry Logs, and (when `SENTRY_TRACES_SAMPLE_RATE > 0`) Flue's `invoke_agent` → `chat`/`execute_tool` span hierarchy with token usage, following OTel GenAI conventions. Blueprint installs `@sentry/node` **or** `@sentry/cloudflare` plus `@flue/opentelemetry`; registers event bridge + span instrumentation through `instrument(...)`.
Node core: `Sentry.init({ dsn: process.env.SENTRY_DSN, enabled: Boolean(process.env.SENTRY_DSN), tracesSampleRate, traceLifecycle: 'stream', streamGenAiSpans: true, enableLogs: true, integrations: (defaults) => defaults.filter((i) => !SENTRY_AI_PROVIDER_INTEGRATIONS.has(i.name)) })`; then `instrument(createOpenTelemetryInstrumentation({ content: contentPolicy() }))` when `tracesSampleRate > 0`, plus an `instrument({ key: Symbol.for('flue.sentry.bridge'), observe, dispose })` bridge. Sentry owns the global OTel tracer provider. `key: Symbol.for('flue.sentry.bridge')` ensures dev reloads replace rather than stack.
Cloudflare: same bridge/instrumentation without `Sentry.init()`; blueprint adds a module-local `cloudflare` extension to every agent wrapping the final generated DO class with `instrumentDurableObjectWithSentry(...)` (initializes SDK per isolate; outer Worker left uninstrumented). Do NOT use `@sentry/node` on Cloudflare.
Env: `SENTRY_DSN` (Required for event delivery), `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` (Optional), `SENTRY_TRACES_SAMPLE_RATE` (0 to 1; 0 default = errors + logs only; above 0 adds AI traces), `SENTRY_AI_RECORD_INPUTS` (true includes prompts/instructions/tool definitions in spans), `SENTRY_AI_RECORD_OUTPUTS` (true includes model output/tool results/exception messages). Only `SENTRY_DSN` needed. DSN permits submission but not read access.
Reports: Issues = `operation` events with `isError: true` + `submission_settled` events with `outcome: 'failed'` not already captured (one failure → one issue); Logs = every `log.info`/`log.warn`/`log.error` at own level (error logs are logs, not issues); Traces = Flue OTel span hierarchy, sampled; Sentry's own AI provider integrations suppressed to avoid double-counting. Captures include `flue.*` correlation tags. With record flags off, spans carry timing/token usage/model identifiers/correlation ids but no content; a record flag routes that direction's content through a scrubbing transform with a **16 KiB per-attribute budget**. Target behavior: Node — module-scoped init sufficient; full HTTP/db auto-instrumentation needs Sentry preload setup before application imports; shutdown flushing best-effort. Cloudflare — `wrap` extension preserves Flue routing/durability; wrapper does NOT cover outer Worker or authored Hono app (add HTTP middleware separately).

#### vitest-evals

Integration: vitest-evals (vitest-evals.sentry.dev). Blueprint: `flue add tooling vitest-evals` — guides installing test deps, creating a dedicated eval config, adapting Flue's public SDK to a `vitest-evals` harness, writing a starter case. Evaluates the same public HTTP boundary a deployed app uses (not Flue runtime internals). Adds eval harnesses, judges, normalized reports, CI reporting to Vitest.
Harness behavior: prompts a mounted agent conversation via `@flue/sdk` (`createFlueClient({ url })`); fresh conversation id per eval case; captures prompt event sequence via server-provided offset + submission ID; records response text, model usage, costs, tool calls in normalized eval result; supports local servers + deployed apps via `FLUE_BASE_URL`. Does NOT mount an agent automatically — confirm `app.ts` mounts it with `createAgentRouter(...)` and appropriate auth middleware.
Run:
```sh
pnpm exec vite dev     # terminal 1 (needs normal model-provider credentials)
pnpm run evals         # terminal 2
FLUE_BASE_URL=https://preview.example.com pnpm run evals  # evaluate a deployment
```
Configure token/request headers in SDK client for protected targets. Never commit provider/application credentials.
Reports: `pnpm exec vitest-evals serve vitest-results.json` opens the JSON report; same artifact publishable via the `getsentry/vitest-evals` GitHub Action. Reports can contain prompts, outputs, tool arguments/results, errors, app metadata — review retention/access. `vitest-evals` has no Braintrust reporter; Flue's Braintrust integration can trace independently but doesn't replace eval cases/assertions/judges/CI gates.

### Cross-cutting

Sandbox env vars by provider: boxd `BOXD_API_KEY`/`BOXD_TOKEN`; Cloudflare Computer none (Wrangler `worker_loaders` + `experimental`); Cloudflare Sandbox none (Wrangler bindings/containers); Daytona `DAYTONA_API_KEY`; E2B `E2B_API_KEY`; exe.dev `EXE_VM_HOST`, `EXE_SSH_KEY` (opt), `SSH_AUTH_SOCK` (opt), `EXE_API_TOKEN` (lifecycle); islo `ISLO_API_KEY` (alt auth); Mirage none (app-configured); Modal `MODAL_TOKEN_ID`+`MODAL_TOKEN_SECRET` (unless `~/.modal.toml`); Vercel `VERCEL_OIDC_TOKEN` (OIDC).
Blueprint commands: `flue add sandbox boxd` / `cloudflare-computer` / `cloudflare` / `daytona` / `e2b` / `exedev` / `islo` / `mirage` / `modal` / `vercel`; `flue add tooling braintrust` / `sentry` / `vitest-evals`. Jetty has NO blueprint (`pnpm add @jetty/sdk`). OpenTelemetry has NO blueprint (`pnpm add @flue/opentelemetry @opentelemetry/api`). Adapter markers: `// flue-blueprint: sandbox/<name>@1`.
Common build/start: Node target → `npx vite build` (with `flue()` plugin) → `dist/server.mjs` → `node dist/server.mjs`; port `PORT` (default 3000, Docker image uses 8080). Cloudflare target → `npx vite build && npx wrangler deploy`. CI (`flue run`) → no build/port: `npx flue run <module> --message "<msg>" [--json] [--id <id>]`.
Shared provider-key envs: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, optional `MODEL_SPECIFIER`. All Node-target built servers read only start-time env (no `.env` in production).
Persistence (`db.ts`): `npm install @flue/postgres`; `postgres({ query, transaction, close })` wrapping a `pg` `Pool` reading `process.env.DATABASE_URL`; discovered at build time; one live owner per agent instance (no active-active). Full transaction shape (Railway/Render): `pool.connect()` → `client.query('BEGIN')` → `await fn({ query })` → `COMMIT`/`ROLLBACK` → `client.release()`.
Health: Flue generates no `/health` route on any target — must be defined in `app.ts` for Fly checks, Railway `healthcheckPath`, Render `healthCheckPath`, ALB (Express/Fargate), SST loadBalancer health.
## API Reference

Condensed from the `docs/reference` pages. Symbol surface: `@flue/runtime` (+ `/node`, `/routing`, `/tool`, `/cloudflare`, `/cloudflare/workers-ai`, `/adapter`); SDK wire envelope matches `@flue/sdk` errors.

### 01-configuration.md

Two authoring surfaces + one programmatic module: `flue.config.ts` (optional file), inline options to `flue()` (Vite plugin, merged over the file per field), and `@flue/runtime/config` (discovery/validation/resolution for hosts & tooling). Two consumers: the `flue()` Vite plugin (`vite dev`/`build`/`preview`) and `flue run`.

#### `flue.config.ts`
- Optional; every field optional; **the configuration must be the module's default export** — otherwise `[flue] <file> must export a config object as the default export.` `defineConfig(config)` from `@flue/runtime/config` returns the config unchanged (type-checking only); a plain object default export is equally valid.
- **File discovery** — searched in the project root (Vite root for the plugin, working directory for `flue run`), basename priority: `flue.config.ts` → `.mts` → `.mjs` → `.js` → `.cjs` → `.cts` (first hit wins). Several coexisting → the plugin logs `[flue] Multiple Flue config files found (…); using <basename>.`; `flue run` selects silently. No option points at a differently named file (except programmatic `resolveFlueConfigPath`).
- **Module evaluation** — Node's native dynamic `import()`, cache-busted every load, not through Vite (no aliases/plugins/transforms; every import must resolve by Node). Node ≥ 22.19 or ≥ 23.6 required for `.ts` (older → `[flue] Cannot load <file>: this Node (v…) does not support TypeScript natively.`). Only erasable TS syntax: `enum`, runtime `namespace`, parameter properties, decorators fail.
- **Validation** — unknown field = error (`flue run` is the exception: drops unknown keys); non-object → `[flue] <source> must be a config object.`; field-level failures reported together as `[flue] Invalid config in <source>:` one line per field.

#### `FlueConfig` fields (exported from `@flue/runtime/config`)
```ts
interface FlueConfig {
  target?: 'node' | 'cloudflare';
  app?: string;
  db?: string;
  cloudflare?: string;
  agents?: string;
  providers?: string[];
  tracing?: boolean;
}
```
- `target` — default unset; the plugin then auto-detects from the Vite plugin array (explicit value overrides). `flue run` ignores it (always Node-local).
- `app` — path to the route-map entry; default = `app.{ts,mts,js,mjs}` lookup under the source root; missing → `vite dev`/`build` fail `[flue] No app entry found. …`; explicit missing path → `` [flue] Configured `app` entry not found: <path> ``. Relative values resolve from the config file's directory.
- `db` — persistence entry (`db.ts`), Node target only; same resolution/existence rules; on Cloudflare a resolved `db` entry is a hard error: `[flue] Custom persistence (db.ts) is not supported on the Cloudflare target. …` (DO SQLite instead).
- `cloudflare` — `cloudflare.ts` non-HTTP handlers entry; same rules; consumed only on the Cloudflare target (inert on Node).
- `agents` — glob narrowing the `'use agent'` scan (e.g. `'agents/**/*.ts'`), relative to the source root; default = whole source root recursively `**/*.{ts,mts,js,mjs}`; always restricted to those extensions; `node_modules/`, `dist/`, `output/`, `.wrangler/` always excluded, dot-directories never matched. `flue run` ignores it (explicit module path, no scan).
- `providers` — provider IDs registered at server start; each becomes a `@earendil-works/pi-ai/providers/<id>` factory import in the generated entry (`'cloudflare'` selects Flue's own Workers AI binding provider instead), so only the listed providers ship. Default unset = every built-in (Workers AI binding included on Cloudflare). Exhaustive list: Cloudflare `cloudflare/...` models require `'cloudflare'` in it; `'cloudflare'` on the Node target is a config error. IDs validated lowercase alphanumerics + dashes; unknown IDs fail the build. `setProvider()` in `app.ts` is unaffected and a user registration always wins over a listed provider of the same ID. `flue run` ignores it (always full built-in set).
- `tracing` — Cloudflare-only agent tracing (the built-in `createCloudflareTracing()` install); default on (no-op until Workers Traces is enabled); `false` drops it from the build; an explicit `instrument(createCloudflareTracing(...))` at `app.ts` scope replaces the built-in regardless.

#### Entry-path resolution
- **Source root** — `<root>/.flue` when it exists as a directory, else `<root>/src`, else `root`.
- **Default entry lookup** — `<sourceRoot>/<field>.<ext>`, extension order `ts`, `mts`, `js`, `mjs`; a missing default entry isn't an error at resolution time (whether required is the consumer's call: `app` is required by `vite dev`/`vite build`, nothing by `flue run`/`vite preview`).
- **Explicit paths** — resolve from the config file's directory (project root when the value came only from inline `flue()` options) and must exist.

#### The `flue()` Vite plugin
```ts
import { flue } from '@flue/vite';
function flue(config?: FlueConfig): Plugin[];
```
Returns an array of plugins; the core plugin is named `flue`; adding `flue()` twice is an error. Resolution order: (1) validate inline options (failures name `inline flue() options`); (2) discover + load `flue.config.*` from the Vite root; (3) merge inline over file per field (a defined inline field wins; `undefined` falls through; scalars only — no deep merge); (4) resolve layout and, outside preview, run the `'use agent'` scan. If another plugin changes `root` after `flue()` resolves, config resolution fails — set `root` in the Vite config itself.

**Target detection** (effective order): merged `target` field → `'cloudflare'` when `@cloudflare/vite-plugin` is in the resolved plugin array → `'node'`. Cloudflare wiring validated at config-resolution time, each a distinct error: `target: 'cloudflare'` without the plugin; `cloudflare()` listed before `flue()`; the plugin present but not visible as a plain `plugins` entry (wrapped in a Promise / injected); `cloudflare()` without `config: flueWorkerConfig()`.

**Vite config set by the plugin** — every target/mode: `appType: 'custom'`, and `@flue/runtime` + `hono` deduped to one copy per module graph. Node `vite build` forces `build.ssr: true`, `build.target: 'node22'`, the two-entry rolldown input (`server.mjs` + non-listening `app.mjs`), `.mjs` entry/chunk names, ESM output; Node builtins, package deps, and Flue's optional native deps stay external. User values at forced paths are overridden with a warning, not an error. The user keeps: `build.outDir` (default `'dist'`; resolving to/containing the project or source root is rejected — the build empties it), `build.sourcemap` (default `true`), `build.emptyOutDir`. `vite dev`/`preview` default `server.cors`/`preview.cors` to a localhost-only credentialed policy exposing the durable-stream coordination headers (`Stream-Next-Offset`, `Stream-Up-To-Date`, `Location`); deployed servers apply no CORS. Node `vite dev` loads the `.env` set into `process.env` (shell-wins), matching `flue run`; Cloudflare dev variables (`.dev.vars`) belong to the Cloudflare plugin. The Cloudflare target imposes no build configuration.

**Virtual modules** (6; resolvable only inside plugin-owned graphs): `virtual:flue/app` (required), `virtual:flue/db` (or a stub exporting `undefined` → built-in default adapter), `virtual:flue/agents` (scanned set), `virtual:flue/providers` (registration), `virtual:flue/server` (Node bootstrap), `virtual:flue/worker` (generated Worker entry; one DO class per agent).

**`FlueVitePluginApi`** (from `@flue/vite`) — exposed on the core plugin's `api` field: `readonly resolved: FlueResolvedProjectInfo | undefined` = `{ config, configPath, project: ResolvedFlueProject, target, agents: AgentScanResult[] }`; `undefined` until Vite config resolution completes; `agents` is live in dev.

#### `flueWorkerConfig()`
```ts
import { flue, flueWorkerConfig } from '@flue/vite';
plugins: [flue(), cloudflare({ config: flueWorkerConfig() })]
```
Worker-config customizer; must be called after `flue()` (else `[flue] flueWorkerConfig() was called before flue(). …`). Runs inside the Cloudflare plugin's config resolution against the active `CLOUDFLARE_ENV` and contributes exactly four things: `main` = `virtual:flue/worker` unless the user's wrangler config sets its own `main` (which can re-export: `export * from 'virtual:flue/worker'`); one DO binding per scanned agent (a user binding on a Flue-reserved name must match Flue's generated binding, else `[flue] wrangler config durable object binding "…" is reserved by Flue. …`); the `nodejs_compat` flag unioned into `compatibility_flags`; validation of `compatibility_date` — must be `YYYY-MM-DD` and ≥ `2026-04-01` (older = error, not a silent bump; unset = Cloudflare plugin's default). Everything else in the wrangler config passes through; Flue never reads/merges/writes a wrangler file. No-op under `vite preview`.

#### Resolution by consumer
- **`vite dev`** — discovery + merge + resolve + require `app` + scan in the plugin's `config` hook; then live: an edit to the discovered config (or creation of any candidate when none existed) restarts the dev server; an agent-set change regenerates `virtual:flue/agents` and reloads the app (Node) or restarts the dev server (Cloudflare, so the Worker entry + DO bindings regenerate); a `wrangler.jsonc`/`wrangler.json`/`wrangler.toml` appearing/disappearing at the root restarts the dev server (edits handled by the Cloudflare plugin); scan failures during watching are logged and the last good set stays.
- **`vite build`** — same resolution, once; `app` required, scan must succeed; Node applies the forced build config + `build.outDir` safety check; Cloudflare applies the ordering/wiring validation and emits the merged wrangler config.
- **`vite preview`** — artifact-based: config still discovered/loaded/validated, entries resolved, but nothing required, no scan, nothing generated.
- **`flue run`** — resolves config directly: discovered from the working directory, `vite.config.ts` never read; unknown keys dropped (not rejected); `target`/`agents` ignored; `db` honored (else `node_modules/.cache/flue/run.db`); `app`/`cloudflare` resolved but unused (explicit-path existence checks still apply).

#### `@flue/runtime/config` (programmatic module — host-side, touches the filesystem; never import from agent modules)
- `parseFlueConfig(value, source?)` → validated `FlueConfig` (per-field diagnostics naming `source`, default `'flue config'`).
- `mergeFlueConfig(file, inline)` → per-field merge, defined `inline` wins.
- `resolveFlueConfigPath({ cwd, configFile? })` → absolute config path or `undefined`; explicit missing path throws `[flue] Config file not found: <path>`.
- `loadFlueConfig(opts)` → `{ configPath, config }`; `{ configPath: undefined, config: {} }` when none exists; throws on missing explicit path, non-object default export, or validation failure.
- `loadFlueConfigModule(absPath)` → module namespace, unvalidated, via cache-busted dynamic `import()`.
- `resolveSourceRoot(root)` → `root/.flue` (as directory) else `root/src` else `root`.
- `discoverProjectEntry(sourceRoot, basename)` → entry or `undefined` (ext priority `ts,mts,js,mjs`).
- `resolveFlueProject({ root, config?, configPath? })` → `ResolvedFlueProject` = `{ root, sourceRoot, target, app, db, cloudflare, agents }` (absolute paths; `target` passed through; `agents` glob verbatim).
- Constants: `FLUE_CONFIG_BASENAMES` (priority order) and `PROJECT_ENTRY_EXTENSIONS` (`['ts','mts','js','mjs']`).

#### What configuration does not cover
Environment variables (keys come from the process environment), wrangler configuration (Worker name, routes, bindings, migrations live in `wrangler.jsonc`), agent behavior (models/tools/sandboxes/durability are agent-module concerns), Vite options (ports, plugins, build overrides stay in `vite.config.ts`).

### 02-errors.md

Typed framework failures are `FlueError` subclasses with a stable machine-readable `type` code, plus two plain-`Error` classes (`AgentRunError`, `ResultUnavailableError`). Cancellation rejects with a `DOMException` named `AbortError`. Misuse of programmatic entry points (calling `dispatch()`/`init()` before the runtime is configured, empty instance id) throws plain `Error`s whose `[flue]`-prefixed messages are prose, not API. Error classes export from `@flue/runtime`, with two exceptions: the Cloudflare binding surface on `@flue/runtime/cloudflare`, and the persistence store classes on `@flue/runtime/adapter`. SDK errors wrap the same wire envelope.

#### `FlueError`
```ts
class FlueError extends Error {
  readonly type: string; readonly details: string; readonly dev: string;
  readonly meta: Record<string, unknown> | undefined; readonly cause: unknown;
}
```
- `type` — stable snake_case identifier, one constant per subclass; the machine-readable contract (match on it in code/telemetry).
- `message` — one caller-safe sentence; prose, may change between versions. `details` — longer caller-safe prose, always on the wire (`''` when nothing further). `dev` — developer-audience prose; on the wire only in local development. `meta` — optional structured data, set only by documented subclasses, always on the wire when set. `cause` — logged server-side, never on the wire. `name` — not a discriminator (most report `'FlueError'`/`'FlueHttpError'`); use `instanceof` or `type`.
- `FlueHttpError` (not exported) adds `status` + `headers`; its two exported subclasses (`AgentInstanceNotFoundError`, `AgentInstanceExistsError`) expose them.

#### HTTP error envelope
Every error response from an agent route, a mounted `createAgentRouter()` app, or a channel router carries one JSON body:
```json
{ "error": { "type": "stream_not_found", "message": "…", "details": "…", "dev": "…", "meta": {} } }
```
`type`/`message`/`details` always present; `dev` only when the server runs in local development and the class populated it; `meta` whenever set. `ref` — a server-minted `err_` + ULID, present exactly when the server logged the error (the two 500-class renders); same value as the `flue-error-ref` response header and prefixes the matching `[flue] [err_…]` log line; never on unlogged 4xx. `cause` and stack traces never appear. Also `content-type: application/json`, `x-content-type-options: nosniff`, `cross-origin-resource-policy: cross-origin`. `HEAD` conversation reads answer errors with status/headers only; a long-poll read aborted by the client → 499 empty body; mid-stream failures terminate the stream without an envelope. **Correlating a 500**: quote `ref` (or the header — it survives body-less responses); the log line starts `[flue] [err_…]` with the full cause chain; refs are ULIDs, so the ref alone brackets the time window; a W3C `traceparent` on the request is recorded beside the ref. Refs exist only for synchronous renders — a submission failing after 202 admission has no ref; its handle is `submissionId` (shared by `submission_settled`, SDK `FlueExecutionError.targetId`, `[flue:submission-…]` log lines).

#### Route error types (wire `type` + status; only two have importable classes)
- `invalid_request` 400 — malformed requests (bad URL/params, empty instance-id segment, invalid dispatch payloads, `uid` combined with `initialData`, creation data failing `initialDataSchema`); `details` states the reason.
- `invalid_json` 400 · `unsupported_media_type` 415 (no `Content-Type: application/json`) · `method_not_allowed` 405 (with `Allow` header) · `route_not_found` 404 (routes not enumerated) · `stream_not_found` 404 (read for an instance never prompted) · `attachment_not_found` 404 · `agent_instance_not_found` 404 · `agent_instance_exists` 409 · `runtime_unavailable` 503 (`Retry-After: 1`, `meta.state` `'loading' | 'draining' | 'failed'`) · `internal_error` 500.
- Admission of a send (HTTP, `dispatch()`, or `init().dispatch()`) also rejects `invalid_request` for `uid`+`initialData` combination, `initialDataSchema` failures, or a non-function `agent` argument. `InvalidRequestError` isn't exported — match with `instanceof FlueError` + `type`.
- Internal codes: `conversation_record_invariant` (no class), the store codes carried by `@flue/runtime/adapter` classes, and `cloudflare_ai_binding_error`.
- App-owned routes/middleware in `app.ts` own their responses; the envelope/status vocabulary applies only to framework-owned routes.

#### Classes (type — origin / notes)
- `AgentInstanceExistsError` (`agent_instance_exists`, 409) — create-only send (`uid: null`) named an existing instance; raised synchronously at admission, nothing durable created; `readonly uid: string | undefined` (existing incarnation, usable as continue condition; `undefined` for pre-uid instances); rides wire `meta.uid`.
- `AgentInstanceNotFoundError` (`agent_instance_not_found`, 404) — continue-only send (`uid: '<string>'`) named a missing/non-matching instance (both cases same error); also the rejection of `init().read()` to a never-contacted instance (fails fast instead of waiting forever).
- `AgentRunError` (plain `Error`) — `init().read()` rejection for a submission settled `failed`/`aborted`; `outcome`, `submissionId`, `cause` = serialized settlement error. A `read()` whose `signal` already fired rejects with the signal's reason instead (local cancellation only — the submission keeps running; use `abort()` to stop durably).
- `AttachmentConflictError` (`attachment_conflict`; `@flue/runtime/adapter`) — attachment id reused with different content/metadata/ownership; `meta.path` + `meta.attachmentId`.
- `AttachmentIntegrityError` (`attachment_integrity`; adapter) — bytes failed integrity verification; `meta.attachmentId` + `meta.reason` `'size' | 'digest' | 'chunks'`.
- `AttachmentNotAvailableError` (`attachment_not_available`) — harness operation referenced an attachment id not visible in the calling session's conversation; `meta.attachmentId`.
- `CloudflareAIBindingError` (`cloudflare_ai_binding_error`; `@flue/runtime/cloudflare`) — a Workers AI binding request failed; public constructor `({ message?, status?, statusText?, body? })`; body rides in `message` (≤ 2000 chars) + `details`; `meta.status`/`meta.statusText` plus `meta.reason: 'request_too_large'` on 413 (separates self-healing context overflow from a binding outage).
- `ConversationStreamStoreError` (`conversation_stream_store_failure`; adapter) — canonical stream operation rejected, stream unchanged; `meta.operation`/`path`/`reason`.
- `DelegationDepthExceededError` (`delegation_depth_exceeded`) — nested `task()`/harness-tool delegation chain exceeded max depth.
- `InstrumentationAlreadyInstalledError` (`instrumentation_already_installed`) — `instrument()` while an owner of the same kind was active; dispose first.
- `OperationFailedError` (`operation_failed`) — a harness operation (`prompt()`, `skill()`, `task()`, `shell()`, `compact()`) ran but didn't complete (model error, or a durable input couldn't be persisted/recovered); `meta.operation` + `meta.reason`.
- `PersistedFormatVersionError` (`persisted_format_version_unsupported`; adapter) — DB records a format version the runtime doesn't support (newer stamp after rollback, or unrecognized marker); thrown at store open / startup; `meta.storedVersion` + `meta.supportedVersion`.
- `ResultUnavailableError` (plain `Error`) — `prompt()`/`skill()`/`task()` with `options.result` when the model invoked the give-up tool; `reason` (model explanation) + `assistantText` (transcript before give-up).
- `SandboxOperationUnsupportedError` (`sandbox_operation_unsupported`) — adapter rejected an operation/option it doesn't implement, before touching the filesystem; `meta.operation`/`provider`/`options`.
- `SessionBusyError` (`session_busy`) — a harness operation invoked while the session already ran one; sessions run one operation at a time (open another session for parallel branches).
- `SessionNotFoundError` (`session_not_found`) — internal harness session lookup failure; public operations get-or-create and can't hit it.
- `SkillDefinitionValidationError` (`skill_definition_validation`) — `defineSkill()` got an invalid definition; `meta.issues` = `ValidationIssue[]`.
- `SkillNotRegisteredError` (`skill_not_registered`) — `skill(name)` named a skill not discovered in the session's sandbox at init; packaged `SKILL.md` references bypass discovery.
- `SubagentNotDeclaredError` (`subagent_not_declared`) — `task({ agent })` named a subagent absent from the agent's declarations.
- `SubmissionAbortedError` (`submission_aborted`) — terminal settlement error; work was aborted (route `POST .../abort` or `init().abort()`), stopping all in-flight + queued work; a distinct terminal outcome, not a failure — a committed terminal record is never aborted, and an abort that loses the race to a completed response settles completed.
- `SubmissionInterruptedError` (`submission_interrupted`) — terminal settlement error; every attempt was interrupted before input was applied, the attempt budget ran out with no model call started; `meta.phase: 'retry_exhausted_before_input'`, `meta.attemptCount`, `meta.maxAttempts`.
- `SubmissionRetryExhaustedError` (`submission_retry_exhausted`) — recovery re-attempted past input application until `durability.maxAttempts` without a completed response; `meta.interruptedTools` lists `{ name, id }` pairs (each has an explicit interrupted-error outcome, never assumed complete or retried), plus `attemptCount`/`maxAttempts`.
- `SubmissionTimeoutError` (`submission_timeout`) — exceeded `durability.timeoutMs`.
- `ToolInputValidationError` (`tool_input_validation`) — model arguments failed the tool's `input` schema; during a model turn it becomes an error tool result back to the model (submission continues); `meta.tool` + `meta.issues`.
- `ToolNameConflictError` (`tool_name_conflict`) — duplicate tool name, or a custom/adapter tool using a framework-reserved name; raised when the session assembles tools, before any model call.
- `ToolOutputSerializationError` (`tool_output_serialization`) — return not JSON-serializable, or `undefined` while declaring an `output` schema; `meta.tool`; `cause` carries the serialization failure when one exists.
- `ToolOutputValidationError` (`tool_output_validation`) — return failed its `output` schema; `meta.tool` + `meta.issues`.
- `ValidationIssue` — `{ readonly message: string; readonly path?: readonly PropertyKey[] }`; one Standard Schema failure, carried in `meta.issues`.

#### Settlement error shape
The `submission_settled` event, the durable record, and the `submission-settled` conversation-stream chunk carry `{ type: 'submission_settled'; submissionId: string; outcome: 'completed' | 'failed' | 'aborted'; error?: { name?, message, type?, details?, dev?, meta? } }`. A `FlueError` serializes with its `name`/`message`/`type`/`details`/`meta`; any other failure cause is redacted to a generic `internal_error` entry (non-Flue messages never reach records or the wire); settlement errors never carry a stack.

#### Markers
```ts
const WORKERS_AI_OVERFLOW_MARKER = '(request_too_large)';
const RETRYABLE_INTERRUPTION_MARKER = '(retryable_interruption)';
```
Message-string markers where no typed error survives (classification reads the persisted assistant error message). The overflow marker is appended to a binding 413 message → the compaction layer matches it to trigger context-overflow recovery; the retryable marker is stamped only by throw sites that can prove a transient interruption (e.g. a Workers AI stream ending without an error frame/finish reason). Their string values are the contract.

#### `errorInfo` on live observations (in-process only)
`FlueObservation` values delivered to in-process `observe()` subscribers carry classified detail on failed activity: `{ type, name?, code?, message?, meta?, stack? }` (interface not exported). Classification: `DOMException` `AbortError` → `type: 'AbortError'`; a `FlueError` → `type` = stable code + framework `meta`; any other object → its string `type`, else `code`, else `name`, else `'_OTHER'` (`name`/`code`/`message` carried when strings); a string → `{ type: '_OTHER', message }`; anything else → `{ type: '_OTHER' }`. `stack` present only when observed live from a real `Error` instance. Appears on failed `tool`/`operation`/non-completed `submission_settled` observations; `shell()` failures classify to the `type`/`name`/`message` subset only. Durable-shaped `error` fields on `operation`/`compaction` events serialize to `{ name, message }` (+ `type`/`details`/`meta` for `FlueError`s) — stacks never persist/replay/send over HTTP.

#### Turn error normalization
Model-call failures don't throw through the agent render; they normalize into the `turn` event's `response`, and when the submission can't recover it settles with `OperationFailedError` or a durable submission error. `ModelResponse` carries `finishReason` (normalized vocabulary: `'stop' | 'length' | 'toolUse' | 'error' | 'aborted'`), `providerFinishReason` (provider's exact pre-normalization value, telemetry only), `gatewayLogId` (Cloudflare AI Gateway `cf-aig-log-id`, read from response headers), `error` (classified; bare provider error strings classify `_OTHER`), `isError` (true when the request threw or finishReason is `'error'`/`'aborted'`).

#### Boundaries
`type` strings are the stable contract (`message`/`details`/`dev` may change — don't parse them). No exported enum/list of codes. No per-provider hierarchy (only `CloudflareAIBindingError`). Cancellation is never a `FlueError` (always `AbortError`). The wire never carries `cause`, stacks, or non-Flue error messages. CLI/config/build diagnostics are human-oriented stderr prose without stable codes. Application-owned routes return whatever they choose (no imposed envelope/category).

### 03-agent-api.md

**Module surface:** `@flue/runtime` (+ `/node`, `/routing`, `/tool`, `/cloudflare`, `/cloudflare/workers-ai`).

#### Agent functions
```ts
type AgentFunction<TProps = void> = TProps extends void ? () => string | undefined | void : (props: TProps) => string | undefined | void;
type Agent = AgentFunction<AgentProps> & AgentStatics;
```
- Sync only; promise → `[flue] Agent functions must be synchronous.` Return string/`undefined` else throw; tools-only agents (no return) legal. Instruction doc = returned string then each `useInstruction()` text, call order, blank-line-joined.
- Re-rendered before every model call; hook values = snapshot of that render. Renders never nest — direct call throws `[flue] Re-entrant agent render.` Duplicate tool/skill/subagent/state names in one render throw (duplicate tool → `ToolNameConflictError`).

#### `AgentProps`
```ts
interface AgentProps { id: string; }
```
- `id` = instance id (`:id` URL, dispatch/init `id`, or `--id` to `flue run`); constant for the instance's life. Root agent only; subagents called with no args. Bare render without an instance → reading `props.id` throws.

#### `'use agent'` directive
```ts
'use agent';
export function TriageAgent() { /* ... */ }
```
- Registers a module, not a function: string literal at top before imports; build registers every exported capitalized-name function as an agent.
- Identity resolution: (1) build-stamped binding; (2) `agentName` static; (3) function `name`. Must match `AGENT_IDENTITY_PATTERN` `/^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*$/` (PascalCase or kebab-case; no `:`, no leading digit); invalid/duplicate → throw at registration. `__flueBindAgentModule()`/`AgentIdentityBinding` = build transform (not public API).

#### Agent statics
```ts
interface AgentStatics { agentName?: string; initialData?: v.GenericSchema; durability?: DurabilityConfig; }
```
- `agentName` — durable identity override, pattern-valid, string literal in a `'use agent'` module. `initialData` — Valibot schema, validated exactly once at first contact, synchronously before durable admission; mismatch rejects the creating send; without it the creator's send is recorded untyped. `durability` — retry policy, applied while the function is NOT running; value need not be literal.

#### `DurabilityConfig`
```ts
interface DurabilityConfig { maxAttempts?: number; timeoutMs?: number; }
```
- `maxAttempts` — total attempts before terminalize-as-failed (`SubmissionRetryExhaustedError`); initial run counts; positive int; **default `10`.** `timeoutMs` — wall-clock ms per submission from first attempt start; exceeding aborts → `SubmissionTimeoutError`; turn-boundary joins and `useAgentFinish` continuations do **not** extend it; checked cooperatively; **default `3_600_000` (1 h).** Unknown fields throw at validation.

#### `DeliveredMessage`
```ts
type DeliveredMessage =
  | { kind: 'user'; body: string; attachments?: DeliveredAttachment[] }
  | { kind: 'signal'; type: string; body: string; attributes?: Record<string, string>; tagName?: string };
type DeliveredMessageInput = string | DeliveredMessage;
type DeliveredAttachment = PromptImage & { filename?: string };
```
- Bare string = `{ kind: 'user', body }`. `user` → canonical `user_message`, `purpose: 'user'`; `attachments` = images (base64, capped `14 * 1024 * 1024` each). `signal` — XML-tagged block, not a chat turn; `type` non-empty, caller-defined (e.g. `'slack.message'`); framework-reserved types rejected at admission. `tagName` overrides XML tag (default `signal`), must be a valid XML name, rendered unescaped. Malformed → `InvalidRequestError` (`invalid_request`).

#### `dispatch()`
```ts
function dispatch(agent: Agent, request: AgentDispatchRequest): Promise<DispatchReceipt>;
interface AgentDispatchRequest { id: string; message: DeliveredMessageInput; initialData?: unknown; uid?: string | null; }
interface DispatchReceipt { submissionId: string; acceptedAt: string; uid: string; }
```
- Fire-and-forget; resolves at admission. `id` required non-empty; instance created on first contact; `message` snapshotted at admission. `initialData` consulted only when the send creates the instance; can't combine with string `uid`. `uid` = send condition; `acceptedAt` ISO at admission start. Unregistered agent rejects; non-function first arg → `InvalidRequestError`; before runtime configured → rejects.
- Cloudflare: durable admission to the DO, may retry after interruption. Node: durability follows the persistence adapter (default in-memory = process-lifetime). Processing at-least-once everywhere.

#### Conditional sends (uid as ETag)
- `uid` omitted — unconditional (continue or create). `uid: '<string>'` — continue only that incarnation; mismatch → `AgentInstanceNotFoundError` (`agent_instance_not_found`, 404) at admission, nothing durable; can't combine with `initialData`. `uid: null` — create only when none exists; existing → `AgentInstanceExistsError` (`agent_instance_exists`, 409), carries existing uid on `.uid` and in `details`. Wire: reserved `uid` sibling on the message body; `202` echoes it beside `streamUrl`/`offset`/`submissionId`.

#### `init()`
```ts
function init(agent: Agent, options?: InitOptions): AgentInstanceHandle;
interface InitOptions { id?: string; uid?: string | null; }
interface AgentInstanceHandle {
  readonly id: string;
  dispatch(request: string | AgentHandleDispatchRequest): Promise<DispatchReceipt>;
  read(target: string | DispatchReceipt, options?: AgentReadOptions): Promise<AgentReply>;
  abort(): Promise<void>;
}
type AgentHandleDispatchRequest = Omit<AgentDispatchRequest, 'id' | 'uid'>;
interface AgentReadOptions { onEvent?: (chunk: ConversationStreamChunk) => void; signal?: AbortSignal; }
```
- `init()` itself creates nothing, no I/O; safe at module scope. `id` omitted mints a fresh unique id; empty/non-string id throws; non-function agent → `InvalidRequestError`.
- `handle.dispatch` — payload minus `id`/`uid`; bare string shorthand; payload carrying `id`/`uid` throws; admission conditions reject as above.
- `handle.read` — awaits one submission's settlement → `AgentReply`; target = receipt or bare submission id. **Re-attachable**: settlement + reply durable, readable from any process later. Rejects `AgentRunError` when settled `failed`/`aborted`. `onEvent` gets every projected chunk; `signal` rejects with its reason (purely local). Nonexistent instance → `AgentInstanceNotFoundError`; unsigned waits indefinitely; reading own-instance submission inside a tool deadlocks by design.
- `handle.abort()` — durable abort of running head + all queued; resolves once intent recorded; `aborted` settlement lands async; live `read()` rejects `AgentRunError` `'aborted'`.
- All verbs work in a server, standalone script after `start()`, `flue run`, a deployed Worker (incl. Workflow steps).

#### `AgentReply`
```ts
interface AgentReply { text: string; data: Record<string, unknown[]>; metadata?: Record<string, unknown>; uid?: string; submissionId: string; }
```
- `text` — final assistant text (`''` when none). `data` — `useDataWriter` parts keyed by name, arrays of writes in order. `metadata` agent-authored. `uid` contacted incarnation; `submissionId` settled submission.

#### `AgentRunError`
```ts
class AgentRunError extends Error { readonly outcome: 'failed' | 'aborted'; readonly submissionId: string; }
```
- Underlying recorded error attached as `cause`.

#### `getAgentInstance()`
```ts
function getAgentInstance(agent: Agent, id: string): Promise<AgentInstanceInfo | null>;
interface AgentInstanceInfo { id: string; uid?: string; }
```
- `null` when no instance; `uid` absent only while the birth record hasn't landed.
#### `start()`
```ts
import { start } from '@flue/runtime/node';
function start(options: StartOptions): Promise<Flue>;
interface StartOptions { agents: readonly StartAgentEntry[]; db?: PersistenceAdapter; env?: Record<string, string | undefined>; providers?: readonly Provider[]; }
type StartAgentEntry = Agent | StartAgentConfig;
interface StartAgentConfig { agent: Agent; name?: string; }
interface Flue { stop(): Promise<void>; [Symbol.asyncDispose](): Promise<void>; }
```
- `agents` required non-empty; identity from entry `name`, else the agent's own — never positional. Anonymous function without `agentName`/`name` throws.
- `db` defaults to in-memory SQLite (process lifetime); pass `sqlite('./run.db')` from `@flue/runtime/node`. `env` defaults to `process.env`.
- `providers` — omitted = every Pi built-in (skips already-registered IDs, so prior `setProvider()` wins); empty array = none; explicit list registers unconditionally (overwrites same-ID).
- `stop()` drains in-flight work then disconnects persistence. One process = at most one runtime; `start()` throws when already configured.
- `@flue/runtime/node` also exports `local()` sandbox factory and `sqlite()` adapter.

#### `createAgentRouter()`
```ts
import { createAgentRouter } from '@flue/runtime/routing';
function createAgentRouter(agent: Agent): Hono;
```
- Mount: `app.route('/agents/support', createAgentRouter(Support))`.
- Routes (relative to mount): `POST /:id` (prompt; body `DeliveredMessage` + optional top-level `initialData`/`uid`; `202` on admission); `GET | HEAD /:id` (conversation stream read); `POST /:id/abort`; `GET /:id/attachments/:attachmentId`.
- Pure factory, no options/side effects; handlers resolve runtime at request time. Throws at creation when identity unresolved/invalid. Unmatched methods → `405` (`MethodNotAllowedError`). No auth — mount decision is the exposure. Exposes `.fetch`.
- Parallel: `createChannelRouter(routes)` from `@flue/runtime` (serves `ChannelRouteDefinition[]`).

#### `Fetchable`
```ts
import type { Fetchable } from '@flue/runtime/routing';
interface Fetchable { fetch(request: Request, env?: unknown, ctx?: unknown): Response | Promise<Response>; }
```
- Cloudflare: `env` = bindings, `ctx` = `ExecutionContext`. Node: `env` = Hono Node adapter bindings, `ctx` = `undefined`.

#### Harness
```ts
interface FlueHarness {
  readonly name: string;
  prompt<S extends v.GenericSchema>(text: string, options: PromptOptions<S> & { result: S }): CallHandle<PromptResultResponse<v.InferOutput<S>>>;
  prompt(text: string, options?: PromptOptions): CallHandle<PromptResponse>;
  compact(): Promise<void>;
  readonly sandbox: Sandbox;
}
```
- Handed to `harness: true` tool `run` and `useAgentStart`/`useAgentFinish` contexts. No direct construction. Scoped to the invocation.

#### `harness.prompt()`
- Runs in the harness's own scratch conversation (never shown to clients). One active operation at a time; later prompts continue the conversation. Can delegate via `task` tool; counts against the delegation-depth cap; child conversations retained on parent.
- `options.result` (Valibot schema) → model must call the framework-injected `finish` tool; resolves `PromptResultResponse`. Model gives up → rejects `ResultUnavailableError`.
```ts
interface PromptOptions<S extends v.GenericSchema | undefined = undefined> {
  result?: S; tools?: ToolDefinition[]; model?: string; thinkingLevel?: ThinkingLevel; signal?: AbortSignal; images?: PromptImage[];
}
interface PromptResponse { text: string; usage: PromptUsage; model: PromptModel; }
interface PromptResultResponse<T> { data: T; usage: PromptUsage; model: PromptModel; }
interface PromptModel { provider: string; id: string; }
interface PromptUsage {
  input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number; };
}
```
- `model` = `'provider-id/model-id'`, defaults to the agent's `useModel`. `thinkingLevel` override. `signal` merged with the handle's own. `images` = `PromptImage` (pi-ai `ImageContent`), requires a vision model.
- `PromptUsage` aggregates all LLM calls (assistant turns, result-extraction retries, compaction). `cost` from per-million-token rates (USD built-ins). `PromptModel` = primary turn's model. Failures beyond aborts reject with typed `FlueError` subclasses (e.g. `SessionBusyError`).

#### `CallHandle`
```ts
interface CallHandle<T> extends Promise<T> { readonly signal: AbortSignal; abort(reason?: unknown): void; }
```
- Abort → awaits reject with `AbortError` (`DOMException`). `signal` fires on abort from either source. `harness.sandbox.exec()` cancelled likewise via `options.signal`.

#### `harness.compact()`
- No-op when nothing to compact; rejects when summarization fails/aborted; `SessionBusyError` when another operation is in flight. Compacts the harness scratch conversation (main conversation auto-compacts per `CompactionConfig`).

#### `harness.sandbox`
- Live `Sandbox` from the `useSandbox()` declaration: `exec()`, `readFile`, `readFileBuffer`, `writeFile`, `stat`, `readdir`, `exists`, `mkdir`, `rm`, `cwd`, `resolvePath()`. Sandbox-less agent → throws `[flue] This agent has no sandbox. ...`
- Never recorded in a conversation. `writeFile` creates missing parents in every sandbox mode. Relative paths resolve against the agent's cwd; `resolvePath()` resolves without touching fs.
- Live getter, not a snapshot — conditional `useSandbox()` may swap at turn boundary; don't cache across turn boundaries.
#### `defineTool()`
```ts
function defineTool<...>(options: {
  name: string;
  description: string;
  input?: ToolInputSchema;   // Valibot; top-level object
  output?: ToolOutputSchema;
  harness?: boolean;
  durable?: boolean;
  run(context: ToolContext<...>): ToolRunEnvelope<Output> | string | void | Promise<ToolRunEnvelope<Output> | string | void>;
}): ToolDefinition;
```
- Validates + freezes; bad definitions fail at module load. Also importable from `@flue/runtime/tool`. Mounted via `useTool()`.
- `name`/`description` required non-empty. `input` must be a top-level object schema; parsed output arrives as `context.data`. `output` parsed before recording; mismatch → `ToolOutputValidationError`; schema producing `undefined` → `ToolOutputSerializationError`. `harness`/`durable` capability flags (booleans).
- `run` may be async; returns `ToolRunEnvelope` `{ output?, terminate? }`. `output` must be JSON-serializable (else `ToolOutputSerializationError`); bare string = `{ output: <string> }`; `void` allowed only when no `output` schema (model sees `null`); any other bare return throws (wrap as `{ output }`). `terminate: true` ends the turn once the current batch settles (same as `finish`/`give_up`); a multi-tool batch ends only when every result terminates; a throwing tool never terminates; flag recorded on the canonical outcome, survives crash. Throwing in `run` records a tool error the model sees; doesn't fail the submission.
- Args failing `input` → `ToolInputValidationError` before `run`; model receives the validation failure as result.

**`ToolContext`:**
```ts
type ToolContext<Input, Harness, Durable> = {
  readonly toolCallId: string;
  readonly signal?: AbortSignal;
  readonly log: FlueLogger;
} & { readonly data: v.InferOutput<Input>; }  // when `input` declared
  & { readonly harness: FlueHarness; }        // when `harness: true`
  & { readonly step: ToolStep; };             // when `durable: true`
interface FlueLogger { info(message: string, attributes?: Record<string, unknown>): void; warn(message: string, attributes?: Record<string, unknown>): void; error(message: string, attributes?: Record<string, unknown>): void; }
```
- `toolCallId` — same id as the call's `tool_start`/`tool` events and tool-result message; synthesized in standalone runs. `signal` — the call's abort signal. `log` — emits `log` events into the conversation stream; model never sees. Helpers `ToolInput<TTool>`/`ToolOutput<TTool>` extract inferred types.
- `harness: true` — runs only inside an agent session, never standalone. `durable: true` — side effects via `step.do(...)`; an interrupted call re-executes on recovery; completed steps replay recorded values. Flags compose.
```ts
interface ToolStep { do<T>(name: string, fn: () => T | Promise<T>): Promise<T>; }
```
- Runs `fn` once per `name` per call; value durably recorded before `do` resolves. Exactly-once-recorded, at-least-once-executed. Values JSON-serializable and small; non-empty name required; name reuse within one call throws. No durability outside an agent session.

#### `defineSkill()`
```ts
function defineSkill(definition: SkillDefinition): SkillDefinition;
```
- Validates + freezes; no packaging here (packaged lazily). `instructions` stays plain markdown; `defineSkill` writes frontmatter itself. Invalid → `SkillDefinitionValidationError` with field-level issues, at module load. Mount with `useSkill()`.

#### `SkillDefinition`
```ts
interface SkillDefinition {
  readonly name: string; readonly description: string; readonly instructions: string;
  readonly license?: string; readonly compatibility?: string; readonly metadata?: Readonly<Record<string, string>>;
  readonly allowedTools?: string; readonly files?: Readonly<Record<string, string | Uint8Array>>;
}
```
- `name` — lowercase ASCII letters/numbers/single hyphens, max 64 chars; required. `description` max 1024 chars; required. `instructions` required non-empty. `license`/`compatibility` optional (`compatibility` max 500 chars). `metadata` string→string. `allowedTools` space-separated pre-approved tools (experimental). `files` — relative paths only (no leading `/`, no `.`/`..`, no backslashes), must not be `SKILL.md`; content string or `Uint8Array`.

#### `defineSubagent()`
```ts
function defineSubagent(definition: SubagentDefinition): SubagentDefinition;
```
- Validates + freezes. Per-mount overrides: `useSubagent({ ...issueClassifier, model: 'anthropic/claude-haiku-4-5' })`.

#### `SubagentDefinition`
```ts
interface SubagentDefinition { name: string; description: string; agent: AgentFunction; model?: string; thinkingLevel?: ThinkingLevel; }
```
- `name` catalog name on the `task` tool, required non-empty. `description`/`agent` required. `model`/`thinkingLevel` overrides; inherit the parent's when omitted.

#### `GeneralSubagent`
```ts
const GeneralSubagent: SubagentDefinition;
```
- Blank general-purpose delegate; agent function deliberately empty; gets shared environment tools, filesystem context, parent's model; none of parent's instructions/tools/skills/subagents. Registered under framework-reserved name `flue-general`.

#### `defineMcpConnection()`
```ts
function defineMcpConnection(definition: McpConnectionDefinition): McpConnectionDefinition;
```
- Validates + freezes. Per-mount overrides: `useMcpConnection({ ...linear, tools: ['create_issue'] })`.

#### `McpConnectionDefinition`
```ts
type McpTransport = 'streamable-http' | 'sse';
type McpAuth = string | (() => string | Promise<string>);
interface McpConnectionDefinition {
  name: string; url: string | URL; transport?: McpTransport; auth?: McpAuth;
  headers?: HeadersInit; requestInit?: RequestInit; fetch?: typeof fetch;
  timeoutMs?: number; resetTimeoutOnProgress?: boolean; tools?: string[]; optional?: boolean;
}
```
- `name` — `mcp__<server>__` tool namespace; required non-empty. `url` required; string must parse as an absolute URL.
- `transport` defaults `'streamable-http'`; `'sse'` legacy. `auth` — bearer on every request; function resolved fresh per request; on 401 re-resolves once and retries. `headers` static, merged into every transport request (set-wins over `requestInit`). `fetch` custom impl. `timeoutMs` default MCP SDK default (60 s). `resetTimeoutOnProgress` default `false`. `tools` allowlist in order; unknown/repeated/task-required names reject. `optional` default `false` (failed connection fails submission before the model runs); `optional: true` → zero tools mounted, announced as a `resources` signal + `log`-level warning; next submission retries. Unknown fields/malformed values throw, naming the field.

#### `createMcpConnection()`
```ts
function createMcpConnection(definition: McpConnectionDefinition): Promise<McpConnection>;
interface McpConnection { name: string; tools: ToolDefinition[]; close(): Promise<void>; }
```
- **Node target only** (Cloudflare Workers prohibit network I/O in global scope; a top-level connect fails boot — surfaces only at `wrangler dev`/deploy, not `vite dev`). On Cloudflare use `useMcpConnection()`.
- Adapted tool names `mcp__<server>__<tool>`; chars outside `[A-Za-z0-9_-]` → `_`; duplicates reject. Descriptions carry the server description (+ `Title:` when distinct). `tools/list` pagination; repeated cursor throws. Task-based tools skipped with a console warning (allowlisting one = error). Result content flattened to text; `isError` result → tool error; output-schema mismatch = error. Adapted definitions complete — don't wrap in `defineTool()`. `close()` closes the client; on connection/discovery failure the client is closed before the error propagates.

#### Dynamic resources (framework-authored signals)
- Diff against the last-narrated snapshot; changes appended as signals. A custom-tool change also rewrites the native tools array (invalidates the prompt cache unless the tool was added by a completed tool call).
- **`resources` signal** — at turn boundary when tools/skills/subagents differ; one signal per changed kind. Body: added entries as catalog lines (`- **name** — description`), removals/updates one-liners, then full current roster (names only). Tool updates announced name-only.
- **`resources` for MCP** (`resource` attribute `mcp`) — before the first turn when an optional MCP connection failed; names each unavailable server + reason; once per degraded submission.
- **`instructions` signal** — when the composed instruction doc digest changes; body = fixed marker `System instructions updated.`
- **`environment` signal** — on conditional `useSandbox()` presence flip; always a full snapshot (new cwd, complete tool roster names-only, live skill/subagent catalogs, warning that previous environment files/results may be inaccessible); supersedes that boundary's delta narration.
- **Compaction rebaselines** — post-compaction system prompt snapshots current resource sets; delta narration restarts. Narration signals never advance the `useDelivery()` cursor.
- **Reserved signal types** (framework-authored; `dispatch()` admission and event hooks' `append` reject): narration (`resources`, `instructions`, `environment`), recovery/settlement advisories (`stream_interrupted`, `stream_continued`, `submission_aborted`, `submission_interrupted`), future-held (`compaction`, `memory`).
### 04-agent-hooks-api.md

All symbols from `@flue/runtime`. Hooks: `useModel`, `useSandbox`, `useTool`, `useMcpConnection`, `useSkill`, `useSubagent`, `useInstruction`, `usePersistentState`, `useInitialData`, `useDelivery`, `useDispatchMessage`, `useDataWriter`, `useAgentStart`, `useAgentFinish`, `useResponseStart`, `useResponseFinish`.

#### Rendering and the rules of hooks
- Render = running the agent function before every model call; fresh frame each render; hooks record in call order. Hooks only during render (sync body or custom hook); elsewhere → `[flue] <hook>() was called outside an agent function.` Renders are pure reads; hook write-functions (state setters, data writers, dispatcher) throw during render.
- **Conditional/reorderable:** `useTool`, `useSkill`, `useSubagent`; `useMcpConnection` (submission granularity); `usePersistentState` (keyed by name); the four event hooks (no durable identity); `useSandbox` presence (flip swaps at the next turn boundary). **Identity-invariant:** `useDataWriter` names identical every render. **Required exactly once:** `useModel`; a render without it cannot start.
- Duplicate names throw within one render: tool names, MCP server names, skill names, subagent names, state names, data-part names. `useModel`/`useSandbox` throw when called twice.
- **Submission-scoped** (read once when the submission starts): `useModel` values (model, `thinkingLevel`, `compaction`), `useSandbox` factory + `cwd`, `useMcpConnection` definitions. Exception: `useSandbox` presence re-read every turn boundary. **Per-render:** resource sets (tools, skills, subagents), instruction text.
- Subagent frame: `useTool`, `useSkill`, `useInstruction`, nested `useSubagent`, custom hooks compose. **Throw in subagent render:** `useModel`, `useSandbox`, `useMcpConnection`, `usePersistentState`, `useDataWriter`, `useDispatchMessage`, the four event hooks. `useInitialData()` returns `undefined`; `useDelivery()` returns the parent's task prompt.
- Event hooks: `useAgentStart` once per delivered message; `useAgentFinish` at every would-stop point; `useResponseStart`/`useResponseFinish` once per response. No durable identity — declaration order. `useAgentStart`/`useAgentFinish` awaited, may be async, receive harness; `useResponseStart`/`useResponseFinish` synchronous observers (returned promise fails submission). Callback throw fails submission. At-least-once; durable outcomes commit atomically per seam.

#### `useModel()`
```ts
function useModel(model: string, options?: UseModelOptions): void;
interface UseModelOptions { thinkingLevel?: ThinkingLevel; compaction?: false | CompactionConfig; }
type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
```
- `model` — `'provider-id/model-id'`; unresolvable → fails submission at initialization. `thinkingLevel` — agent-wide default; harness substitutes `'medium'` when unset; unknown value throws. `compaction` — threshold config or `false` to disable threshold compaction (overflow recovery and explicit `harness.compact()` still compact). Unknown option fields throw. Submission-scoped.

#### `CompactionConfig`
```ts
interface CompactionConfig { reserveTokens?: number; keepRecentTokens?: number; model?: string; }
```
- `reserveTokens` — headroom; compacts when used > `contextWindow - reserveTokens`; default model-aware, capped at 20,000, shrunk for smaller-output models, adjusted when reserve ≥ half a small context window; positive int. `keepRecentTokens` — default `8000`; positive int. `model` — summarization model specifier; defaults to the session's model. Unknown fields throw.

#### `useSandbox()`
```ts
function useSandbox(sandbox: SandboxFactory, options?: UseSandboxOptions): void;
interface UseSandboxOptions { cwd?: string; }
```
- Factory's `createSandbox()` builds env once per initialized harness; `tools()` (when present) **replaces** the sandbox-backed model-facing tool set. Without the hook: no environment, no built-in file/shell tools, no `harness.sandbox`. First-party factories: `bash()` (just-bash), `local()` from `@flue/runtime/node`.
- Value without `createSandbox` (or deprecated `createSessionEnv`) throws; non-function `tools` throws. `options.cwd` non-empty string; read once when the submission starts; unknown options throw. At most once per render; subagent renders throw. Re-renders never rebuild the environment.
- Conditional allowed; presence flip swaps at turn boundary (attach resolves factory, detach removes env + tools; nothing carries over), announced as one `environment` signal restating full state. Only presence observable across renders (factories are fresh objects). Replacing the factory while attached → next submission's initialization.

#### `useTool()`
```ts
function useTool(tool: ToolDefinition): void;
```
- Accepts `defineTool(...)` value or inline definition object (same validation at mount). Joins the render's single flat tool set. Conditional; set changes narrated. Unmounted tool cannot be called. Duplicate names → `ToolNameConflictError`. Invalid definitions throw at mount with the same messages as `defineTool()`.

#### `useMcpConnection()`
```ts
function useMcpConnection(definition: McpConnectionDefinition): void;
```
- Runtime connects at submission initialization — inside the request context, every target, all declared servers in parallel — mounting tools as `mcp__<server>__<tool>`. Definitions read once per submission at initialization; a conditional declaration takes effect next submission, narrated as a `resources` signal.
- Connections reused for the instance's in-memory lifetime; definitions read at first connect (`auth` excepted). Failed connect fails the submission before the model runs, never cached — unless `optional: true`. Duplicate server names in one render throw. Subagent renders throw.

#### `useSkill()`
```ts
function useSkill(skill: Skill): void;
type Skill = SkillReference | SkillDefinition;
interface SkillReference { readonly __flueSkillReference: true; readonly id: string; readonly name: string; readonly description: string; }
```
- Progressive disclosure: one always-present catalog line (name + description); model pulls full instructions via the `activate_skill` tool; briefing arrives as a tool result; supporting files lazy. `SkillReference` = `SKILL.md` import value or `defineSkill(...)` result; or inline `SkillDefinition`. Same skill name twice in one render throws. Conditional; changes narrated. Always-on content: import `.md` as a string, pass to `useInstruction()`.

#### `useSubagent()`
```ts
function useSubagent(subagent: SubagentDefinition): void;
```
- `task` tool always in the tool set with a fully static spec; roster in the system prompt "Available Agents" section; required `agent` parameter resolves only against declared subagents; empty roster → inert tool. Duplicate delegate names throw; conditional, narrated. Delegate's `agent` function rendered at delegation time, own frame, fresh per task. Delegate isolated from parent; only final text returns to parent.

#### `useInstruction()`
```ts
function useInstruction(text: string): void;
```
- Appends raw text after the returned instruction, call order, blank-line-joined. `text` required, non-empty after trimming; anything else throws. Callable in root and subagent renders, any number of times. Composed doc digest-tracked as a whole.

#### `usePersistentState()`
```ts
function usePersistentState<T>(name: string, defaultValue: T): [T, StateSetter<T>];
function usePersistentState<T = unknown>(name: string): [T | undefined, StateSetter<T | undefined>];
type StateSetter<T> = (value: T | ((previous: T) => T)) => void;
```
- Durable per-instance state over the record log. Reads = render-time snapshots; writes silent (never post, never wake, never re-render mid-run). Values JSON-normalized; non-serializable throws. Setting `undefined` throws (no unset). `defaultValue` fills before the first write, never persisted itself.
- Updater form resolves `previous` at **call** time through the attempt's write buffer; any function argument treated as updater. Deep-equal write = no-op, no record appended. Tool writes become durable atomically with the tool batch. Setter throws during render and on bare tooling/test renders. Keyed by name; same name twice in one render throws; conditional declaration legal. Subagent renders throw. Type param compile-time only.

#### `useInitialData()`
```ts
function useInitialData<T = unknown>(): T;
```
- Reads instance-creation data, constant for the instance's life. With schema static: validated at creation (always present). Without schema: untyped. `initialData` to an existing instance ignored. Runtime `undefined` when creation carried no data, bare tooling/test renders, subagent renders. Suggest `useInitialData<Config | undefined>()`. Never served to clients; not a secrets channel.

#### `useDelivery()`
```ts
function useDelivery(): DeliveredMessage;
```
- Message currently in front of the model, same validated shape every transport admits. Cursor: starts as the delivery that woke the response, advances at turn boundaries / event-hook-appended signals. Narration signals don't advance the cursor. Constant within one render; fresh at the next. Crash-safe (derived from the durable record stream). Subagent render → parent's task prompt as `kind: 'user'` (task images as `attachments`). Always present in runtime; bare test render throws.

#### `useDispatchMessage()`
```ts
function useDispatchMessage(): (message: DeliveredMessageInput) => Promise<DispatchReceipt>;
```
- Dispatcher bound to this instance; no `initialData`, no `uid`. Same queue/admission/delivery; one accepted order shared with direct HTTP prompts. Bare string shorthand.
- Dispatch to a busy own instance joins the live response at the next turn boundary (durably admitted, own `useAgentStart` run, read on the next turn), doesn't interrupt the in-flight turn. Idle instance → wakes a new response. Missed deliveries run as own submission. Joined delivery settles when the host response settles, under the host's durability budget. A joined HTTP prompt still writes its own `submission_settled` record.
- Each call = durable delivery with own receipt; re-runs dispatch again (at-least-once). Throws during render, on bare test renders, before runtime configured. Throws in subagent renders.

#### `useDataWriter()`
```ts
function useDataWriter<TSchema extends v.GenericSchema>(name: string, options: { schema: TSchema }): (data: v.InferOutput<TSchema>) => void;
function useDataWriter(name: string): (data: unknown) => void;
```
- Declares a named client-facing data part + returns a write-only function. One-way, non-reactive; model never sees parts. Each write appended durably and streamed immediately. `name` — part identity within the response (AI SDK convention: `data-<name>`). First write places the part; later writes update in place. Mounting emits nothing.
- `options.schema` Valibot schema validating every write; writer throws on mismatch; unknown option fields throw. Values JSON-normalized; `undefined`/non-serializable throw. Writer throws during render and bare test renders. Names unique per render and part of structural identity — declare unconditionally, identical every render; delta throws. Custom hook inherits the rule. Throws in subagent renders. Parts land on the wire as data parts of the conversation message and on `AgentReply.data`.

#### `useAgentStart()`
```ts
function useAgentStart(run: (ctx: AgentStartContext) => void | Promise<void>): void;
interface AgentStartContext { readonly append: (message: AgentAppendMessage) => void; readonly harness: FlueHarness; readonly log: FlueLogger; readonly signal: AbortSignal; }
```
- Intake seam: after input durable, before the model's first turn. Awaitable, may be async; throw fails submission; at-least-once, durable outcomes atomic per seam. Runs once per delivered message, before the model reads it; not reactive. Runs concurrently, no guaranteed order; model waits for the slowest. Appended signals grouped in declaration order regardless of completion.
- `ctx.append` writes a signal into this response without registering a delivery (no own `useAgentStart`, no submission). Same shape/validation as `useAgentFinish`'s `append`. Legal only during the callback window; a captured reference throws afterwards. `ctx.harness` materialized lazily on first access. `ctx.signal` = submission's abort signal. `ctx.log` emits progress lines (model never sees). Compaction can fold signals away; keep substance in durable state/files.

#### `useAgentFinish()`
```ts
function useAgentFinish(run: (ctx: AgentFinishContext) => void | Promise<void>): void;
interface AgentFinishContext {
  readonly response: { readonly toolCalls: readonly AgentResponseToolCall[]; readonly usage: PromptUsage; };
  readonly append: (message: AgentAppendMessage) => void;
  readonly harness: FlueHarness; readonly log: FlueLogger; readonly signal: AbortSignal;
}
interface AgentResponseToolCall { tool: string; isError: boolean; }
interface AgentAppendMessage { kind: 'signal'; type: string; body: string; attributes?: Record<string, string>; tagName?: string; }
```
- Enforcement seam at would-stop points. Control seam: awaited before the response settles; `ctx.append` steers a signal into the same response (another turn runs; hook re-runs at the next would-stop point). Response settles only when a cycle completes with no appends AND no delivered input waiting; queued deliveries join before finish evaluation.
- `append` accepts only `kind: 'signal'` (same validation as delivered signals: non-empty `type`, string `body`, string→string `attributes`, XML-name `tagName`); `kind: 'user'` throws. Framework-reserved signal types throw. Legal only during the callback window.
- Append vs dispatch: append = response steering itself (no `useAgentStart`, no own submission, counted against the continuation ceiling); dispatch from callback = real delivery (joins the same response, own `useAgentStart`, never counted against the ceiling).
- Runs on delivered submissions only, declaration order, sequentially; multiple hooks share each cycle; response continues if any appended. `response.toolCalls` aggregates every tool call across all turns/re-attempts from durable records. `response.usage` aggregate so far.
- Durable: a continued cycle = response-control checkpoint recorded atomically with its signals; resumed response drives the pending continuation, never re-runs a completed cycle or appends twice. **Runaway protection: fixed ceiling of 32 continuation cycles per response**, not configurable. Durability timeout remains the total wall-clock backstop.

#### `useResponseStart()`
```ts
function useResponseStart(run: ResponseMetadataCallback<ResponseStartContext>): void;
type ResponseMetadataCallback<TCtx> = (ctx: TCtx) => Record<string, unknown> | void;
interface ResponseStartContext { readonly metadata: Record<string, unknown>; readonly log: FlueLogger; }
```
- Once per response, synchronously, before the first model call and before any `useAgentStart`. Return a plain object → deep-merged onto the response message's metadata (AI SDK: message's `metadata` field). Return nothing to observe only. Joined deliveries don't re-fire. Resume with existing durable assistant steps skips it; re-attempt from before the first durable step re-runs it (at-least-once).
- Synchronous observer: no append/dispatch/harness. Returned promise fails submission. `ctx.metadata` = accumulated so far (earlier hooks' contributions, declaration order). Merge: later keys win, `undefined` skipped, prototype-polluting keys (`__proto__`, `constructor`, `prototype`) dropped. Non-object/array/promise return fails submission. Fail-fast: throw fails submission, no retry/recovery. Metadata model-invisible, non-reactive; runtime stamps no keys. Reaches clients on the conversation stream and `AgentReply.metadata`.

#### `useResponseFinish()`
```ts
function useResponseFinish(run: ResponseMetadataCallback<ResponseFinishContext>): void;
interface ResponseFinishContext {
  readonly metadata: Record<string, unknown>;
  readonly response: { readonly usage: PromptUsage; readonly toolCalls: readonly AgentResponseToolCall[]; };
  readonly log: FlueLogger;
}
```
- Once per response, synchronously, after the last `useAgentFinish` cycle settles and every queued output write is flushed. Same return contract/merge rules/failure semantics as `useResponseStart`. Final `usage`/`toolCalls` aggregates. `ctx.metadata` includes `useResponseStart` contributions (read from the durable record log, survives re-attempts) plus earlier finish hooks'.

#### Custom hooks
- Plain function, `use` prefix by convention, calls other hooks. No registration/wrapper; ambient render frame. Takes args, returns values, composes. Called outside render → throws at the first inner hook call. Per-render uniqueness counts through any depth.
### 05-agent-behavior.md

"AI-generated, awaiting review" — behavior map.

#### Built-in sandbox tools (6, when sandbox attached)
- **`read`** — `path`, optional `offset` (1-indexed line), `limit` (max lines). Output truncated to **2000 lines or 50 KB** whichever first, never mid-line; ends with a marker naming the shown range + `Use offset=N to continue.` Offset past end = error naming actual line count. A single oversized line → first 50 KB + note remainder unreachable via offset/limit.
- **`write`** — `path`, `content`; creates file + missing parent dirs; overwrites silently.
- **`edit`** — `path`, `oldText`, `newText`, optional `replaceAll`. Zero matches = error (check whitespace/indentation); multiple matches = error (more context) unless `replaceAll` (replaces every occurrence, reports count). Read → replace → write atomic per file; same-file mutations from `write`/`edit` serialized through a per-path lock; concurrent `bash` mutation of the same file not synchronized.
- **`bash`** — `command`, optional `timeout` (seconds). Combined stdout/stderr truncated to **last** 2000 lines or 50 KB (tail). Non-zero exit appends exit code. Timeout exceeded → recoverable `exit-124` result.
- **`grep`** — `pattern` (regex), optional `path`, `include` (glob), `literal`. Runs `rg` in the sandbox when available (probed once), else POSIX `grep -E`. Matching lines with file paths + line numbers, capped at **100 matches**, **500 chars per line**; cap reported with advice.
- **`glob`** — `pattern`, optional `path`. Shell `find -name` semantics (names, not paths), up to **1000** paths.

#### Framework tools (independent of sandbox)
- `task` (always present; inert until agents declared), `activate_skill` (when skills), `read_skill_resource` (when imported skill packages resource files). Names reserved — a custom tool can't take them. Sandbox adapter may replace the six tools with its own set.

#### Environment defaults
- No sandbox unless attached; at most one. Without sandbox: no six tools, no workspace context in the system prompt, no workspace skills, `harness.sandbox` throws. Everything else same. Presence re-read every turn boundary; swap narrated as an `environment` signal.

#### Message handling
- Every input admitted as a **submission**, recorded durably before any model work. Queue in admission order. One submission runs at a time. Busy agent: message joins the live response at the next turn boundary when it can, else waits as its own submission. Nothing dropped. Every accepted submission reaches exactly one durable terminal outcome — `completed`, `failed`, or `aborted`.

#### Context composition
- At initialization: system prompt composed from returned instructions + (with sandbox) working directory path, directory listing, `AGENTS.md` when present, discovered skill/subagent/tool rosters. System prompt then **frozen** until the next compaction rebaselines. Mid-window changes narrated as append-only signals.

#### Context management
- Threshold compaction triggers when used tokens exceed window minus model-aware reserve (capped 20,000); most recent 8,000 tokens kept verbatim by default.

#### Limits table
| Limit | Value |
| --- | --- |
| read output | 2000 lines / 50 KB, head-truncated with continuation marker |
| bash output | 2000 lines / 50 KB, tail-truncated |
| grep results | 100 matches, 500 chars per line |
| glob results | 1000 paths |
| Delegation depth | 4 — task chain (incl. harness invocations) deeper fails with `delegation_depth_exceeded` |
| Compaction reserve | model-aware, capped at 20,000 tokens |
| Kept verbatim after compaction | 8,000 tokens by default |

Tool-set size has no framework cap.

### 06-provider-api.md

**Exports/imports:**
```ts
import { setProvider } from '@flue/runtime';
import { cloudflareBindingProvider, type CloudflareAIBinding, type CloudflareBindingProviderOptions } from '@flue/runtime/cloudflare/workers-ai';
import { type CloudflareGatewayOptions } from '@flue/runtime/cloudflare';
// Provider construction is Pi's API, used directly:
import { createProvider, envApiKeyAuth } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
```

#### The `providers` config
```ts
// vite.config.ts
flue({ providers: ['anthropic', 'openai'] });
```
- Each entry maps to a `@earendil-works/pi-ai/providers/<id>` factory import in the generated entry — except `'cloudflare'`, which selects Flue's own Workers AI binding provider.
- Omitted: every built-in registers (incl. Workers AI binding provider on Cloudflare target); zero-config resolution with env credentials (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …).
- Set: exhaustive list; unlisted provider fails at model resolution; `'cloudflare'` on Node target = config error. Unknown ID fails the build. User registrations win (generated registrations skip already-registered IDs). `flue run` ignores the list (loads only the agent module; always full built-in set).
- Same field accepted in `flue.config.ts`; inline plugin options win per field.

#### `setProvider()`
```ts
function setProvider(provider: Provider): void;
```
- Registers a Pi `Provider` keyed by `provider.id`; `'acme/some-model'` resolves through it. Accepts built-in factory, `createProvider(...)`, `cloudflareBindingProvider(...)`, faux provider's `.provider`. Each call replaces the ID's previous provider. Registry module-scoped, in-memory; call at module top level.
- Node: one process hosts all agents. Cloudflare: `app.ts` evaluated in every DO isolate. `flue run` loads only the agent module. No network I/O, no credential validation at registration; no public unregister. Credentials resolve through the provider's own `auth`.

#### Model resolution
- Specifier `'provider-id/model-id'`, split at the first `/`. Per model call, live registry.
1. Provider ID must be registered; unknown → throw naming registered IDs and both registration paths.
2. Model ID must be declared (`provider.getModels()`); unknown → throw listing declared IDs.
3. Exception — dynamic-model template (`cloudflareBindingProvider()` is the only one Flue ships): resolves undeclared model IDs with zero metadata: `reasoning: false` (forwarded `thinkingLevel` dropped), `input: ['text']` (image blocks → `"(image omitted)"` placeholder), `contextWindow: 0` (threshold compaction cannot engage), `maxTokens: 0`, all-zero cost. A gateway-vendor ID (`anthropic/…`, `openai/…`) hitting the fallback logs a one-time-per-ID warning naming the model + degradation; `@cf/…` IDs resolve silently.
- Resolution failures throw plain `Error`s (not `FlueError`). Specifier with no `/` or empty model ID (`'acme/'`) invalid. Metadata lives on provider `Model` objects; no separate override surface.

#### `cloudflareBindingProvider()`
```ts
function cloudflareBindingProvider(options: CloudflareBindingProviderOptions): Provider;
interface CloudflareBindingProviderOptions { binding: CloudflareAIBinding; gateway?: CloudflareGatewayOptions | false; streamIdleTimeoutMs?: number; }
```
- Dispatches via the binding's `run(modelId, payload, options)` in-process; no baseUrl/apiKey/HTTP endpoint. From `@flue/runtime/cloudflare/workers-ai` (deliberately not in the `@flue/runtime/cloudflare` barrel).
- `binding` — captured `env.AI` reference. `gateway` — tri-state: omitted routes through the Cloudflare default AI Gateway (options `{ id: 'default' }`, provisioned on demand); object replaces the default; `false` opts out (no gateway option passed to `run`).
- `streamIdleTimeoutMs` — cap on a silent stream; exceeded → retryable interruption, retried under the transient-error budget. Default five minutes. `0` disables.
- Registration on Cloudflare target: generated Worker entry runs `setProvider(cloudflareBindingProvider({ binding: env.AI }))` unless the `cloudflare` ID is already registered; `app.ts` imports hoisted above the generated body so user registration wins. `providers` without `'cloudflare'` emits neither registration nor import.
- Metadata hydration: declares the Pi `cloudflare-workers-ai` catalog re-tagged onto the `cloudflare` ID + joins the `cloudflare-ai-gateway` catalog; gateway bare model IDs prefixed with vendor from the gateway URL path segment (`gpt-5.6-terra` → `openai/gpt-5.6-terra`); gateway `/compat` entries skipped.
- Wire format: catalog's `api` first; for unknown IDs vendor prefix (`anthropic/…` → Anthropic Messages, `openai/…` → OpenAI Responses); OpenAI-compatible chat-completions for `@cf/…` and unknown vendors. The Responses branch delegates protocol to pi-ai primitives, maps reasoning through the catalog `thinkingLevelMap`, requests encrypted reasoning content for stateless replay. Catalog `api` with no binding branch → explicit stream error. Every shape via `binding.run` with `returnRawResponse: true` + resolved `gateway`; body carries no `model` field.
- Failures: non-OK binding responses → `CloudflareAIBindingError` (`type: 'cloudflare_ai_binding_error'`), exported from `@flue/runtime/cloudflare`; 413 additionally carries `meta.reason: 'request_too_large'` and triggers compaction recovery.
- Node import safety: factory + types importable on Node (binding structural); only calling a model needs a real binding.

#### `CloudflareGatewayOptions`
```ts
interface CloudflareGatewayOptions {
  id: string; skipCache?: boolean; cacheTtl?: number; cacheKey?: string;
  metadata?: Record<string, number | string | boolean | null | bigint>;
  collectLog?: boolean; eventId?: string; requestTimeoutMs?: number;
}
```
- Exported from `@flue/runtime/cloudflare`. Every field except `requestTimeoutMs` forwarded verbatim in the `gateway` option. `id` required whenever gateway options are specified. `skipCache` bypasses cache. `cacheTtl` seconds. `cacheKey` override. `metadata` on the gateway log entry. `collectLog` force log collection. `eventId` log correlation. `requestTimeoutMs` — gateway-enforced bound on time to first part (not total); emitted as the `cf-aig-request-timeout` header (binding has no equivalent).

#### `CloudflareAIBinding`
```ts
interface CloudflareAIBinding { run(modelId: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<Response | Record<string, unknown>>; }
```
- Minimal structural shape, exported from `@flue/runtime/cloudflare`. Structural (not Cloudflare's `Ai` type) for Node importability.

#### Provider telemetry normalization (providerName)
| Provider ID | providerName |
| --- | --- |
| amazon-bedrock | aws.bedrock |
| azure-openai-responses | azure.ai.openai |
| google | gcp.gemini |
| google-vertex | gcp.vertex_ai |
| mistral | mistral_ai |
| moonshotai, moonshotai-cn | moonshot_ai |
| xai | x\_ai |

- IDs outside the table pass through unchanged. `providerId` always reported unmodified. Server host/port parsed from the resolved model's `baseUrl`.

#### What registration does not change
- Pi's catalog itself (shadows one ID at resolution). Anything durable (in-memory only). Earlier registrations of other IDs.

### 07 — Streaming protocol
Wire protocol for `createAgentRouter(agent)`-served conversation reads/writes; identical on Node and Cloudflare. `@flue/sdk` wraps it. Routes relative to mount + conversation id:
- `POST /:id` — deliver one message (202 admission). `GET /:id` — `view=history` (default) = snapshot; `view=updates` = incremental chunks, optionally live (long-poll / SSE). `HEAD /:id` — stream metadata as headers. `POST /:id/abort` — abort in-flight + queued work. `GET /:id/attachments/:attachmentId` — attachment bytes.
- `:id` non-empty; empty/whitespace → `invalid_request` (400). Unlisted method → `method_not_allowed` (405) + `Allow`. Never-received-a-message conversation → `stream_not_found` (404) on all read routes (stream created by first admitted `POST`).

#### Offsets
```
0000000000000000_0000000000000003
```
- Two 16-digit zero-padded integers joined by `_` (Durable Streams format); first component always `0` in Flue. `-1` = "before the first batch" — reading from `-1` replays the whole conversation.
- Address durable record **batches**, not messages; a batch with only internal records projects to zero chunks → empty updates but advancing `Stream-Next-Offset`. Opaque: take from responses and pass back verbatim. Reads exclusive — at `X` returns data recorded **after** `X`.
- Past head → `conversation_stream_store_failure` (500). Malformed (not `-1` or two-component) → `invalid_request` (400).

#### Coordination headers
- `Stream-Next-Offset` — resume offset (202 admission, snapshot, non-SSE updates, `HEAD`; in SSE rides `control` events). `Stream-Up-To-Date` — `true` when response reached the durable head; absent (never `false`) when more data; always `true` on snapshot + `HEAD`. `Location` — 202 only, the stream URL (mirrors `streamUrl`). Browsers need `Access-Control-Expose-Headers` to read these cross-origin.

#### `POST /:id` — message admission
JSON body, `DeliveredMessage` shape + two optional reserved top-level siblings. `@flue/sdk` exports `DeliveredMessage`, `DeliveredAttachment`.
```ts
type PromptBody = DeliveredMessage & { initialData?: unknown; uid?: string | null; };
type DeliveredMessage =
  | { kind: 'user'; body: string; attachments?: DeliveredAttachment[] }
  | { kind: 'signal'; type: string; body: string; attributes?: Record<string, string>; tagName?: string; };
type DeliveredAttachment = { type: 'image'; data: string; /* base64 */ mimeType: string; filename?: string; };
```
- `user`: attachments images only; `data` base64 capped at **14,680,064 chars (14 × 1024 × 1024)** — longer → `invalid_request` (400). `signal`: `type` non-empty; `body` plain string (JSON-stringify structured payloads); `tagName` must match `^[A-Za-z_][A-Za-z0-9_.-]*$` (rendered unescaped as the signal envelope) — looser → `invalid_request` (400).
- `initialData` — consulted only when the send creates the conversation; schema mismatch → `invalid_request` (400) before anything durable. `uid` condition: string → only that incarnation (absent/mismatch → `agent_instance_not_found` 404); `null` → create only when none exists (existing → `agent_instance_exists` 409, `details` names it); omitted = unconditional. String `uid` + `initialData` = contradiction → `invalid_request` (400). Failed conditions leave nothing durable.
- Bare-string shorthand is **not** on the wire — object shape only, else `invalid_request` (400). Accepts W3C `traceparent`/`tracestate`; a valid `traceparent` links the submission to the caller's distributed trace.
**Admission response** — `202 Accepted` once durably admitted, before the agent runs:
```ts
{ streamUrl: string; /* read URL, query stripped */ offset: string; /* durable head at admission */ submissionId: string; /* settlement identity */ uid: string; /* contacted instance's uid */ }
```
- `streamUrl` = request URL minus query; mirrored as `Location`. `offset` — durable head after the message was recorded; updates from it observe everything the agent produces without replaying; mirrored as `Stream-Next-Offset`. `submissionId` — matches the `submission-settled` chunk and snapshot `settlements`. `uid` — pass back as a `uid` send condition.
- No synchronous wait: any `?wait` query → `invalid_request` (400). Read the stream or use SDK `wait(...)`. Non-JSON body → `unsupported_media_type` (415) with wrong `Content-Type`, or `invalid_json` (400) when unparseable.

#### `GET /:id?view=history` — snapshot
- `view=history` is default. Any other `view`, or `view=history` + `offset`/`tail`/`live` → `invalid_request` (400).
- `200`, `application/json`, `Cache-Control: no-store`, `Stream-Next-Offset` = snapshot `offset`, `Stream-Up-To-Date: true`. Reduces every message to render-ready parts.
**Snapshot shapes** (`@flue/sdk` exports `FlueConversationSnapshot`, `FlueConversationMessage`, `FlueConversationPart`, `FlueConversationSettlement`):
```ts
interface FlueConversationSnapshot {
  v: 1;
  conversationId: string;
  offset: string;
  messages: FlueConversationMessage[];
  settlements: FlueConversationSettlement[];
}
interface FlueConversationSettlement { submissionId: string; outcome: 'completed' | 'failed' | 'aborted'; error?: unknown; }
interface FlueConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  purpose: 'user' | 'assistant' | 'dispatch' | 'advisory';
  display: 'visible' | 'hidden' | 'diagnostic';
  submissionId?: string;
  turnId?: string;
  signal?: { tagName?: string; attributes?: Record<string, string> };
  settlement?: { outcome: 'failed' | 'aborted' };
  parts: FlueConversationPart[];
  metadata?: Record<string, unknown>;
}
type FlueConversationPart =
  | { type: 'text'; text: string; state: 'streaming' | 'done' }
  | { type: 'reasoning'; text: string; state: 'streaming' | 'done' }
  | { type: `data-${string}`; data: unknown }
  | { type: 'file'; mediaType: string; id?: string; size?: number; url?: string; filename?: string }
  | { type: 'dynamic-tool'; toolName: string; toolCallId: string; state: 'input-available'; input: unknown }
  | { type: 'dynamic-tool'; toolName: string; toolCallId: string; state: 'output-available'; input: unknown; output: unknown; durationMs?: number }
  | { type: 'dynamic-tool'; toolName: string; toolCallId: string; state: 'output-error'; input: unknown; errorText: string; durationMs?: number };
```
- `v` currently `1`. `offset` — durable head through which the snapshot was reduced; resuming updates from it yields exactly the changes after. `messages` — transcript in order; one assistant message = one whole response (every model step folds into its first assistant message). `settlements` — terminal outcome of every settled submission; `error` = caller-safe.
- `role` render lane; `purpose` (`dispatch` = delivered signals, `advisory` = runtime advisories); `display` (`visible` chat, `diagnostic` activity panel, `hidden` plumbing). `signal` only on `system`-role messages from signal deliveries. `settlement` only on the terminal advisory for a `failed`/`aborted` submission.
- `metadata` entirely agent-authored (response-metadata hooks); `usage`/`model` are app conventions. `parts`: `data-<name>` = named client data writes; `file` parts reference attachments by `id` (`url` never server-set); `dynamic-tool` progress `input-available` → `output-available`/`output-error`; `durationMs` = tool-handler execution time.
- One conversation per agent instance (default root conversation); child conversations never exposed; canonical durable record schema never exposed.

#### `GET /:id?view=updates` — updates
- `offset` — required, exactly once: `-1` or a previously returned offset; else → `invalid_request` (400). `live` — optional `long-poll` | `sse`; else → `invalid_request` (400). `tail` — unsupported → `invalid_request` (400).
- Without `live`: `200`, `application/json`, `Cache-Control: no-store`, `Stream-Next-Offset` + `Stream-Up-To-Date: true` when caught up; body = chunk array (empty when nothing after `offset`).
- **At most 100 durable batches per response** (fixed page size). When `Stream-Up-To-Date` absent, next read from the returned `Stream-Next-Offset`. Chunks are deltas against state at `offset`; resume only from a held offset (`-1` → fresh read begins with `conversation-reset` carrying a full snapshot). Reconstructs reduced state through `offset` before projecting; no persisted replay cache — setup cost grows with stream length.
**`live=long-poll`**: holds until new data or a **30-second window**: new data → `200` chunk array; timeout → `200` empty `[]`, `Stream-Next-Offset` unchanged, `Stream-Up-To-Date: true`, re-issue. Client disconnect while parked → status `499`.
**`live=sse`**: holds open indefinitely. `200`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`.
```
event: data
data:[{ "type": "message-delta", ... }, ...]
event: control
data:{"streamNextOffset":"0000000000000000_0000000000000007","upToDate":true}
: heartbeat
```
- `data` events — JSON array of chunks, one per read cycle, only when the cycle produced chunks. `control` events — `streamNextOffset` (string), `upToDate` (present `true` only when caught up); emitted after every read cycle incl. empty ones (a caught-up stream still produces one ≥ every 30 s). Reconnect from the last `streamNextOffset`.
- `: heartbeat` every **15 seconds**. Never ends server-side; runs until disconnect. SSE is at-least-once across reconnects — dedupe by `position`.
**`ConversationStreamChunk`** (`@flue/sdk` exports the union; app code should use the SDK's materialized `observe()` state):
```ts
type ConversationStreamChunk = ChunkBody & { position: { batch: number; index: number } };
type ChunkBody =
  | { type: 'conversation-reset'; conversationId: string; snapshot: FlueConversationSnapshot }
  | { type: 'message-appended'; conversationId: string; message: FlueConversationMessage }
  | { type: 'message-started'; conversationId: string; messageId: string; submissionId?: string; turnId?: string; metadata?: Record<string, unknown>; timestamp?: string }
  | { type: 'message-metadata'; conversationId: string; messageId: string; metadata: Record<string, unknown> }
  | { type: 'data-part'; conversationId: string; messageId: string; name: string; data: unknown }
  | { type: 'message-delta'; conversationId: string; messageId: string; kind: 'text' | 'reasoning'; delta: string }
  | { type: 'tool-input'; conversationId: string; messageId: string; toolCallId: string; toolName: string; input: unknown; timestamp?: string }
  | { type: 'tool-output'; conversationId: string; toolCallId: string; output: unknown; durationMs?: number; timestamp?: string }
  | { type: 'tool-output-error'; conversationId: string; toolCallId: string; errorText: string; durationMs?: number; timestamp?: string }
  | { type: 'message-completed'; conversationId: string; messageId: string; timestamp?: string }
  | { type: 'submission-settled'; conversationId: string; submissionId: string; outcome: 'completed' | 'failed' | 'aborted'; error?: unknown; timestamp?: string };
```
- `position` — monotonic ordering: `batch` = durable batch ordinal, `index` = position in that batch's projection; compare lexicographically to dedupe; otherwise opaque.
- `conversation-reset` — replace all state with the embedded snapshot; emitted at structural boundaries (creation, compaction); subsumes every other chunk of its batch. Check `snapshot.settlements` too. `message-appended` — complete user turn or system signal.
- `message-started` — assistant response opened; assistant chunks pre-coalesced — every model step addresses the submission's first assistant `messageId`; a later `message-started` for an open `messageId` = continuation. `message-metadata` — merge agent-authored metadata. `data-part` — append a `data-<name>` part. `message-delta` — append to the open `text`/`reasoning` part (open one if none); kind change or `message-completed` closes it.
- `tool-input`/`tool-output`/`tool-output-error` — lifecycle by `toolCallId`; output updates the matching `dynamic-tool` part. `message-completed` — mark streaming parts `done`. `submission-settled` — terminal outcome matching the admission `submissionId`.
- `timestamp` — ISO 8601 capture time of the durable record, on boundary chunks; `message-delta` deliberately omits it — interpolate.

#### `HEAD /:id`
`Content-Type: application/json`, `Cache-Control: no-store`, `Stream-Next-Offset` (current head), `Stream-Up-To-Date: true`, no body. Missing stream → `404` with error headers, no body.

#### `POST /:id/abort`
Aborts the running submission + everything queued. No body required. `200`:
```ts
{ aborted: boolean }
```
`true` when in-flight/queued work existed; `false` when idle. Records durable intent, returns immediately; affected submissions settle `aborted` asynchronously (observe via `submission-settled` chunks or snapshot `settlements`). Non-`POST` → `405`, `Allow: POST`.

#### `GET /:id/attachments/:attachmentId`
`:attachmentId` = `id` of a `file` part; URI-encode. Scoped to the default root conversation — child-conversation attachments never served → `attachment_not_found` (404); unknown id → `attachment_not_found` (404); nonexistent conversation → `stream_not_found` (404).
- `200` raw bytes: `Content-Type` (stored MIME), `Content-Length`, `Content-Disposition: inline`, `Cache-Control: private, max-age=31536000, immutable` (digest-keyed), `Content-Security-Policy: sandbox`. Non-`GET` → `405`, `Allow: GET`.

#### Error responses
Canonical envelope, `Content-Type: application/json`:
```ts
{
  error: {
    type: string;      // stable machine-readable category
    message: string;
    details: string;
    dev?: string;      // local development only
    meta?: Record<string, unknown>;
  };
}
```
- Branch on `type`; message prose is not API. Statuses: `invalid_request`, `invalid_json` (400); `agent_instance_not_found`, `stream_not_found`, `attachment_not_found` (404); `method_not_allowed` (405); `agent_instance_exists` (409); `unsupported_media_type` (415); `runtime_unavailable` (503, local dev reloads, with `Retry-After`); `internal_error` / `conversation_stream_store_failure` (500). Unknown failures never leak the original message — generic `internal_error`.

#### Fixed response headers
Every read and error response: `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: cross-origin`. No `Access-Control-*` (CORS is app middleware), no auth challenges, no `ETag`/`Last-Modified` — offsets are the resume mechanism; conversation responses are `no-store`.

### 08 — Events
Event surface of `@flue/runtime` (all symbols from there unless noted). v3 vocabulary = **27 event types**.

#### `observe()`
```ts
function observe(subscriber: FlueEventSubscriber): () => void;
type FlueEventSubscriber = FlueObservationSubscriber;
type FlueObservationSubscriber = (observation: FlueObservation, ctx: FlueEventContext) => void | Promise<void>;
```
- Isolate-global, live-only; returned function unsubscribes. Node: one registration sees everything. Cloudflare: per-DO-isolate; module-top-level subscriber runs in each isolate.
- Subscribers invoked synchronously on the emission path, after the runtime's own per-context consumers. One `FlueObservation` per emission — deep clone (cycles preserved), deep-frozen, same object to every subscriber.
- Subscriber throw → caught + logged (`console.error` with `[flue:observe]` prefix); remaining subscribers run; agent work unaffected. Returned promise observed for rejection, never awaited.
- Ordering: per-emitting-context in `eventIndex` order; no cross-context guarantee. No type filtering, backpressure, replay, mutation, or veto.
**`FlueEventContext`:**
```ts
interface FlueEventContext<TEnv = Record<string, any>> {
  readonly id: string;
  readonly agentName: string | undefined;
  readonly env: TEnv;
  readonly req: Request | undefined;
  readonly log: FlueLogger;
}
interface FlueLogger {
  info(message: string, attributes?: Record<string, unknown>): void;
  warn(message: string, attributes?: Record<string, unknown>): void;
  error(message: string, attributes?: Record<string, unknown>): void;
}
```
- `id` = agent instance id (= `instanceId` on the context's events). `agentName` — registered name when known. `env` — `process.env` (Node) / Workers env. `req` — the invocation Fetch `Request`, or `undefined` outside HTTP (recovered processing may carry a synthetic internal request). `log` — emits `log` events into this context's stream; calling from a subscriber emits further events (guard loops).

#### `FlueEvent`
```ts
type FlueEvent = FlueEventInput & { v: 3; eventIndex: number; timestamp: string; };
```
Correlation fields (every event type, all optional): `instanceId`, `submissionId`, `agentName`, `conversationId`, `session`, `parentSession`, `taskId`, `harness`, `operationId`, `turnId`.
- `v` — durable event-format version, literal `3`. `eventIndex` — per-context monotonic counter; ordering, not durable identity. `timestamp` — ISO 8601, stamped when decorated for delivery.
- `instanceId` on direct + dispatched activity. `submissionId` while a durable submission is processed. `conversationId`/`session` session-scoped. `harness` — emitting harness name; `"default"` for root agent, the hook's name for lifecycle-hook harnesses. `parentSession`/`taskId` inside a delegated task. `operationId` inside a running operation. `turnId` during a model turn.
- Ids opaque; correlate by equality. `FlueEventInput` internal, not exported.
- Content guarantees: **no raw image bytes** — recognized image content blocks carry `IMAGE_DATA_OMITTED`. **No throw-site stacks on durable-shaped error fields** (`operation`, `compaction`, `log`, `submission_recovery`, `submission_settled`); classified error shape with optional `stack` only live: `turn.response.error` and the observation's `errorInfo`.

#### Event types (27)
**agent_start / agent_end / idle**
```ts
{ type: 'agent_start' }
{ type: 'agent_end'; messages: AgentMessage[] }
{ type: 'idle' }
```
`agent_start` — agent loop run began inside an operation. `agent_end` — loop run ended; `messages` = messages the run produced (not the transcript). `AgentMessage` = harness-level shape (roles `user`, `assistant`, `toolResult`, plus internal `signal`); not exported, not stable. `idle` — session returned to idle after every terminal `operation`, success and failure; no payload.
**submission_queued / submission_running**
```ts
{ type: 'submission_queued'; submissionId: string; kind: 'dispatch' | 'direct' }
{ type: 'submission_running'; submissionId: string; kind: 'dispatch' | 'direct'; attemptCount: number; maxAttempts: number }
```
- Lifecycle `queued → running → settled`. `kind` = `dispatch` (via `dispatch()`) or `direct` (HTTP route).
- `submission_queued` — immediately after durable admission; delivery **at-least-once** (replays, incl. `idempotencyKey`-deduplicated retries, re-emit it). `submission_running` — an attempt began processing, before any model work; emitted on **every** attempt; recovery re-emits with incremented `attemptCount`.
- Delivery joining an already-busy conversation emits `submission_queued` + `submission_settled` but never `submission_running`. `submission_queued` fires outside any execution context (no `conversationId`/`session`; own `eventIndex` sequence); `submission_running` from the attempt's own context.
Busy/idle derivation (stable, supported): in an `observe` subscriber, add `submissionId` to a per-`instanceId` set on `submission_queued`/`submission_running`, delete on `submission_settled`. Converges across restarts: recovery re-emits `submission_running` before settlement; at-least-once emissions absorbed by set semantics.
**submission_recovery**
```ts
{
  type: 'submission_recovery';
  submissionId?: string; // absent for pass-wide failures
  kind?: 'dispatch' | 'direct';
  operation: 'materialize_submission' | 'finalize_settlement' | 'reconcile_submission' | 'start_submission' | 'process_submission' | 'reconcile_pass' | 'enforce_deadline';
  outcome: 'deferred' | 'agent_unavailable' | 'attempt_cap_deferred' | 'terminated';
  attemptCount?: number;
  maxAttempts?: number;
  error?: { name?: string; message: string; type?: string; details?: string; dev?: string; meta?: Record<string, unknown>; };
}
```
- A coordinator recovery/reconciliation step failed (or skipped work) and was contained rather than terminalizing the submission. Never reaches `submission_settled` — a submission stuck in a retry loop is visible here and nowhere else.
- `operation` values: `materialize_submission` (admission-side materialization), `finalize_settlement` (finalizing a settlement reserved by a dead process), `reconcile_submission` (classifying an interrupted attempt), `start_submission` (starting a claimed attempt), `process_submission` (processing/settlement), `reconcile_pass` (whole pass — `submissionId` absent), `enforce_deadline` (deadline passed or unhonored abort; `deferred` = settle-grace window before settling over a hung fiber).
- `outcome`: `deferred` (retried next wake), `agent_unavailable` (targets unregistered agent — retried until restored/aborted/unready auto-fail), `attempt_cap_deferred` (retained for compatibility; no longer emitted), `terminated` (failure swallowed so durable give-up proceeds). Persistent materialization failure settles failed past admission time + `durability.timeoutMs` (default **1 hour**), emitting `submission_settled` + a `terminated` recovery event; durable abort settles an unready row immediately.
- `error` durable-shaped, stackless; live observation additionally carries classified `errorInfo`. Re-emits on every failed wake (~every 30 s once on the scheduled backstop). Dedupe by (`submissionId`, `operation`). Live-only, best-effort, at-most-once per occurrence — the stream is a signal, never the ledger.
**submission_settled**
```ts
{ type: 'submission_settled'; submissionId: string; outcome: 'completed' | 'failed' | 'aborted'; error?: { name?: string; message: string; type?: string; details?: string; dev?: string; meta?: Record<string, unknown>; }; }
```
- Durable submission reached a terminal state; emitted on every terminal path (normal, failure, abort, recovery of an interrupted submission, incl. settlements reserved by a process that died before finalizing). Alert on terminal failures; pair with `submission_recovery` for failures that never terminalize.
- `error` present unless `outcome === 'completed'`. A `FlueError` keeps `name`/`message`/`type`/`details`/`meta`; any other failure is replaced by generic `internal_error` payload. Live observation adds classified `errorInfo` incl. stack. Emitted outside session scope (no `conversationId`/`session`); also durably appended to the canonical conversation stream.
**operation_start / operation**
```ts
{ type: 'operation_start'; operationId: string; operationKind: 'prompt' | 'skill' | 'task' | 'shell' | 'compact' }
{ type: 'operation'; operationId: string; operationKind: 'prompt' | 'skill' | 'task' | 'shell' | 'compact'; durationMs: number; isError: boolean; error?: unknown; result?: unknown; usage?: PromptUsage; }
```
- Bounds of one session operation; every started operation emits exactly one terminal `operation`. `operationId` generated per operation; every event inside carries it as a correlation field. `durationMs` wall-clock.
- `error` stackless: `FlueError` → `{ name, message, type, details?, meta? }`, plain `Error` → `{ name, message }`, non-`Error` thrown value as-is. `result` — the operation's return value on success. `usage` — aggregated `PromptUsage` when the result carries one (`prompt`, `skill`, `task`); the roll-up already includes the operation's `turn`-level usage — sum one level only.
**turn_start / turn_request / turn / turn_messages**
```ts
{ type: 'turn_start'; turnId: string; purpose: LlmTurnPurpose }
{ type: 'turn_request'; turnId: string; purpose: LlmTurnPurpose; request: ModelRequest }
{ type: 'turn'; turnId: string; purpose: LlmTurnPurpose; durationMs: number; request: ModelRequestInfo; response: ModelResponse; isError: boolean }
{ type: 'turn_messages'; turnId: string; purpose: LlmTurnPurpose; message: AgentMessage; toolResults: AgentMessage[] }
type LlmTurnPurpose = 'agent' | 'compaction' | 'compaction_prefix';
```
- One model call = one turn, correlated by `turnId`. `turn_start` — agent-purpose only; compaction turns emit `turn_request` + `turn` without it.
- `turn_request` — full model-visible request before the provider call; **in-process only**, never persisted or transported; the only event carrying system prompt, complete message context, and tool list. `turn` — completed call; `isError` true when the call threw or finished with reason `error`/`aborted`. `turn_messages` — turn boundary (assistant `message` + `toolResults`), after any tool batch durably committed; agent-purpose only.
- Normalized `turn` and detailed `turn_messages`/`message_*` describe the same activity — meter from one family only.
**`ModelRequest` / `ModelRequestInput` / `ModelRequestInfo`:**
```ts
interface ModelRequest extends ModelRequestInfo { input: ModelRequestInput; }
interface ModelRequestInput { systemPrompt?: string; messages: LlmMessage[]; tools?: LlmTool[]; }
interface ModelRequestInfo {
  providerId: string;
  providerName: string;
  requestedModel: string;
  api: string;
  serverAddress?: string;
  serverPort?: number;
  reasoningLevel?: string;
  maxTokens?: number;
  temperature?: number;
  contextCompacted?: true;
}
```
- `providerId` — registration key from the model specifier. `providerName` — semantic identity. `requestedModel` — model id Flue asked for. `api` — wire API. `serverAddress`/`serverPort` parsed from the provider endpoint. `reasoningLevel`/`maxTokens`/`temperature` present when set. `contextCompacted` declared in the format; current runtime does not populate it.
- `LlmMessage` (union of `LlmUserMessage`, `LlmAssistantMessage`, `LlmToolResultMessage`, built from `LlmTextContent`, `LlmThinkingContent`, `LlmImageContent`, `LlmToolCall`) and `LlmTool` exported from `@flue/runtime`. Image blocks in `turn_request` carry `IMAGE_DATA_OMITTED`; internal `signal` messages rendered into user-role text before appearing in input.
**`ModelResponse`:**
```ts
interface ModelResponse {
  responseId?: string;
  responseModel?: string;
  output?: LlmAssistantMessage;
  usage?: PromptUsage;
  finishReason?: string;
  providerFinishReason?: string;
  gatewayLogId?: string;
  error?: FlueErrorInfo; // see FlueObservation.errorInfo for the field shape
}
```
`responseId`/`responseModel` — provider-reported identity. `output` — assistant message in the exported `Llm` shape. `usage` — provider-reported token+cost for this single call (leaf level). `finishReason` — Flue normalized finish vocabulary. `providerFinishReason` — provider's exact value pre-normalization (telemetry only). `gatewayLogId` — Cloudflare AI Gateway log id (`cf-aig-log-id`) from response headers (telemetry only). `error` — classified error for a failed call, same shape as `errorInfo`, incl. throw-site `stack` when live.
**`PromptUsage`:**
```ts
interface PromptUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
}
```
Cost from the model catalog's per-million-token rates; currency matches the rate's denomination (USD for built-in commercial providers).
**Message and delta events:**
```ts
{ type: 'message_start'; message: AgentMessage; turnId: string }
{ type: 'message_end'; message: AgentMessage; turnId: string }
{ type: 'text_delta'; text: string }
{ type: 'thinking_start'; contentIndex?: number }
{ type: 'thinking_delta'; contentIndex?: number; delta: string }
{ type: 'thinking_end'; contentIndex?: number; content: string }
{ type: 'toolcall_delta'; toolCallId: string; toolName: string; argumentTextDelta: string }
```
- `message_start`/`message_end` bound every message the loop materializes; for assistant messages `message_end` carries the authoritative completed message — deltas are best-effort live progress (a subscriber registered mid-generation misses earlier deltas).
- `thinking_*` bound one streamed reasoning block; `thinking_end.content` = complete block; `contentIndex` = zero-based index in the assistant message's content array, when known. `toolcall_delta` — streamed JSON-arguments fragment, once `toolCallId`/`toolName` known; live-preview only, never persisted/replayed.
- Delta events carry no `turnId` payload field; correlate through the envelope's `turnId` correlation field.
**tool_start / tool:**
```ts
{ type: 'tool_start'; toolName: string; toolCallId: string; args?: any }
{ type: 'tool'; toolName: string; toolCallId: string; isError: boolean; result?: unknown; durationMs: number }
```
- Bounds of one tool execution, correlated by `toolCallId`. Emitted for model-invoked calls and programmatic `shell()` alike (`shell()` = `toolName: 'bash'`, observation `origin: 'caller'`).
- `args` declared in the format but not populated by the current runtime (normalized arguments on the live observation's `args`; canonical record carries them durably). `isError` true when the tool threw. `result` — harness-level shape (internal, not stable); image blocks carry `IMAGE_DATA_OMITTED`. `durationMs` measured once, shared with the durable record.
- Model-invoked terminal `tool` published when the turn's tool batch durably commits, not when execution finishes (an interrupted batch never publishes a terminal event). `shell()` publishes immediately. `shell()` per-call `env` values redacted to `<redacted>` (keys stay visible); a failed `shell()` carries an error-shaped result with `details.exitCode` = `-1`.
**task_start / task:**
```ts
{ type: 'task_start'; taskId: string; prompt: string; agent?: string; cwd?: string }
{ type: 'task'; taskId: string; agent?: string; isError: boolean; result?: any; durationMs: number }
```
- Bounds of one delegated task (`session.task()` or the model-facing `task` tool), correlated by `taskId`. `prompt` — delegated instruction text. `agent` — named subagent selected, when one was. `cwd` — task session working directory override, when set. `result` — assistant text on success; error message on failure.
- Both carry `parentSession` and the child's `session`/`conversationId` as correlation fields; events inside the task session carry `taskId` and `parentSession` themselves.
**compaction_start / compaction:**
```ts
{ type: 'compaction_start'; reason: 'threshold' | 'overflow' | 'manual'; estimatedTokens: number }
{ type: 'compaction'; messagesBefore: number; messagesAfter: number; durationMs: number; isError: boolean; error?: unknown; usage?: PromptUsage }
```
- Bounds of one context compaction; every `compaction_start` followed by exactly one terminal `compaction`. `reason`: `threshold` (configured window crossed), `overflow` (automatic recovery from context-overflow), `manual` (explicit `compact()`).
- `estimatedTokens` — estimated token size being summarized. `messagesBefore`/`messagesAfter` — live message counts. `error` same shape as `operation.error`; a failed manual compaction rejects the `compact()` call; a failed automatic one is best-effort, observable only here. `usage` — aggregated usage of the summarization call(s) (those calls also emit `turn_request`/`turn` with purpose `compaction`/`compaction_prefix`). A compaction finding nothing to compact emits no events.
**log:**
```ts
{ type: 'log'; level: 'info' | 'warn' | 'error'; message: string; attributes?: Record<string, unknown> }
```
- Emitted by `ctx.log`, a tool's run-context `log`, lifecycle-hook `log`, and runtime diagnostics (prefixed `[flue:...]` in `message`). An `Error` under `attributes.error` → stackless event-error shape; runtime stamps provenance — tool logs carry `tool` + `toolCallId`, hook logs carry `hook` + `hookIndex`. Runtime events only: never shown to the model or in a client-rendered conversation.

#### Event order (one durable submission, single tool-calling turn, uncontended)
1. `submission_queued` at admission → 2. `submission_running` → 3. `operation_start`, `agent_start` → 4. `message_start`/`message_end` (user) → 5. `turn_start`, `turn_request` → 6. `message_start` (assistant); `text_delta`, `thinking_*`, `toolcall_delta` interleave → 7. `turn`, then `message_end` (assistant) → 8. per tool: `tool_start`, then `message_start`/`message_end` for its tool-result message → 9. terminal `tool` events when the batch commits, then `turn_messages` → 10. repeat from 5 until no tool calls → 11. `agent_end`, `operation`, `idle` → 12. `submission_settled`.
Joined delivery can interleave additional user `message_start`/`message_end` pairs at turn boundaries — it contributes its own `submission_queued` + `submission_settled` but no `submission_running`.

#### `FlueObservation`
```ts
type FlueObservation = FlueEvent & {
  agentInput?: { text: string; images?: Array<{ mimeType: string }> };
  agentOutput?: { type: 'text'; text: string; finishReason: string } | { type: 'data'; data: unknown };
  origin?: 'model' | 'caller' | 'framework' | 'adapter';
  description?: string;
  args?: unknown;
  effectiveResult?: unknown;
  toolCallId?: string;
  errorInfo?: {
    type: string;
    name?: string;
    code?: string;
    message?: string;
    meta?: Record<string, unknown>;
    stack?: string;
  };
};
```
- The shape `observe()` delivers; every detail field is **live-only** — never persisted, replayed, or transported.
- `agentInput` — prompt text + image manifest (MIME types only, no bytes); on terminal `operation` for `prompt`/`skill`, and `task_start`. `agentOutput` — freeform text with finish reason, or validated structured `result:`-schema data; on successful `operation` (`prompt`/`skill`) and `task`.
- `origin` — who initiated a tool call (`model`, `adapter`, `framework`, `caller`); on `tool_start`/`tool`. `description` — tool description; on `tool_start`/`tool` for model-invoked calls. `args` — normalized arguments; on `tool_start`. `effectiveResult` — result as the model sees it (single text blocks collapsed to string; images → `IMAGE_DATA_OMITTED`); on successful `tool`. `toolCallId` — on `task_start` when raised by a model `task` tool.
- `errorInfo` — classified error for failed `operation`/`tool`/`task`/`compaction`/`submission_recovery`/`submission_settled` (failed turns carry the `turn.response.error` shape instead). `type` = stable category (a `FlueError`'s `type`, else `code`, `name`, or `_OTHER`); `meta` framework-owned; `stack` only when observed live from a thrown `Error` (filesystem paths + deployment layout exposed — why in-process only).
- Observations deep-frozen, read-only. `FlueObservationDetail` and `FlueErrorInfo` not exported as standalone types.

#### `IMAGE_DATA_OMITTED`
```ts
const IMAGE_DATA_OMITTED = '[image data omitted from event]';
```
Sentinel replacing raw base64 image bytes in every event payload (message-bearing fields, `tool` results, `turn_request`/`turn` content, observation `effectiveResult`); presence + `mimeType` kept. Session history + canonical attachments retain real bytes. Exported from both `@flue/runtime` and `@flue/sdk`.

#### `instrument()`
```ts
function instrument(instrumentation: FlueInstrumentation): () => Promise<void>;
interface FlueInstrumentation {
  key?: symbol;
  observe: FlueObservationSubscriber;
  interceptor: FlueExecutionInterceptor;
  dispose(): void | Promise<void>;
}
```
- Installs an event subscriber (registered exactly as `observe()` would) + an execution interceptor wrapping live execution; used by tracing adapters such as `@flue/opentelemetry`. Returns a dispose function.
- `key` — optional identity symbol. While installed, installing another with the same key throws `InstrumentationAlreadyInstalledError` (a `FlueError`, `type: 'instrumentation_already_installed'`) in production; in dev the newest wins and the prior is disposed.
- `observe` — same contract as `observe()`. `interceptor` joins the process-wide chain for the installation's duration. `dispose` — bundle teardown (flush exporters, shut down providers); called by the returned dispose after the subscriber + interceptor are unregistered.
- Returned dispose memoized + idempotent: `instrument()` again with the same object returns the same function without reinstalling. Node: module-scope installs are not disposed at server shutdown (integration registers its own signal handling); survives dev reloads via key replacement. Cloudflare: installs live/die with the isolate.

#### `FlueExecutionInterceptor`
```ts
type FlueExecutionInterceptor = <T>(operation: FlueExecutionOperation, ctx: FlueExecutionContext, next: () => Promise<T>) => Promise<T>;
type FlueExecutionOperation =
  | { type: 'agent'; operationId: string; operationKind: 'prompt' | 'skill' | 'task' }
  | { type: 'model'; turnId: string }
  | { type: 'tool'; toolCallId: string; toolName: string }
  | { type: 'task'; taskId: string };
interface FlueExecutionContext {
  eventContext?: FlueEventContext;
  instanceId?: string;
  submissionId?: string;
  agentName?: string;
  conversationId?: string;
  harness?: string;
  session?: string;
  operationId?: string;
  turnId?: string;
  taskId?: string;
  traceCarrier?: { traceparent: string; tracestate?: string };
}
```
- Middleware around live execution, via `instrument()`; compose in registration order; each receives a `next` continuation.
- **Wrapped operations:** `agent` wraps a submission run and each `prompt`/`skill` session operation (`operationId` = submission id at submission scope with `operationKind: 'prompt'`, the operation id at session scope; declared `operationKind: 'task'` not raised by the current runtime — delegation is the `task` operation type); `model` wraps each provider call, correlated to `turn` events by `turnId`; `tool` wraps each tool execution; `task` wraps each delegated task. Scopes nest: `model` runs inside its enclosing `agent` interception's async context.
- **`next` exactly-once** — a second call rejects `Error("Flue execution next() called more than once.")`; not calling it skips the wrapped work and the rest of the chain; the interceptor's return becomes the operation's result.
- **`ctx` fields:** submission scope carries `instanceId`, `submissionId`, `agentName`, `traceCarrier`; session scope carries `instanceId`, `harness`, `conversationId`, `session`, `operationId`, and when active `turnId`/`taskId`. `traceCarrier` = validated W3C `traceparent`/`tracestate` from the originating request. `eventContext` declared but not populated.
- Interceptors run on the execution path: a slow interceptor slows the agent; a throwing interceptor fails the wrapped operation.

#### `AttachedAgentEvent`
```ts
type AttachedAgentEvent = FlueEvent & { instanceId: string; };
```
A `FlueEvent` from a direct attached-agent interaction, with `instanceId` required rather than optional. Typing convenience for per-instance live streams; attached-agent events are live activity, not durable history.

#### Stable contract vs internal shapes
- **Stable, exported from `@flue/runtime`:** the envelope (`v`, `eventIndex`, `timestamp`) and correlation fields; event type names + payload fields on this page; `ModelRequest`, `ModelRequestInput`, `ModelRequestInfo`, `ModelResponse`, `PromptUsage`, `LlmTurnPurpose`, and the `Llm*` message/tool types; `IMAGE_DATA_OMITTED`.
- **Internal (no stability guarantee):** `AgentMessage` values on `message_start`/`message_end`/`turn_messages`/`agent_end` (consume completed model output through `turn.response.output`, typed by `LlmAssistantMessage`, where possible); `tool.result` and observation `effectiveResult`; `operation.result`.
- Breaking format changes bump `v`; additive optional fields do not.

### 09 — Sandbox API
All exported from `@flue/runtime`, except `local()` (`@flue/runtime/node`) and `cloudflareSandbox()` (`@flue/runtime/cloudflare`). Deprecated aliases still compiling: `SessionEnv`, `SandboxApi`, `SessionToolFactory`, `createSandboxSessionEnv`, and the factory method `createSessionEnv`.

#### `SandboxFactory`
```ts
interface SandboxFactory {
  createSandbox(options: { id: string }): Promise<Sandbox>;
  tools?: SandboxToolFactory;
}
```
- Value passed to `useSandbox(...)` or an agent's `sandbox:` config. Factory cheap to construct (fresh every render); expensive work inside `createSandbox()`.
- `createSandbox(options)` — called **once per initialized harness** (one per `init()`); every session and task session of that harness shares the returned sandbox; re-renders never rebuild; rejection fails agent initialization. `options.id` — the agent instance id (`ctx.id`); repeated calls with the same `id` are possible (keying a provider workspace on `id` = durable filesystem).
- `tools` — when present **replaces** the framework's default model-facing tool set for this sandbox.
- Contract excludes: **no teardown verb** (provisioning/deletion belongs to the application; the adapter must not call the provider's `delete()`/`terminate()`/`kill()`); **no per-message rebuild**; legacy `createSessionEnv` still works when `createSandbox` absent (one-time deprecation warning); **no identity beyond `id`**.
- `useSandbox(factory, { cwd })` — the runtime wraps the adapter's sandbox in a scoping layer after `createSandbox()` resolves; the adapter must NOT apply an agent's `cwd` itself. `cwd` resolved through the adapter env's own `resolvePath`, then POSIX-normalized; the wrapper resolves relative paths against scoped `cwd`, defaults `exec`'s cwd to it, resolves relative per-call `exec` `cwd` against it, and exposes only standard `Sandbox` members (extra properties dropped — agents needing the native surface must not set a `cwd` override).

#### `Sandbox`
```ts
interface Sandbox {
  exec(command: string, options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal; }): Promise<ShellResult>;
  readFile(path: string): Promise<string>;
  readFileBuffer(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  stat(path: string): Promise<FileStat>;
  readdir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  cwd: string;
  resolvePath(p: string): string;
}
```
- The agent's live sandbox; every mode (virtual, local, remote) implements it; same object exposed as `harness.sandbox`. Operations never recorded in the conversation. Most adapters should not hand-implement: `sandboxFromDriver` and `bash()` produce conforming sandboxes.
- **Path semantics:** POSIX `/`-separated (`local()` on Windows uses host path semantics). Relative paths resolve against `cwd` (= absolute working directory; workspace discovery + default command execution happen here). `resolvePath(p)` resolves relative against `cwd` without touching the filesystem; absolute passes through; the standard `write`/`edit` tools key per-file mutation locks on it — two spellings of the same path must resolve to the same string.
- **`exec`:** resolves with a `ShellResult` for any completed command, non-zero exit codes included; rejections reserved for transport failures and aborts. `options.cwd` — per-command cwd (relative against `env.cwd`; omitted → `env.cwd`). `options.env` — layered on the adapter's base env. `options.timeoutMs` — wall-clock deadline hint, the **primary cancellation contract**; forward to the provider's native timeout (E2B `timeoutMs`, Daytona `timeout`, Modal `timeout`); coarser providers round up, never down. `options.signal` — aborting rejects promptly with `AbortError` (`DOMException`) carrying the reason as `cause`; an adapter without mid-flight cancel leaves the command as an **orphan** (keeps executing; eventual result discarded), and the `AbortError` message says so. `timeoutMs` and `signal` independent — whichever fires first wins. The standard `bash` tool passes both whenever the model requests a timeout.
- **File verbs:** `readFile` throws if missing/not a file (UTF-8). `readFileBuffer` — raw bytes. `writeFile` creates or replaces; **must create missing parent directories** (cross-mode guarantee — `sandboxFromDriver`, `bash()`, `local()` retry a failed write once after `mkdir -p` on the parent). `stat` throws if missing. `readdir` returns entry names only; throws if not a directory. `exists` returns `true` if file or directory exists; never throws. `mkdir` + `recursive` creates missing parents and tolerates existing dir. `rm` + `recursive` removes dir contents, `force` suppresses missing-path error; an adapter that can't honor a requested option must throw `SandboxOperationUnsupportedError` **before modifying anything**. File-verb errors surface to the model as tool errors.
**`ShellResult`**
```ts
interface ShellResult { stdout: string; stderr: string; exitCode: number; }
```

**`FileStat`**
```ts
interface FileStat { isFile: boolean; isDirectory: boolean; isSymbolicLink?: boolean; size?: number; mtime?: Date; }
```
- `isSymbolicLink`, `size`, `mtime` omitted when the provider doesn't expose them; never fabricate placeholders. For symlinks, `isFile`/`isDirectory`/`size`/`mtime` describe the target, `isSymbolicLink` the path itself (`stat -L` + non-following check).
**Extending `Sandbox`:** adapters may attach a native surface; `harness.sandbox` exposes it exactly as returned; adapter packages ship runtime-checked accessors (Cloudflare Computer's `computerWorkspace(harness.sandbox)` returns its `Workspace`). Constraints: a `cwd` override wraps and drops extra properties; a command-less sandbox should still ship all file verbs, throw from `exec`, and pair with a `tools` list omitting the exec-backed standard tools.

#### `sandboxFromDriver(driver, cwd, options?)`
```ts
function sandboxFromDriver(driver: SandboxDriver, cwd: string, options?: { onOrphanSettled?: (settlement: OrphanedExecSettlement) => void }): Sandbox;
```
- Wraps a `SandboxDriver` into a conforming `Sandbox`. The wrapper supplies: path resolution (relative paths/absent `exec` cwds resolve against `cwd`, POSIX-normalized; `driver` always receives absolute paths); the `writeFile` parent-creation guarantee (failed write retried once after `driver.mkdir(parent, { recursive: true })`); the `exec` abort race (already-aborted signal rejects with `AbortError` before `driver.exec`; mid-flight abort rejects promptly — the wrapper never waits on `driver.exec`'s settlement for the caller's outcome).
- **Orphaned commands:** an abort before `driver.exec` settles leaves an orphaned command — caller already released with `AbortError`, provider call keeps running. A cancel-capable adapter forwarding `signal` still produces one; the window shrinks to SDK cancellation latency. Orphan settlement is never appended to the conversation; consumed (no unhandled rejection); reported only via `options.onOrphanSettled`:
```ts
interface OrphanedExecSettlement {
  command: string;
  startedAt: Date;
  abortedAt: Date;
  settledAt: Date;
  result?: ShellResult;
  error?: unknown;
}
```
`error` = whatever the orphaned call eventually rejected with — a late `SandboxDiedError` included. Without `onOrphanSettled`, discarded.
**`SandboxDriver`**
```ts
interface SandboxDriver {
  readFile(path: string): Promise<string>;
  readFileBuffer(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  stat(path: string): Promise<FileStat>;
  readdir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  exec(command: string, options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal; }): Promise<ShellResult>;
}
```
- Identical to the corresponding `Sandbox` members except paths arrive pre-resolved and the `writeFile` parent guarantee is the wrapper's. File-verb notes: `writeFile` accepts string + `Uint8Array` (convert strings to UTF-8 for buffer-only providers; let missing-parent errors propagate); `readFileBuffer` returns `Uint8Array` (wrap a Node `Buffer` with `new Uint8Array(buffer)`); `exists` must not throw (catch SDK errors → `false`); `mkdir` may implement `recursive` via `exec('mkdir -p …')`; `rm` implements `recursive`/`force` exactly or throws `SandboxOperationUnsupportedError` before any mutation (semantics match Node `fs.rm`).
- `exec` contract: honor `timeoutMs` by forwarding to the provider SDK's native timeout, rounding up — never down (whole-seconds provider forwards `Math.ceil(timeoutMs / 1000)`); provider-primary regardless of `signal`. An adapter enforcing the deadline itself resolves an expired command as `ShellResult` with `exitCode: 124` + timeout details on `stderr` (the `timeout(1)` convention). Rejection reserved for `signal` aborts. Forward `signal` only when the SDK has real cancellation; confirm it takes effect; don't add a second abort race (`Promise.race`, own `signal.aborted` checks) — `sandboxFromDriver` already owns the caller-facing rejection. No `stderr` → `''`; `exitCode: 0` only for clearly successful calls.
- Liveness (all `SandboxDriver` methods): in-flight operations should settle when the sandbox dies — native rejection or polling a cheap control-plane status read (first-party Cloudflare adapter does the latter internally); none = accepted limitation. Detected death → reject `SandboxDiedError` (`type: 'sandbox_died'`, exported from `@flue/runtime`). The death detector races the liveness signal against the in-flight call and nothing else — never also `signal`.

#### `bash(factory)`
```ts
function bash(factory: BashFactory): SandboxFactory;
type BashFactory = () => BashLike | Promise<BashLike>;
```
- Wraps a just-bash `Bash` instance into a `SandboxFactory` — the in-memory virtual sandbox (seeded files, network allowlist, custom commands). Factory called once at runtime agent initialization; the return is duck-type checked (`exec`, `getCwd`, `fs`) — a wrong value throws `Error('[flue] BashFactory must return a Bash-like object.')`.
- Sandbox `cwd` = the instance's `getCwd()` (just-bash defaults to `/home/user` when constructed without `cwd`/`files`). No native timeout — the wrapper translates `exec`'s `timeoutMs` into an `AbortSignal` merged with the caller's signal. `writeFile` parent-creation guarantee applied over the instance's `fs`.
```ts
interface BashLike {
  exec(command: string, options?: { cwd?: string; env?: Record<string, string>; signal?: AbortSignal; }): Promise<ShellResult>;
  getCwd(): string;
  fs: {
    readFile(path: string, options?: any): Promise<string>;
    readFileBuffer(path: string): Promise<Uint8Array>;
    writeFile(path: string, content: string | Uint8Array, options?: any): Promise<void>;
    stat(path: string): Promise<any>;
    readdir(path: string): Promise<string[]>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
    resolvePath(base: string, path: string): string;
  };
}
```
`BashLike` is structural (no just-bash import in `@flue/runtime`), exported for adapter authors.

#### `SandboxToolFactory`
```ts
type SandboxToolFactory = (sandbox: Sandbox, options: SandboxToolFactoryOptions) => AgentTool<any>[];
interface SandboxToolFactoryOptions { subagents: Record<string, SubagentDefinition>; }
```
- Optional `tools` on a `SandboxFactory`; when present its return **replaces** the default six-tool set (`read`, `write`, `edit`, `bash`, `grep`, `glob`). Must be synchronous, return a fresh array every call; invoked at initialization and every turn boundary — not once.
- `sandbox` — the live sandbox with the packaged-skill overlay layered onto `readFile` (not the identical object `harness.sandbox` exposes). `options.subagents` — current subagent roster keyed by name.
- Replacement covers only the framework built-in group. Appended separately, unaffected: the framework group (`task` always; `activate_skill` when a skill is mounted; `read_skill_resource` when a packaged skill carries supporting files); custom `useTool(...)`/`defineTool(...)` tools and per-call result tools.
- Reserved names: `task`, `activate_skill`, `read_skill_resource`, `finish`, `give_up`. A collision throws `ToolNameConflictError` when the tool list is assembled.
- Element type `AgentTool` from `@earendil-works/pi-agent-core` (a dependency of `@flue/runtime`; not re-exported). Structurally:
```ts
interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> {
  name: string;
  label: string;
  description: string;
  parameters: TParameters; // TypeBox schema
  execute(toolCallId: string, params: Static<TParameters>, signal?: AbortSignal, onUpdate?: (partial: AgentToolResult<TDetails>) => void): Promise<AgentToolResult<TDetails>>; // { content, details, terminate? }
}
```
`execute` throws on failure rather than encoding errors in `content`.

#### The standard tool factories
```ts
function createReadTool(sandbox: Sandbox): AgentTool;
function createWriteTool(sandbox: Sandbox): AgentTool;
function createEditTool(sandbox: Sandbox): AgentTool;
function createBashTool(sandbox: Sandbox): AgentTool;
function createGrepTool(sandbox: Sandbox): AgentTool;
function createGlobTool(sandbox: Sandbox): AgentTool;
```
- One factory per standard tool, each closing over a `Sandbox`; exactly the tools installed when a sandbox has no `tools` function; exporting per-tool lets an adapter's `SandboxToolFactory` add/drop/swap members.
- `createReadTool`/`createWriteTool`/`createEditTool` need only the file verbs; `createBashTool`/`createGrepTool`/`createGlobTool` require a working `exec` — omit for exec-less sandboxes.
- `read` fetches through `readFile` and slices in the runtime; `edit` = read → replace → write transaction. Same-file `write`/`edit` mutations in one parallel batch serialize through a per-path lock keyed on `resolvePath`; a concurrent `bash` mutation is not synchronized.
- `createBashTool` converts the model's `timeout` (seconds) to `timeoutMs` and also composes it into the abort signal as a backstop for sandboxes that ignore both cancellation fields; a pure timeout surfaces as recoverable `exitCode: 124`, a host abort rethrows.
- `createGrepTool` probes for `rg` once per environment (`rg --version`, 10-second deadline, cached), falling back to `grep -rnH`; `createGlobTool` shells out to `find -name`.

#### Packaged-skill overlays
Supporting files of a packaged skill live in the application bundle, not the sandbox. The runtime serves them at virtual paths under `/.flue/packaged-skills/<skill-id>/…` by layering an overlay onto the env handed to tool factories — never writing into the adapter's filesystem. Only `readFile` is overlaid: paths under the virtual root resolve from the in-memory skill catalog, everything else delegates; an unknown path throws `Error('[flue] Packaged skill file not found: <path>')`. Binary files served as base64 text wrapped to 76-character lines. Overlay is session-internal — `harness.sandbox` and `useTool` handlers see the adapter's real env; shell verbs cannot see the virtual root (the standard `read` tool or `read_skill_resource` is the access path).

#### Built-in factories
**`local(options?)`**
```ts
import { local } from '@flue/runtime/node';
function local(options?: LocalSandboxOptions): SandboxFactory;
interface LocalSandboxOptions { cwd?: string; env?: Record<string, string | undefined>; }
```
- Node target only. Binds the agent directly to the host: file verbs call `node:fs/promises`; `exec` spawns real processes. No isolation.
- `cwd` defaults to `process.cwd()`, resolved to an absolute host path. `env` layered on the default allowlist; `undefined` drops a default; a non-record value throws a `TypeError` at construction. Per-call `exec` `env` layers on top.
- **Environment allowlist:** the model's shell does not inherit `process.env`. Default pass-through: `PATH`, `HOME`, `USER`, `LOGNAME`, `HOSTNAME`, `SHELL`, `LANG`, `LC_ALL`, `LC_CTYPE`, `TZ`, `TERM`, `TMPDIR`, `TMP`, `TEMP`; everything else per-variable opt-in via `options.env` (snapshot taken once at construction; `env: { ...process.env }` inherits everything, host secrets included).
- `exec` runs through real `bash` when present (probed once per process, absolute path), else the platform default shell. On POSIX the child leads its own process group; abort and timeout signal the whole group — `SIGTERM`, escalating to `SIGKILL` after a 2-second grace — so compound commands can't orphan grandchildren (no orphaned-command window beyond that grace).
- Non-zero exits and spawn failures resolve as `ShellResult` (spawn failures: `exitCode: 1` + error on stderr); `timeoutMs` expiry also resolves as `ShellResult` with `exitCode: 124`. A caller-initiated `signal` abort instead rejects with `AbortError` — the rejection wins. A signal death `local()` did not initiate keeps generic `exitCode: 1`.
- Captured output capped at **64 MiB**; exceeding kills the process tree and resolves `exitCode: 1` + truncation note on stderr. `timeoutMs` is composed into the caller's `signal` (no separate native timeout). `stat` populates all `FileStat` fields (target for `isFile`/`isDirectory`/`size`/`mtime`, path itself for `isSymbolicLink`).
**`cloudflareSandbox(sandbox, options?)`**
```ts
import { cloudflareSandbox } from '@flue/runtime/cloudflare';
function cloudflareSandbox(sandbox: CloudflareSandboxStub, options?: CloudflareSandboxOptions): SandboxFactory;
interface CloudflareSandboxOptions { cwd?: string; }
```
Cloudflare target. Wraps a `@cloudflare/sandbox` Durable Object stub (the value `getSandbox()` returns) into a `SandboxFactory`. `CloudflareSandboxStub` structural, so `@flue/runtime` does not depend on `@cloudflare/sandbox`. `cwd` defaults to `/workspace`.

#### `SandboxOperationUnsupportedError`
```ts
class SandboxOperationUnsupportedError extends FlueError {
  constructor(input: { operation: string; provider: string; options: readonly string[] });
}
```
Thrown when a caller requests an operation with options the provider cannot honor (`type: 'sandbox_operation_unsupported'`); throw before modifying the filesystem. `operation` names the verb, `provider` the product, `options` the unhonored option names; all three preserved on the error's `meta`.

### 10 — Data persistence API
Types/helpers from `@flue/runtime/adapter`; test suites from `@flue/runtime/test-utils`. Node-only: on Cloudflare every agent instance persists in its Durable Object's built-in SQLite storage; a `db.ts` file is rejected at build time; custom adapters don't apply. `AgentSubmissionStore` settlement + lease method groups subject to change until 1.0. One contract for every backend — no SQL-only tiers. If this page and the package differ, the package wins.

#### `PersistenceAdapter`
```ts
interface PersistenceAdapter {
  connect(): PersistenceStores | Promise<PersistenceStores>;
  migrate?(): void | Promise<void>;
  close?(): void | Promise<void>;
}
```
- Adapter packages export a factory returning this interface; users default-export the result from `db.ts`. Built-in reference: `sqlite(path?: string)` from `@flue/runtime/node`.
- `connect()` — open the database and return every store; awaited once at startup (async pool setup, remote handshakes, and — for adapters without `migrate` — the format-version check belong here). Unreachable DB fails at boot.
- `migrate()` — bring the store to the current format version; called once at startup **before** `connect()`. Creates missing schema, durably records the format version on first creation, fails loudly on an unknown or newer version. Adapters creating schema implicitly may omit it but must uphold the versioning obligation in store-creating paths.
- `close()` — release resources; called on shutdown.

#### `PersistenceStores`
```ts
interface PersistenceStores {
  readonly submissionStore: AgentSubmissionStore;
  readonly conversationStreamStore: ConversationStreamStore;
  readonly attachmentStore: AttachmentStore;
}
```

#### `AgentSubmissionStore`
Durable submission ledger: admitted payloads, queue ordering, attempt/lease coordination, settlement projections. Status flow: `queued → running → (terminalizing →) settled`, with a `joining`/`joined` pair for queued deliveries absorbed into another submission's live response at a turn boundary. Sessions append-only for the instance's life.
```ts
interface AgentSubmissionStore {
  // Query
  getSubmission(submissionId: string): Promise<AgentSubmission | null>;
  hasUnsettledSubmissions(): Promise<boolean>;
  listRunnableSubmissions(): Promise<AgentSubmission[]>;
  listUnreadySubmissions(): Promise<AgentSubmission[]>;
  listRunningSubmissions(): Promise<AgentSubmission[]>;
  listPendingSubmissionSettlements(): Promise<SubmissionSettlementObligation[]>;
  replaceSubmissionAttempt(attempt: SubmissionAttemptRef, nextAttemptId: string, lease?: { ownerId: string; leaseExpiresAt: number }): Promise<AgentSubmission | null>;
  // Admission
  admitDispatch(input: DispatchInput): Promise<AgentDispatchAdmission>;
  admitDirect(input: AgentSubmissionInput): Promise<AgentSubmission>;
  markSubmissionCanonicalReady(submissionId: string): Promise<AgentSubmission | null>;
  // Lifecycle
  claimSubmission(claim: SubmissionClaimRef): Promise<AgentSubmission | null>;
  markSubmissionInputApplied(attempt: SubmissionAttemptRef, durability?: SubmissionDurability): Promise<boolean>;
  requestSessionAbort(sessionKey: string): Promise<string[]>;
  requeueSubmission(attempt: SubmissionAttemptRef): Promise<boolean>;
  reserveSubmissionSettlement(attempt: SubmissionAttemptRef, settlement: { recordId: string; record: SubmissionSettledRecord }): Promise<SubmissionSettlementObligation | null>;
  finalizeSubmissionSettlement(attempt: SubmissionAttemptRef, recordId: string, options?: { errorMessage?: string }): Promise<boolean>;
  completeSubmission(attempt: SubmissionAttemptRef): Promise<boolean>;
  failSubmission(attempt: SubmissionAttemptRef, error: unknown): Promise<boolean>;
  // Turn-boundary joins
  claimJoinableSubmissions(host: SubmissionAttemptRef, agentName: string): Promise<AgentSubmission[]>;
  finalizeJoinedSubmission(host: SubmissionAttemptRef, submissionId: string): Promise<boolean>;
  revertJoiningSubmission(host: SubmissionAttemptRef, submissionId: string): Promise<boolean>;
  listJoinedSubmissions(hostSubmissionId: string): Promise<AgentSubmission[]>;
  // Lease management
  renewLeases(ownerId: string, submissionIds: string[]): Promise<void>;
  listExpiredSubmissions(): Promise<AgentSubmission[]>;
}
```
- Supporting types all exported from `@flue/runtime/adapter`: `AgentSubmission`, `SubmissionAttemptRef`, `SubmissionClaimRef`, `SubmissionDurability`, `SubmissionSettlementObligation`, `AgentDispatchAdmission`, `AgentDispatchReceipt`, `AgentSubmissionInput`, `DispatchInput`.
- **Query:** `getSubmission` — submission or `null`. `hasUnsettledSubmissions` — true while any queued/running/joining/joined. `listRunnableSubmissions` — queued submissions each the oldest unsettled of their session, admission order (at most one runnable head per session). `listUnreadySubmissions` — queued without canonical readiness. `listRunningSubmissions` — all running. `listPendingSubmissionSettlements` — reserved, unfinalized obligations. `replaceSubmissionAttempt` — recovery handoff: atomically move to a new attempt id, increment `attemptCount`, install lease when given; `null` (no write) when not running under `attempt`.
- **Admission:** `admitDispatch` — idempotent by submission id: exact replay returns the already-admitted submission; same id + different payload → `{ kind: 'conflict' }`; id matching a retained receipt → `{ kind: 'retained_receipt' }` without re-admitting. `admitDirect` — idempotent for an exact replay of the same id + payload. `markSubmissionCanonicalReady` — idempotent while queued; `null` when missing or no longer queued.
- **Lifecycle:** `claimSubmission` — atomic compare-and-set queued → running, only when the runnable head of its session (records attempt, owner, lease, start time); two concurrent claims must never both succeed. `markSubmissionInputApplied` — install the durability budget (or defaults) once, at first input application, stamping `inputAppliedAt` (bookkeeping — the canonical stream is the truth). `requestSessionAbort` — stamp `abortRequestedAt` (first wins) on every unsettled submission in the session, return their ids; never settles, never changes `status`. `requeueSubmission` — running → queued for a clean first attempt, clearing attempt/owner/lease/durability stamp; gated only on ownership. `reserveSubmissionSettlement` — atomically reserve the exact canonical settlement record (status → `terminalizing`); exact retries return the existing obligation; conflicts return `null`. `finalizeSubmissionSettlement` — finalize an owned terminalizing submission after its canonical record exists. `completeSubmission`/`failSubmission` — settle an owned running submission; a stale attempt or already-settled submission returns `false` (first terminal state preserved); settling a host also settles every `joined` submission with the same outcome and reverts unconfirmed `joining` stragglers to `queued`.
- **Joins (dispatch-while-busy):** `claimJoinableSubmissions` — atomically claim the contiguous queued prefix (`queued → joining`, `joinedInto` set); gated on the host still running. `finalizeJoinedSubmission` — confirm once the delivery's canonical input record is durable (`joining → joined`). `revertJoiningSubmission` — `joining → queued`; legal only while the canonical input record does not exist. `listJoinedSubmissions` — unsettled joins in admission order.
- **Leases:** `renewLeases` — extend expiry (now + `LEASE_DURATION_MS`) for each listed submission running and owned by `ownerId`; others silently skipped. `listExpiredSubmissions` — running submissions with an expired lease; queued/settled never returned.
- **Exported constants:** `DURABILITY_DEFAULT_MAX_ATTEMPTS` (`10`), `DURABILITY_DEFAULT_TIMEOUT_MS` (`3_600_000`), `LEASE_DURATION_MS` (`30_000`).

#### `ConversationStreamStore`
Canonical per-agent-instance conversation streams: ordered, append-only batches of `ConversationRecord` values, written by a single fenced producer. The stream is the sole authoritative transcript — canonical state is reconstructed by replaying it from the beginning; an adapter must not model a second transcript in session rows, snapshots, or event streams. Rejected operations throw `ConversationStreamStoreError` and leave the stream unchanged.
```ts
interface ConversationStreamStore {
  createStream(path: string, identity: ConversationStreamIdentity): Promise<void>;
  acquireProducer(path: string, producerId: string): Promise<ConversationProducerClaim>;
  append(input: { path: string; producerId: string; producerEpoch: number; incarnation: string; producerSequence: number; submission?: { submissionId: string; attemptId: string }; records: readonly ConversationRecord[]; }): Promise<{ offset: string }>;
  read(path: string, options?: { offset?: string; limit?: number }): Promise<ConversationStreamReadResult>;
  getMeta(path: string): Promise<ConversationStreamMeta | null>;
  subscribe(path: string, listener: () => void): () => void;
  putFoldCheckpoint?(path: string, checkpoint: ConversationFoldCheckpoint): Promise<void>;
  getFoldCheckpoint?(path: string, options?: { atOrBefore?: string }): Promise<ConversationFoldCheckpoint | null>;
}
```
- `createStream` — create if absent, minting a fresh incarnation id; racing creates with the same identity both succeed; a conflicting identity for an existing path throws.
- `acquireProducer` — exclusive producership: increments the producer epoch, resets the producer sequence, returns a claim (epoch, incarnation, current head offset); fences every prior producer.
- `append` — one batch under one offset; requires a current producer id, epoch, incarnation, and the next expected `producerSequence`. An exact retry of an already-appended sequence returns the original offset; a conflicting retry throws. Records carrying `submissionId`/`attemptId` require a `submission` authorization that owns them. All-or-nothing per batch.
- `read` — batches strictly after `options.offset` (default `'-1'`); sentinel `'now'` returns no batches and the head as `nextOffset`; `limit` clamped between `DEFAULT_READ_LIMIT` (`100`) and `MAX_READ_LIMIT` (`1000`); offset beyond the head throws; unknown path → empty, up-to-date result.
- `getMeta` — identity, incarnation, head offset, producer state; `null` for unknown paths. `subscribe` — process-local change listener; returns an unsubscribe; best-effort in-process fan-out, not durable/cross-process.
- `putFoldCheckpoint`/`getFoldCheckpoint` — optional: one durable serialized-fold snapshot per path, superseded on each write, so loads fold only the suffix since it. A checkpoint is a cache over the log, never authoritative — the runtime validates format version, incarnation, and offset on load and rebuilds by replay on mismatch; without the pair the runtime degrades to full replay and warns once per path. Must be torn-write safe. `atOrBefore` returns it only when its offset is at/before the bound.
- Offsets are opaque strings; `formatOffset`/`parseOffset` convert to/from integer sequence numbers. `defineSqlConversationStreamStore(dialect: SqlConversationDialect)` builds a complete store over an async SQL backend — the Postgres, libSQL, and MySQL adapters share one fence implementation, differing only in dialect constants. `InMemoryConversationStreamStore` and `StreamListenerRegistry` exported as reference building blocks.

#### `AttachmentStore`
Immutable attachment bytes referenced by canonical conversation records via `AttachmentRef` — storage identity + integrity metadata (`id`, `mimeType`, `size`, `digest`, optional `filename`), not a download URL. `filename` is presentation metadata, excluded from identity comparisons.
```ts
interface AttachmentStore {
  put(input: PutAttachmentInput): Promise<void>;
  get(input: GetAttachmentInput): Promise<StoredAttachment | null>;
}
```
- `put` — store the bytes for an attachment id within a stream; idempotent (exact re-`put` with same ref, bytes, conversation succeeds, incl. concurrent). Reusing an id with different content, metadata, or ownership throws `AttachmentConflictError`. Bytes verified against the ref's `size`/`digest`; mismatch → `AttachmentIntegrityError`.
- `get` — stored attachment + bytes, or `null` when the id is unknown or the `conversationId` doesn't match; integrity verified on read.
- Helpers: `createAttachmentRef` (computes the SHA-256 `digest`), `verifyAttachmentBytes`, `sameAttachmentRef` (ignores `filename`), `attachmentBytesEqual`, `copyAttachmentBytes`; `InMemoryAttachmentStore` is a complete reference implementation.

#### Cross-cutting requirements
- **Idempotent admission.** An exact replay of an admission, append, put, or settlement reservation returns the original result; same identity with different content is a conflict, never a silent overwrite.
- **Fenced producer claims.** Each stream has at most one live producer; `acquireProducer` invalidates prior claims; appends with a stale epoch/incarnation rejected; submission-owned appends require the writing attempt to durably own the submission.
- **Append-only streams.** Canonical records never updated or rewritten; a batch is all-or-nothing under a single offset; offsets strictly ordered.
- **First terminal state wins.** A settled submission's outcome is never overridden — stale attempts observe `false`.
- **Observable atomicity.** Where a method is described as atomic, concurrent callers must never both observe success; implementation is the adapter's choice.
- **Format-version stamping.** An adapter durably records its format version on first store creation (current: `FLUE_FORMAT_VERSION`, `1`) and throws `PersistedFormatVersionError` — before reading/writing any data — when opened against a store with an unknown or newer version. `assertSupportedFlueFormatVersion(storedVersion)` performs the check. Format is reset-only: other-version stores are cleared, never migrated in place. Built-in SQL adapters use a one-row `flue_meta` key/value table (key `'format_version'`); non-SQL adapters implement the same obligation natively.

#### Contract test suites
Three vitest suites in `@flue/runtime/test-utils` are the acceptance bar; an adapter is correct when all three pass. Each function registers a `describe` block; each test receives a fresh store from `backend.create()`, and `backend.cleanup?()` runs after each test.
```ts
import {
  defineAttachmentStoreContractTests,
  defineConversationStreamStoreContractTests,
  defineStoreContractTests,
} from '@flue/runtime/test-utils';
defineStoreContractTests('My backend', {
  async create() {
    return mySubmissionStore;
  },
  async cleanup() {
    /* close connections, delete temp state */
  },
});
```
- `defineStoreContractTests(label, backend)` — the `AgentSubmissionStore` suite (admission, canonical readiness, queue ordering, claims, lifecycle transitions, aborts, settlement obligations, durability stamping, attempt replacement, leases, joins). `backend.create()` returns an `AgentSubmissionStore`. The optional `backend.formatVersion` group gives raw access to the persisted stamp (`open()` returns a fresh, un-migrated handle with `migrate`, `readStamp`, `writeStamp`, `deleteStamp`).
- `defineConversationStreamStoreContractTests(label, backend)` — racing creates, ordered atomic batches, idempotent and conflicting retries, producer fencing, submission-owned append authorization, reads. `backend.create()` returns `{ stream, submissionStore? }`; the submission store is required for authorization tests. Also from `@flue/runtime/test-utils/conversation-stream`.
- `defineAttachmentStoreContractTests(label, backend)` — byte round-trips, idempotent/concurrent exact puts, conflict errors on identity reuse, integrity errors. `backend.create()` returns an `AttachmentStore`. Also from `@flue/runtime/test-utils/attachment-store`.

#### Adapter helpers (pure functions from `@flue/runtime/adapter`)
- `admitSubmissionWithBackend(input, backend)` — the shared admission algorithm for row-oriented backends (receipt check, attachment preparation, insert-or-ignore, read-back, idempotent-replay-vs-conflict comparison, chunk adoption); caller owns transaction scoping; synchronous when every `SubmissionAdmissionBackend` callback is.
- `isSubmissionPayload(input, ctx)` — validate a parsed JSON payload against the stored submission metadata (`SubmissionPayloadContext`).
- `parseAcceptedAt(value, label)` — parse an ISO timestamp to epoch ms; throws on invalid. `clampLimit(limit, defaultLimit, maxLimit)` — default for invalid/non-positive, cap at max.
- `createSessionStorageKey(agentName, instanceId, harness, session)` / `parseSessionStorageKey(key)` — serialize/parse the session-lane identity fencing queue ordering, abort, and attempt ownership. External submissions always use `SUBMISSION_HARNESS_NAME` and `SUBMISSION_SESSION_NAME` (both `'default'`).
- `createDispatchAgentSubmissionInput(input)` — convert a `DispatchInput` into the persisted `AgentSubmissionInput` shape.
- `prepareSubmissionAttachments`, `hydratePersistedSubmissionAttachments`, `matchesPersistedSubmissionAttachments`, `sameSubmissionChunks` — attachment chunking for oversized-row-safe payload storage, keyed by submission id (`SubmissionChunkRow`, `SubmissionChunkStore`).

## Cheat sheet

```bash
npx flue run src/agents/assistant.ts --message "hello"           # local run
npx flue run src/agents/assistant.ts --id conv-1 --message "x"   # persistent conversation
npx vite dev                                                     # dev server (Hono app on :5173)
npx vite build                                                   # node → dist/server.mjs
npx wrangler deploy                                              # cloudflare → Worker
curl -X POST localhost:5173/agents/assistant/hello-1 -H 'content-type: application/json' \
  -d '{"kind":"user","body":"Tell me a joke."}'
curl "localhost:5173/agents/assistant/hello-1?view=history"      # read conversation
```

Key file layout: `flue.config.ts`, `vite.config.ts`, `src/app.ts` (route map), `src/agents/*.ts` (`'use agent'`), `src/tools/*.ts`, `src/skills/*/SKILL.md`, `src/sandboxes/*.ts`, optional `src/cloudflare.ts`, `wrangler.jsonc`.
