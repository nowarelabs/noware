# 02 — Orchestrator Migration: Ordered Work

Implementation phases. Every phase ends with `vp check` + `vp test` green.

## Phase 1 — Models (D1 → BaseModel)

Goal: Replace raw SQL in `dashboard-db.ts` with BaseModel subclasses.

1. Create `packages/flax/packages/agents/orchestrator-agent/src/models/` directory.
2. Create `flax-instance.model.ts` — BaseModel for `flax_instances` table:
   - Fields: id, created_at, last_seen_at, title, origin, current_stage, current_agent, status, last_activity_at
   - Methods: `findByConversationId()`, `patchInstance()`, `listRecent()`
3. Create `flax-stage.model.ts` — BaseModel for `flax_stages` table:
   - Fields: id, conversation_id, stage, agent, detail, started_at, finished_at
   - Methods: `openStage()`, `closeStage()`, `findByConversationId()`
4. Create `flax-hitl.model.ts` — BaseModel for `flax_hitl` table:
   - Fields: id, conversation_id, question, options, status, answer, created_at, resolved_at, expires_at
   - Methods: `createHitl()`, `resolveHitl()`, `pendingCount()`
5. Update `dashboard-db.ts` to use Models instead of raw SQL.
6. Write unit tests for each Model (mock D1Database).
7. `vp check` + `vp test` green.

## Phase 2 — Ports (tool contracts)

Goal: Define port interfaces for all 4 tool backends.

1. Create `packages/flax/packages/agents/orchestrator-agent/src/ports/` directory.
2. Create `i-dispatch.port.ts` — `IDispatchAgentPort` interface:
   ```typescript
   interface IDispatchAgentPort extends Port<DispatchInput, DispatchOutput> {}
   ```
3. Create `i-jira-linear.port.ts` — `IJiraLinearPort` interface.
4. Create `i-task-queue.port.ts` — `ITaskQueuePort` interface.
5. Create `i-hitl.port.ts` — `IHitlPort` interface.
6. Verify ports match `@nowarelabs/agent-ports` conventions.
7. `vp check` green.

## Phase 3 — Gateways (tool implementations)

Goal: Implement gateways that call actual services.

1. Create `packages/flax/packages/agents/orchestrator-agent/src/gateways/` directory.
2. Create `dispatch.gateway.ts` — calls `env[AGENT_NAME].fetch()`:
   - Validates response schema
   - Maps service binding errors to UseCaseResult
3. Create `jira-linear.gateway.ts` — calls `env.JIRA_LINEAR_TOOL` RPC.
4. Create `task-queue.gateway.ts` — calls `env.TASK_QUEUE_TOOL` RPC.
5. Create `hitl.gateway.ts` — writes to D1 via FlaxHitlModel.
6. Write unit tests for each Gateway (mock service bindings).
7. `vp check` + `vp test` green.

## Phase 4 — Services (orchestration logic)

Goal: Create services that orchestrate models.

1. Create `packages/flax/packages/agents/orchestrator-agent/src/services/` directory.
2. Create `orchestrator.service.ts`:
   - `dispatchTask(input)` — create stage, dispatch agent, track instance
   - `createHitl(input)` — create HITL record, update instance status
   - `resolveHitl(input)` — resolve HITL, update instance status
   - `listInstances()` — query instances with metadata
3. Write unit tests for Service (mock Models).
4. `vp check` + `vp test` green.

## Phase 5 — Controller + Feature (HTTP layer)

Goal: Wrap agent in standard gauge HTTP layer.

1. Create `packages/flax/packages/agents/orchestrator-agent/src/controllers/` directory.
2. Create `orchestrator.controller.ts`:
   - `listInstances()` — GET /agents/orchestrator
   - `ping()` — GET /api/ping
3. Create `packages/flax/packages/agents/orchestrator-agent/src/features/` directory.
4. Create `orchestrator.feature.ts`:
   - `validate(input)` — check conversationId, authorization
   - `prepare(input)` — enrich with context
   - `execute(input)` — delegate to AgentRuntime
   - `finalize(result)` — emit events
   - `toResponse(result)` — HTTP response
5. Update `app.ts` to use Controller + Feature.
6. Write unit tests for Controller and Feature.
7. `vp check` + `vp test` green.

## Phase 6 — Tool wrappers (call Ports)

Goal: Update agent tool wrappers to use Ports instead of raw RPC.

1. Update `dispatch-agent.tool.ts`:
   - Import DispatchAgentPort
   - Call `port.execute()` instead of `env.AGENT_NAME.fetch()`
2. Update `jira-linear.tool.ts`:
   - Import JiraLinearPort
   - Call `port.execute()` instead of `env.JIRA_LINEAR_TOOL` RPC
3. Update `task-queue.tool.ts`:
   - Import TaskQueuePort
   - Call `port.execute()` instead of `env.TASK_QUEUE_TOOL` RPC
4. Update `request-human-input.tool.ts`:
   - Import HitlPort
   - Call `port.execute()` instead of raw D1 INSERT
5. Write unit tests for updated tool wrappers.
6. `vp check` + `vp test` green.

## Phase 7 — Integration test + cleanup

Goal: End-to-end test + remove old code.

1. Write integration test: HTTP request → Controller → Feature → AgentRuntime → Tool → Port → Gateway → Model.
2. Remove old `dashboard-db.ts` (replaced by Models + Services).
3. Remove any remaining raw SQL or raw RPC calls.
4. Update `app.ts` to use new Controller + Feature.
5. Full test suite green.
6. `vp check` + `vp test` green.

## Definition of done

- Orchestrator uses full @nowarelabs stack layers.
- All tool wrappers call Ports, not raw RPC.
- D1 access via BaseModel (no raw SQL).
- Controller + Feature wrap the HTTP layer.
- All 4 tool backends have Port + Gateway.
- `vp check` + `vp test` green.
- Reference implementation ready for remaining 15 agents.
