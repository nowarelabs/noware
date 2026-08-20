---
description: Connect agents to remote MCP servers and mount their tools.
title: MCP | Flue
image: https://flueframework.com/docs/og4.jpg
---

# MCP

Last updated Jul 23, 2026[View as Markdown](https://flueframework.com/docs/guide/mcp/index.md)

[MCP](https://modelcontextprotocol.io) (Model Context Protocol) is an open standard for connecting AI agents to external services. Instead of writing a [tool](https://flueframework.com/docs/guide/tools/) for every Linear, Notion, or GitHub action your agent needs, connect to an MCP server and your agent gets access to its tools, remotely.

This guide covers how you can use `useMcpConnection()` to connect to a server, manage authentication, and configure your connection.

## Connect to an MCP server

Connect your agent to an MCP server by calling `useMcpConnection()` within your agent:

```ts
"use agent";
import { useMcpConnection, useModel } from "@flue/runtime";

export function ProjectAssistant() {
  useModel("anthropic/claude-sonnet-4-6");
  useMcpConnection({
    name: "linear",
    url: "https://mcp.linear.app/mcp",
    auth: process.env.LINEAR_API_KEY,
  });
  return "Manage Linear issues and projects for the team.";
}
```

When the agent runs, Flue connects to the server, discovers its tools, and adds them to the agent’s tool set. The tools are named `mcp__<server>__<tool>` (here, `mcp__linear__create_issue`) to avoid collisions with your own tools, and the model calls them like any other tool.

How connections behave:

- Flue connects when the agent starts working on a message and reuses the connection while the instance stays live. You don’t open or close connections yourself.
- If a server can’t be reached, the run fails with an error and the next message retries. Set `optional: true` on the definition to run without that server’s tools instead; the model is told they are unavailable.
- The declaration may be conditional, like a tool mount: an agent can gain or lose a server based on its state, and the model is told about the change.

See the [useMcpConnection reference](https://flueframework.com/docs/reference/agent-hooks-api/#usemcpconnection) for more details on behavior.

## Authenticate with an MCP server

Many hosted MCP servers expect a `Bearer` token, following the [MCP authorization model](https://modelcontextprotocol.io/docs/tutorials/security/authorization) (standard OAuth 2.1). Use the `auth` property to supply it.

The simplest way to provide authorization is via string value. Use this for static authorization, like a service-wide API token:

```ts
"use agent";
import { useMcpConnection, useModel } from "@flue/runtime";

export function ProjectAssistant() {
  useModel("anthropic/claude-sonnet-4-6");
  useMcpConnection({
    name: "linear",
    url: "https://mcp.linear.app/mcp",
    auth: process.env.LINEAR_API_KEY,
  });
  return "Manage Linear issues and projects for the team.";
}
```

Some MCP servers expect a dynamic per-user or per-session authorization token. When you need dynamic authorization, you may pass a function to `auth` instead of a string. The function is resolved on every request, so tokens can rotate and revoke and leave you with full control:

```ts
export function Assistant() {
  const { userId } = useInitialData<{ userId: string }>();

  useMcpConnection({
    name: "linear",
    url: "https://mcp.linear.app/mcp",
    auth: () => tokenStore.get(userId, "linear"),
  });

  return "Help this user manage their Linear issues.";
}
```

Flue never stores or manages your tokens. It is your responsibility to own any OAuth flow, token storage, and refresh token logic.

To attach a server after the user authorizes it mid-conversation, declare the connection conditionally on a persistent flag:

```ts
const [linearReady, setLinearReady] = usePersistentState("linear-ready", false);

if (linearReady) {
  useMcpConnection({
    name: "linear",
    url: LINEAR_MCP_URL,
    auth: () => tokenStore.get(userId, "linear"),
  });
}

useAgentStart(async () => {
  if (!linearReady && (await tokenStore.has(userId, "linear"))) setLinearReady(true);
});
```

When your OAuth flow completes and the flag flips, the agent has the server’s tools from its next message on. If several agents need to share one user’s authorization, put the integration in your application: an application-owned integration service can itself be an MCP server that agents connect to.

## Specifying tools

Servers commonly expose dozens of tools, and every mounted tool takes up model context. The `tools` allowlist mounts only the tools you list:

```ts
useMcpConnection({
  name: "linear",
  url: "https://mcp.linear.app/mcp",
  auth: process.env.LINEAR_API_KEY,
  tools: ["create_issue", "search_issues", "get_issue"],
});
```

If the allowlist names a tool the server doesn’t expose, the connection fails with an error.

## Reusing an MCP server definition

`defineMcpConnection(...)` validates an MCP connection object so you can define it once and then reuse it from any agent:

```ts
import { defineMcpConnection } from "@flue/runtime";

export const linear = defineMcpConnection({
  name: "linear",
  url: "https://mcp.linear.app/mcp",
  auth: process.env.LINEAR_API_KEY,
});
```

```ts
import { linear } from "../connections/linear.ts";
useMcpConnection(linear);
useMcpConnection({ ...linear, tools: ["search_issues"] }); // override fields per mount
```

## Security

An MCP server you connect to can influence your agent: its tool descriptions enter the prompt, and its tool results enter the conversation. Treat a server you don’t control like any other third-party dependency, and consider using the `tools` allowlist to limit the surface area of your exposure.

## Advanced: Making a direct MCP server connection

`createMcpConnection(definition)` is the lower-level function underneath the hook. It connects, discovers the server’s tools, and returns them as [ToolDefinition](https://flueframework.com/docs/reference/agent-api/#definetool) values, so trusted application code can filter or wrap them before mounting with `useTool`:

```ts
const linear = await createMcpConnection({ name: "linear", url: LINEAR_MCP_URL, auth: TOKEN });

export function ProjectAssistant() {
  useModel("anthropic/claude-sonnet-4-6");
  for (const tool of linear.tools) useTool(tool);
  return "Manage Linear issues and projects for the team.";
}
```

This can also be helpful inside of a Node.js script, if you’re ever using the Node.js JavaScript API directly — see [Standalone scripts](https://flueframework.com/docs/guide/building-agents/#standalone-scripts).

## Next steps

- [Tools](https://flueframework.com/docs/guide/tools/) — how tools work in Flue, including guards and conditional mounting.
- [useMcpConnection reference](https://flueframework.com/docs/reference/agent-hooks-api/#usemcpconnection) — the hook’s render contract and semantics.
- [McpConnectionDefinition](https://flueframework.com/docs/reference/agent-api/#mcpconnectiondefinition) and [createMcpConnection](https://flueframework.com/docs/reference/agent-api/#createmcpconnection) — the definition fields and the adaptation contract.

## Docs Navigation

Current page: [MCP](https://flueframework.com/docs/guide/mcp/)

### Sections

- [Guide](https://flueframework.com/docs/guide/getting-started/)
- [Reference](https://flueframework.com/docs/reference/agent-api/)
- [CLI](https://flueframework.com/docs/cli/overview/)
- [Agent SDK](https://flueframework.com/docs/sdk/overview/)
- [Ecosystem](https://flueframework.com/docs/ecosystem/)

### Introduction

- [Getting Started](https://flueframework.com/docs/guide/getting-started/)
- [Why Flue?](https://flueframework.com/docs/guide/why-flue/)
- [Migration Guide](https://flueframework.com/docs/guide/migration/)
- [Changelog](https://github.com/withastro/flue/blob/main/CHANGELOG.md)

### Guides

- [Project Layout](https://flueframework.com/docs/guide/project-layout/)
- [Agents](https://flueframework.com/docs/guide/building-agents/)
- [Agent Hooks](https://flueframework.com/docs/guide/agent-hooks/)
- [Models](https://flueframework.com/docs/guide/models/)
- [Tools](https://flueframework.com/docs/guide/tools/)
- [MCP](https://flueframework.com/docs/guide/mcp/)
- [Skills](https://flueframework.com/docs/guide/skills/)
- [Subagents](https://flueframework.com/docs/guide/subagents/)
- [Sandboxes](https://flueframework.com/docs/guide/sandboxes/)
- [Routing](https://flueframework.com/docs/guide/routing/)
- [Database](https://flueframework.com/docs/guide/database/)

### Advanced

- [Deploy](https://flueframework.com/docs/guide/deploy/)
- [Workflows](https://flueframework.com/docs/guide/workflows/)
- [Schedules](https://flueframework.com/docs/guide/schedules/)
- [Channels](https://flueframework.com/docs/guide/channels/)
- [Evals](https://flueframework.com/docs/guide/evals/)
- [Observability](https://flueframework.com/docs/guide/observability/)
- [Durability](https://flueframework.com/docs/guide/durability/)

### Frontend

- [React](https://flueframework.com/docs/guide/react/)

### Targets

- [Cloudflare](https://flueframework.com/docs/guide/cloudflare-target/)
- [Node.js](https://flueframework.com/docs/guide/node-target/)
