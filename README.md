# nowarelabs

A fullstack typescript framework built for convention over configuration on Cloudflare Workers.

## Architecture

See [architecture.md](architecture.md) for the full Standard Gauge reference.

## Packages

### Core Framework

| Package                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `@nowarelabs/shared`   | Value objects, shared types                     |
| `@nowarelabs/result`   | Result type for error handling                  |
| `@nowarelabs/contexts` | BaseContext — bounded context container         |
| `@nowarelabs/modules`  | BaseModule — autoloading & feature registration |
| `@nowarelabs/features` | BaseFeatureHandler — task orchestration         |
| `@nowarelabs/domains`  | Domain utilities                                |

### API Layer

| Package                          | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| `@nowarelabs/rpc`                | BaseRpcServer, BaseRpc — double-gate RPC                 |
| `@nowarelabs/router`             | Router, RouteDrawer — routing                            |
| `@nowarelabs/entrypoints`        | Worker entry points                                      |
| `@nowarelabs/integration-events` | BaseIntegrationEvent, EventBus — cross-context broadcast |
| `@nowarelabs/events`             | BaseDomainEvent, DomainEventBus                          |

### RCSM (Controller → Service → Model)

| Package                   | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `@nowarelabs/controllers` | BaseController, BaseResourceController          |
| `@nowarelabs/services`    | BaseService — business logic                    |
| `@nowarelabs/models`      | BaseModel with Drizzle ORM                      |
| `@nowarelabs/aggregates`  | BaseAggregate — event sourcing                  |
| `@nowarelabs/query`       | BaseQueryController, BaseQueryProjection — CQRS |
| `@nowarelabs/dtos`        | Data transfer objects                           |
| `@nowarelabs/validators`  | BaseValidator — input validation                |
| `@nowarelabs/normalizers` | BaseNormalizer — input normalization            |
| `@nowarelabs/serializers` | Output serialization                            |

### Infrastructure

| Package                       | Description                               |
| ----------------------------- | ----------------------------------------- |
| `@nowarelabs/persistence`     | BasePersistence, D1Persistence            |
| `@nowarelabs/sql`             | SQL query builder, dialects               |
| `@nowarelabs/migrations`      | MigrationRunner                           |
| `@nowarelabs/durable_objects` | BaseDurableObject for Cloudflare DO       |
| `@nowarelabs/gateways`        | BaseInfrastructureAdapter, CircuitBreaker |
| `@nowarelabs/adapters`        | Port implementations                      |
| `@nowarelabs/ports`           | BasePort interfaces                       |
| `@nowarelabs/jobs`            | JobRunner — background jobs               |
| `@nowarelabs/telemetry`       | Telemetry utilities                       |
| `@nowarelabs/logger`          | Logger                                    |

### Views & Assets

| Package                  | Description                          |
| ------------------------ | ------------------------------------ |
| `@nowarelabs/views`      | BaseView, BaseLayout — JSX rendering |
| `@nowarelabs/formatters` | BaseFormatter — output formatting    |
| `@nowarelabs/assets`     | AssetPipeline — static assets        |

### Cross-cutting

| Package                   | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `@nowarelabs/plugins`     | BaseGlobalPlugin, PluginRegistry — aspect-oriented |
| `@nowarelabs/maintenance` | TaskRegistry — maintenance tasks                   |
| `@nowarelabs/scripts`     | Script utilities                                   |

### Architecture as Contract (C4 Model)

| Package                    | Description                                                                                                     | Tests |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- |
| `@nowarelabs/cfour`        | Pure C4 domain kernel: workspaces, elements, relationships, claims, proposals, branching, merge, lint, validate | 140   |
| `@nowarelabs/workspace-do` | Durable Object: persistence, RPC, WebSocket subscriptions, alarm-based claim expiry                             | 40    |
| `@nowarelabs/gen-diesel`   | Codegen pipeline: extractors, drift detection, diagram renderers, template packs                                | 28    |
| `@nowarelabs/agents`       | Multi-agent orchestration: sessions, leases, heartbeats, task queues, reconciliation                            | 27    |
| `@nowarelabs/merge-review` | Review/approval pipeline: gates (lint/validate/drift/blockers), merge policy, auto-merge                        | 32    |

## Development

```bash
pnpm install
pnpm vp test        # run all tests
pnpm vp check       # lint + format + typecheck
```
