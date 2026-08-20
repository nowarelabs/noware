# 02 — Orchestrator Migration Spec

## Architecture

### Current structure

```
orchestrator-agent/
  src/
    app.ts                    # HttpEntrypoint + createAgentRouter
    agents/orchestrator.ts    # defineAgent + hooks
    tools/
      dispatch-agent.ts       # Raw RPC to other agents
      jira-linear-tool.ts     # Raw RPC to JIRA_LINEAR_TOOL
      task-queue-tool.ts      # Raw RPC to TASK_QUEUE_TOOL
      request-human-input.ts  # Raw D1 writes
    dashboard-db.ts           # Raw SQL for D1
```

### Target structure

```
orchestrator-agent/
  src/
    app.ts                          # Controller → Feature (entrypoint stays)
    controllers/
      orchestrator.controller.ts    # HTTP concerns: list instances, ping
    features/
      orchestrator.feature.ts       # Lifecycle: validate → prepare → execute → finalize
    agents/
      orchestrator.ts               # defineAgent + hooks (stays, but tools call Ports)
    ports/
      i-dispatch.port.ts            # IDispatchAgentPort interface
      i-jira-linear.port.ts         # IJiraLinearPort interface
      i-task-queue.port.ts          # ITaskQueuePort interface
      i-hitl.port.ts                # IHitlPort interface
    gateways/
      dispatch.gateway.ts           # Calls agent Workers via service binding
      jira-linear.gateway.ts        # Calls JIRA_LINEAR_TOOL via RPC
      task-queue.gateway.ts         # Calls TASK_QUEUE_TOOL via RPC
      hitl.gateway.ts               # D1 HITL operations
    models/
      flax-instance.model.ts        # BaseModel for flax_instances
      flax-stage.model.ts           # BaseModel for flax_stages
      flax-hitl.model.ts            # BaseModel for flax_hitl
    services/
      orchestrator.service.ts       # Orchestrates models (dispatch, HITL, registry)
    tools/
      dispatch-agent.tool.ts        # Calls Port, not raw RPC
      jira-linear.tool.ts           # Calls Port, not raw RPC
      task-queue.tool.ts            # Calls Port, not raw RPC
      request-human-input.tool.ts   # Calls Port, not raw D1
```

## Layer details

### Controller

The controller handles HTTP concerns only:

- `GET /agents/orchestrator` — list instances (delegates to Feature)
- `GET /api/ping` — health check

```typescript
export class OrchestratorController extends BaseController {
  async listInstances() {
    const feature = new OrchestratorFeature();
    return feature.handle({ action: "list" }, this.context);
  }
}
```

### Feature

The feature orchestrates the agent lifecycle:

- `validate(input)` — check conversationId exists, user is authorized
- `prepare(input)` — enrich with timestamps, user context
- `execute(input)` — delegate to AgentRuntime (LLM loop)
- `finalize(result)` — emit integration events, update metrics
- `toResponse(result)` — map to HTTP response

### Ports

Each tool backend gets a port interface (from `@nowarelabs/agent-ports`):

- `IDispatchAgentPort` — dispatch tasks to other agents
- `IJiraLinearPort` — create/update/get Jira/Linear issues
- `ITaskQueuePort` — enqueue/get/assign tasks
- `IHitlPort` — create/resolve HITL requests

### Gateways

Each gateway implements a port by calling the actual service:

- `DispatchAgentGateway` — calls `env[AGENT_NAME].fetch()`
- `JiraLinearGateway` — calls `env.JIRA_LINEAR_TOOL` RPC
- `TaskQueueGateway` — calls `env.TASK_QUEUE_TOOL` RPC
- `HitlGateway` — writes to D1 via BaseModel

### Models

D1 tables become BaseModel subclasses:

- `FlaxInstanceModel` — `flax_instances` (id, created_at, last_seen_at, title, origin,
  current_stage, current_agent, status, last_activity_at)
- `FlaxStageModel` — `flax_stages` (id, conversation_id, stage, agent, detail, started_at,
  finished_at)
- `FlaxHitlModel` — `flax_hitl` (id, conversation_id, question, options, status, answer,
  created_at, resolved_at, expires_at)

### Services

Services orchestrate models:

- `OrchestratorService` — dispatch management, instance registry, HITL lifecycle

## Data flow

### Dispatch flow (current → target)

**Current:**

```
Orchestrator LLM → dispatch_agent tool → env.AGENT_NAME.fetch() → Target Agent
                                        (raw RPC, no validation)
```

**Target:**

```
Orchestrator LLM → dispatch_agent tool → DispatchAgentPort.execute()
                                            → DispatchAgentGateway.execute()
                                              → env[AGENT_NAME].fetch()
                                            (port contract, schema validation)
```

### HITL flow (current → target)

**Current:**

```
Orchestrator LLM → request_human_input tool → raw D1 INSERT
```

**Target:**

```
Orchestrator LLM → request_human_input tool → HitlPort.execute()
                                                → HitlGateway.execute()
                                                  → HitlHitlModel.create()
                                                  (BaseModel lifecycle hooks)
```

## Test strategy

### Unit tests (per layer)

- **Controller**: HTTP request → response mapping
- **Feature**: validate/prepare/execute/finalize lifecycle
- **Ports**: contract compliance (mock gateways)
- **Gateways**: RPC call mapping (mock service bindings)
- **Models**: D1 CRUD operations (mock D1Database)
- **Services**: orchestration logic (mock models)

### Integration test

Full pipeline: HTTP request → Controller → Feature → AgentRuntime → Tool → Port → Gateway → Model

### Test commands

```bash
cd packages/flax/packages/agents/orchestrator-agent
vp test       # unit tests
vp check      # lint + format
```
