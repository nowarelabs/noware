---
description: Understand the source files and generated output in a Flue project.
title: Project Layout | Flue
image: https://flueframework.com/docs/og4.jpg
---

# Project Layout

Last updated Jul 21, 2026[View as Markdown](https://flueframework.com/docs/guide/project-layout/index.md)

Flue has few required conventions for file and folder layout. The examples below show the recommended structure for single- and multi-agent projects.

## Example agent codebase

```yaml
my-project/
├─ src/                  # Source directory
│  ├─ app.ts             # Server and router entrypoint (required)
│  ├─ db.ts              # Database configuration (optional)
│  ├─ cloudflare.ts      # Cloudflare-specific entrypoint (optional)
│  ├─ agent.ts
│  ├─ skills/...
│  ├─ tools/...
│  ├─ subagents/...
│  └─ channels/...
├─ package.json          # npm project configuration
├─ vite.config.ts        # Vite configuration (optional)
└─ flue.config.ts        # Flue project configuration (optional)
```

## Example multi-agent codebase

```yaml
my-project/
├─ src/                  # Source directory
│  ├─ app.ts             # Server and router entrypoint (required)
│  ├─ db.ts              # Database configuration (optional)
│  ├─ cloudflare.ts      # Cloudflare-specific entrypoint (optional)
│  └─ agents/
│     ├─ support-agent/
│     │  ├─ skills/...
│     │  ├─ tools/...
│     │  ├─ subagents/...
│     │  ├─ channels/...
│     │  └─ agent.ts
│     ├─ triage-agent/
│     └─ shared/
├─ package.json          # npm project configuration
├─ vite.config.ts        # Vite configuration (optional)
└─ flue.config.ts        # Flue project configuration (optional)
```

## Top-level files

| Path                                                                                                           | Purpose                                                |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [flue.config.ts](https://flueframework.com/docs/reference/configuration/)                                      | Flue project configuration. Optional.                  |
| [vite.config.ts](https://flueframework.com/docs/guide/deploy/)                                                 | Vite build & dev server configuration. Optional.       |
| [src/app.ts](https://flueframework.com/docs/guide/routing/)                                                    | Application route map and server entrypoint. Required. |
| [src/db.ts](https://flueframework.com/docs/guide/database/)                                                    | Database configuration. Optional.                      |
| [src/cloudflare.ts](https://flueframework.com/docs/guide/cloudflare-target/#extending-cloudflarets-entrypoint) | Cloudflare entrypoint configuration. Optional.         |

## Source directory

`src/` is the canonical source directory for new Flue projects. When integrating Flue into another application or maintaining an existing layout, authored modules may instead live in `.flue/` or at the project root. Flue selects one source directory in this order:

1. `.flue/` — A self-contained Flue source area inside a larger application.
2. `src/` **(Recommended)** — The recommended layout for new projects.
3. The project root — A compact layout for small dedicated projects.

The first matching directory wins. Flue does not merge layouts: when `.flue/` exists, `app.ts`, `db.ts`, `cloudflare.ts`, and the `'use agent'` scan are resolved from it, not from `src/` or the project root. Authored modules may still import ordinary supporting code from elsewhere in the project.

Entry module paths (`app.ts`, `db.ts`, `cloudflare.ts`) can be configured explicitly in your `flue.config.ts` file. See [Configuration](https://flueframework.com/docs/reference/configuration/) for more details.

## Generated output

`dist/` is the default build output directory when you run `vite build`. You can customize this in your `vite.config.ts` file.

## Docs Navigation

Current page: [Project Layout](https://flueframework.com/docs/guide/project-layout/)

### Sections

* [Guide](https://flueframework.com/docs/guide/getting-started/)
* [Reference](https://flueframework.com/docs/reference/agent-api/)
* [CLI](https://flueframework.com/docs/cli/overview/)
* [Agent SDK](https://flueframework.com/docs/sdk/overview/)
* [Ecosystem](https://flueframework.com/docs/ecosystem/)

### Introduction

* [Getting Started](https://flueframework.com/docs/guide/getting-started/)
* [Why Flue?](https://flueframework.com/docs/guide/why-flue/)
* [Migration Guide](https://flueframework.com/docs/guide/migration/)
* [Changelog](https://github.com/withastro/flue/blob/main/CHANGELOG.md)

### Guides

* [Project Layout](https://flueframework.com/docs/guide/project-layout/)
* [Agents](https://flueframework.com/docs/guide/building-agents/)
* [Agent Hooks](https://flueframework.com/docs/guide/agent-hooks/)
* [Models](https://flueframework.com/docs/guide/models/)
* [Tools](https://flueframework.com/docs/guide/tools/)
* [MCP](https://flueframework.com/docs/guide/mcp/)
* [Skills](https://flueframework.com/docs/guide/skills/)
* [Subagents](https://flueframework.com/docs/guide/subagents/)
* [Sandboxes](https://flueframework.com/docs/guide/sandboxes/)
* [Routing](https://flueframework.com/docs/guide/routing/)
* [Database](https://flueframework.com/docs/guide/database/)

### Advanced

* [Deploy](https://flueframework.com/docs/guide/deploy/)
* [Workflows](https://flueframework.com/docs/guide/workflows/)
* [Schedules](https://flueframework.com/docs/guide/schedules/)
* [Channels](https://flueframework.com/docs/guide/channels/)
* [Evals](https://flueframework.com/docs/guide/evals/)
* [Observability](https://flueframework.com/docs/guide/observability/)
* [Durability](https://flueframework.com/docs/guide/durability/)

### Frontend

* [React](https://flueframework.com/docs/guide/react/)

### Targets

* [Cloudflare](https://flueframework.com/docs/guide/cloudflare-target/)
* [Node.js](https://flueframework.com/docs/guide/node-target/)
