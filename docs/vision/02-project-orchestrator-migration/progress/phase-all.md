# Orchestrator Migration — All Phases (done)

Implements all 7 phases of `03-ordered-work.md`. The orchestrator agent now uses the
full @nowarelabs Standard Gauge stack.

## Phase 1 — Models (D1 → BaseModel)

Created BaseModel subclasses for 3 D1 tables:

- `src/models/flax-instance.model.ts` — `FlaxInstanceModel` with `patchFields`, `listRecent`, `findByConversationId`, `ensureSchema`
- `src/models/flax-stage.model.ts` — `FlaxStageModel` with `openStage`, `closeOpenStage`, `hasOpenStage`, `findByConversationId`, `ensureSchema`
- `src/models/flax-hitl.model.ts` — `FlaxHitlModel` with `insertHitl`, `pendingCount`, `resolveHitl`, `findByConversationId`, `ensureSchema`
- `src/models/schema.ts` — table definitions and row types
- `src/models/index.ts` — re-exports
- `src/dashboard-db.ts` — refactored to delegate to models (STAGE_MAP/RAIL_STAGES preserved)
- `tests/index.test.ts` — 25 unit tests with mock D1Database

## Phase 2 — Ports (verified)

Ports already exist in `@nowarelabs/agent-ports`:
- `IDispatchAgentPort`, `IJiraLinearPort`, `ITaskQueuePort`, `IHitlPort`
- All conform to `Port<TInput, TOutput>` convention

## Phase 3 — Gateways (verified)

Gateways already exist in `@nowarelabs/agent-gateways`:
- `DispatchAgentGateway`, `JiraLinearGateway`, `TaskQueueGateway`, `HitlGateway`
- All extend `BaseGateway` and implement the corresponding port interfaces

## Phase 4 — Services

Created `OrchestratorService`:
- `src/services/orchestrator.service.ts` — orchestrates models for dispatch, HITL, instance registry
- `src/services/index.ts` — re-export
- Dependencies: D1Database, optional IDispatchAgentPort, optional IHitlPort

## Phase 5 — Controller + Feature

- `src/controllers/orchestrator.controller.ts` — extends BaseController, actions: `listInstances`, `ping`
- `src/features/orchestrator.feature.ts` — extends BaseFeature, lifecycle: validate → prepare → execute → finalize → toResponse
- `src/app.ts` — updated to delegate routes to controller
- `src/controllers/index.ts`, `src/features/index.ts` — re-exports

## Phase 6 — Tool wrappers (call Ports)

All 4 tools updated to call Ports via local gateway classes:
- `dispatch-agent.ts` — `LocalDispatchAgentGateway` implements `IDispatchAgentPort`
- `jira-linear-tool.ts` — `LocalJiraLinearGateway` implements `IJiraLinearPort`
- `task-queue-tool.ts` — `LocalTaskQueueGateway` implements `ITaskQueuePort`
- `request-human-input.ts` — `LocalHitlGateway` implements `IHitlPort`

## Phase 7 — Integration test + cleanup

- `tests/integration.test.ts` — 11 tests covering service, controller, and feature integration

## Verification

| check      | result                              |
| ---------- | ----------------------------------- |
| `vp check` | clean (0 warnings)                  |
| `vp test`  | 36 pass (25 unit + 11 integration) |
| full workspace | 46 files, 1181 tests pass       |

## Target data flow (achieved)

```
Request → HttpEntrypoint → createAgentRouter
  → OrchestratorController → OrchestratorFeature → OrchestratorService
    → FlaxInstanceModel / FlaxStageModel / FlaxHitlModel (D1)

Agent LLM → Tool → Port → Gateway → External
```

## New dependencies added

- `@nowarelabs/models` — BaseModel for D1 persistence
- `@nowarelabs/agent-ports` — port interfaces
- `@nowarelabs/gateways` — BaseGateway
- `@nowarelabs/controllers` — BaseController
- `@nowarelabs/features` — BaseFeature
