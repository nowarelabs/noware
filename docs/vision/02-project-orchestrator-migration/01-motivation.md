# 02 — Orchestrator Migration

## The problem

The flax orchestrator agent (and all 15 downstream agents) currently run on a thin
`HttpEntrypoint` + `createAgentRouter` + `defineAgent` DSL stack. This works, but:

1. **No standard gauge layering** — agents mix HTTP routing, business logic, tool dispatch,
   and persistence in flat files. There's no Controller → Feature → UseCase → Port → Gateway
   → Model separation.

2. **Tool wrappers are copy-pasted** — the same `jira-linear-tool.ts` (33 lines, identical)
   appears in 4+ agents. The shared `packages/tools/` directory exists but agents don't use it.

3. **No port/gateway contracts** — tools call raw RPC bindings (`env.JIRA_LINEAR_TOOL.fetch()`)
   with no interface contract. Changing a tool's API breaks every agent that uses it.

4. **D1 access is raw SQL** — `dashboard-db.ts` writes directly to D1 with hand-written SQL.
   No model layer, no query builder, no lifecycle hooks.

5. **No channel abstraction** — agent-to-agent communication is hardcoded
   (`env.AGENT_NAME.fetch()`), agent-to-human is raw D1 HITL records.

## Why now

The `@nowarelabs` stack provides convention-over-configuration containers for every layer:
Entrypoint → Router → Controller → Feature → UseCase → Port → Gateway → Model. The
orchestrator is the most complex agent (D1, HITL, multiple tool backends, pipeline telemetry)
and exercises every layer. Migrating it first creates the reference implementation for all
15 remaining agents.

## What we're building

Migrate the orchestrator agent to use the full @nowarelabs stack:

| Current                            | Target                                        |
| ---------------------------------- | --------------------------------------------- |
| `app.ts` (flat HttpEntrypoint)     | Controller → Feature → AgentRuntime           |
| `dispatch-agent.ts` (raw RPC)      | Port → Gateway                                |
| `jira-linear-tool.ts` (copy-paste) | Shared Port from `@nowarelabs/agent-ports`    |
| `dashboard-db.ts` (raw SQL)        | BaseModel + BaseService                       |
| `request-human-input.ts` (raw D1)  | ChannelPort from `@nowarelabs/agent-channels` |

## The layering

```
Request
  → HttpEntrypoint (already exists)
    → createAgentRouter (already exists)
      → OrchestratorController (new — HTTP concerns)
        → OrchestratorFeature (new — lifecycle orchestration)
          → AgentRuntime (existing — LLM loop)
            → ToolUseCase (new — individual tool operations)
              → Port (from @nowarelabs/agent-ports)
                → Gateway (from @nowarelabs/agent-gateways)
                  → Model (new — D1 access via BaseModel)
```

## Scope

- Orchestrator agent only (reference implementation)
- All 4 tool backends: dispatch_agent, jira_linear, task_queue, request_human_input
- D1 tables: flax_instances, flax_stages, flax_hitl
- Dashboard-db.ts → Models + Services
- Tests: unit tests for each layer, integration test for full pipeline

## Out of scope (for now)

- Remaining 15 agents (follow-up project)
- LLM loop changes (AgentRuntime stays as-is)
- Tool backend Workers (packages/tools/ stay as-is)
- Dashboard-api changes
