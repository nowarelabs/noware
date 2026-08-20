# 05 — Company Builder: Specification

## Overview

The company builder is a three-layer system that turns a natural language company description into a fleet of running, operational systems on Cloudflare. Each layer builds on the previous:

1. **Codebase builder** (done) — stigmergic agents build code from cfour models
2. **System builder** — provisions databases, deploys workers, configures integrations
3. **Company builder** — parses descriptions, orchestrates the full build pipeline

## Layer 1: Codebase Builder (reference)

Already implemented in `04-project-stigmergic-agents`. Uses:
- Cfour models to define architecture
- Atoms as code elements
- Stigmergic agents to build code
- Entropy gate for quality control
- Pattern catalog for consistent architecture

## Layer 2: System Builder

### Purpose

Turn a codebase (built by Layer 1) into a deployable, operational Cloudflare system.

### Components

#### `SystemBuilder` (new package: `@nowarelabs/system-builder`)

```typescript
interface SystemSpec {
  id: string;
  name: string;
  type: "worker" | "d1" | "kv" | "r2" | "do";
  cfourElementId: string;
  parentContainerId: string;
  config: Record<string, unknown>;
  database?: DatabaseSpec;
  bindings: BindingSpec[];
  integrations: IntegrationSpec[];
}

interface DatabaseSpec {
  name: string;
  tables: TableSpec[];
  migrations: MigrationSpec[];
}

interface TableSpec {
  name: string;
  columns: ColumnSpec[];
  indexes: IndexSpec[];
}

interface ColumnSpec {
  name: string;
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB" | "BOOLEAN";
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: unknown;
}

interface BindingSpec {
  name: string;
  type: "D1" | "KV" | "R2" | "DO" | "SERVICE";
  resource: string;
}

interface IntegrationSpec {
  type: "webhook" | "api" | "queue" | "cron";
  endpoint: string;
  method?: string;
  auth?: AuthSpec;
}

interface AuthSpec {
  type: "api-key" | "jwt" | "oauth" | "mtls";
  config: Record<string, unknown>;
}
```

#### `Provisioner` (handles Cloudflare resource provisioning)

```typescript
class Provisioner {
  provisionDatabase(spec: DatabaseSpec): Promise<{ databaseId: string; endpoint: string }>;
  provisionWorker(spec: SystemSpec): Promise<{ workerName: string; url: string }>;
  provisionKV(spec: KVSpec): Promise<{ namespaceId: string }>;
  provisionR2(spec: R2Spec): Promise<{ bucketName: string }>;
  provisionDO(spec: DOSpec): Promise<{ className: string }>;
  deprovision(id: string): Promise<void>;
}
```

#### `Deployer` (handles code deployment to Workers)

```typescript
class Deployer {
  deploy(workerName: string, code: string, bindings: BindingSpec[]): Promise<{ url: string; status: string }>;
  rollback(workerName: string, version: string): Promise<void>;
  getDeploymentStatus(workerName: string): Promise<DeploymentStatus>;
}
```

#### `ConfigGenerator` (generates wrangler.toml from system spec)

```typescript
class ConfigGenerator {
  generate(spec: SystemSpec): string;
  generateDatabaseMigration(tables: TableSpec[]): string;
  generateBindings(bindings: BindingSpec[]): Record<string, unknown>;
}
```

### System Builder Flow

```
SystemSpec → Provisioner → Deployer → ConfigGenerator → Running System
                │
                ├── D1 database (tables, indexes, migrations)
                ├── Worker (code, bindings)
                ├── KV namespace (cache)
                ├── R2 bucket (storage)
                └── DO class (stateful logic)
```

## Layer 3: Company Builder

### Purpose

Parse a natural language company description into a cfour model, then orchestrate the full build pipeline.

### Components

#### `CompanyParser` (new package: `@nowarelabs/company-parser`)

```typescript
interface CompanyDescription {
  name: string;
  industry: string;
  description: string;
  departments: DepartmentDescription[];
}

interface DepartmentDescription {
  name: string;
  description: string;
  teams: TeamDescription[];
}

interface TeamDescription {
  name: string;
  description: string;
  roles: RoleDescription[];
}

interface RoleDescription {
  name: string;
  description: string;
  capabilities: string[];
}
```

Parser converts NL → `CompanyDescription` → cfour model (structured output).

#### `CompanyBuilder` (new package: `@nowarelabs/company-builder`)

```typescript
class CompanyBuilder {
  build(CompanyDescription): Promise<CompanyResult>;
}

interface CompanyResult {
  cfourModelId: string;
  orchestratorId: string;
  systems: SystemBuildResult[];
  status: "building" | "deployed" | "failed";
}

interface SystemBuildResult {
  systemId: string;
  workerUrl: string;
  databaseId: string;
  status: "provisioning" | "building" | "deployed" | "failed";
}
```

#### `CompanyOrchestrator` (extends `@nowarelabs/agents` orchestrator)

```typescript
class CompanyOrchestrator extends OrchestratorService {
  buildCompany(description: string): Promise<CompanyResult>;
  monitorBuild(result: CompanyResult): Promise<BuildStatus>;
  selfHeal(failedSystem: SystemBuildResult): Promise<SystemBuildResult>;
}
```

### Company Builder Flow

```
Natural Language Description
  │
  ├── CompanyParser → CompanyDescription
  │
  ├── CfourModelGenerator → cfour model (departments, teams, roles, tasks)
  │
  ├── OrchestratorFactory → root orchestrator + child orchestrators
  │     ├── SS orchestrator (department)
  │     ├── Container orchestrator (team)
  │     ├── Component orchestrator (role)
  │     └── Code orchestrator (task)
  │
  ├── SystemBuilder → for each "employee" (container):
  │     ├── Provision D1 database
  │     ├── Generate tables + migrations
  │     ├── Deploy Worker with code from stigmergic agents
  │     ├── Configure bindings (D1, KV, R2, DO)
  │     ├── Set up integrations (webhooks, APIs, queues)
  │     ├── Configure auth (API keys, rate limiting)
  │     └── Set up monitoring (health checks, metrics, alerts)
  │
  └── SelfHealer → ongoing maintenance:
        ├── Health checks
        ├── Auto-scaling
        ├── Incident response
        └── Pattern-based recovery
```

### Monitoring & Self-Healing

```typescript
interface HealthCheck {
  systemId: string;
  endpoint: string;
  intervalMs: number;
  timeoutMs: number;
  expectedStatus: number;
}

interface AlertRule {
  id: string;
  condition: string; // e.g., "errorRate > 0.05"
  action: "notify" | "restart" | "scale" | "rollback";
  cooldown: number;
}

interface SelfHealer {
  monitor(healthChecks: HealthCheck[]): void;
  heal(failedSystem: SystemBuildResult): Promise<SystemBuildResult>;
  scale(systemId: string, replicas: number): Promise<void>;
  rollback(systemId: string): Promise<void>;
}
```

### System Templates

Reusable templates for common employee types:

```typescript
interface SystemTemplate {
  name: string;
  description: string;
  database: DatabaseSpec;
  bindings: BindingSpec[];
  integrations: IntegrationSpec[];
  auth: AuthSpec;
  monitoring: HealthCheck[];
  codeTemplate: string; // starter code
}

const TEMPLATES: Record<string, SystemTemplate> = {
  "payment-gateway": { ... },
  "kyc-service": { ... },
  "notification-service": { ... },
  "fraud-detection": { ... },
  "admin-dashboard": { ... },
};
```

## Package Structure

New packages:

| Package | Purpose |
|---------|---------|
| `@nowarelabs/system-builder` | System spec, provisioner, deployer, config generator |
| `@nowarelabs/company-parser` | NL → CompanyDescription → cfour model |
| `@nowarelabs/company-builder` | CompanyBuilder orchestrator, self-healer, templates |

Extended packages:

| Package | Extension |
|---------|-----------|
| `@nowarelabs/agents` | CompanyOrchestrator extends OrchestratorService |
| `@nowarelabs/shared` | CompanyBuilder types (CompanyDescription, SystemSpec, etc.) |
| `@nowarelabs/durable-objects` | SystemDO, DeploymentDO |

## Testing

Each layer has its own test suite:

- **System Builder**: provisioning, deployment, config generation (mocked Cloudflare API)
- **Company Parser**: NL parsing, cfour model generation
- **Company Builder**: full pipeline integration test (end-to-end with mocked Cloudflare)
- **Self-Healer**: health checks, auto-healing, rollback
