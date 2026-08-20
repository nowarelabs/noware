# 05 — Company Builder: Ordered Work

## Phase 1 — Shared types and NL Parser foundation

**Status:** `pending`

**Goal:** Define all company builder types in shared, create the NL parser package.

### Steps

1. Add company builder types to `@nowarelabs/shared`:
   - `CompanyDescription`, `DepartmentDescription`, `TeamDescription`, `RoleDescription`
   - `SystemSpec`, `DatabaseSpec`, `TableSpec`, `ColumnSpec`, `BindingSpec`, `IntegrationSpec`, `AuthSpec`
   - `CompanyResult`, `SystemBuildResult`, `HealthCheck`, `AlertRule`
   - `SystemTemplate`
2. Create `@nowarelabs/company-parser` package:
   - `CompanyParser` class with `parse(description: string): Promise<CompanyDescription>`
   - Cfour model generator: `CompanyDescription → cfour model`
   - Tests for parsing structured descriptions
3. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-01.md`

---

## Phase 2 — System Builder scaffold

**Status:** `pending`

**Goal:** Create the system builder package with provisioner and deployer interfaces.

### Steps

1. Create `@nowarelabs/system-builder` package:
   - `SystemBuilder` class
   - `Provisioner` class (D1, Worker, KV, R2, DO)
   - `Deployer` class (Worker deployment, rollback)
   - `ConfigGenerator` class (wrangler.toml, migrations, bindings)
2. Database migration generator from `TableSpec[]`
3. Worker deployment code generation from system spec
4. Tests for provisioning, deployment, config generation (mocked Cloudflare API)
5. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-02.md`

---

## Phase 3 — System templates

**Status:** `pending`

**Goal:** Create reusable system templates for common employee types.

### Steps

1. Define `SystemTemplate` type (in shared)
2. Create template library in system-builder:
   - `payment-gateway` — D1 + Hono + mobile money integrations
   - `kyc-service` — D1 + document verification
   - `notification-service` — D1 + SMS/email/push
   - `fraud-detection` — D1 + rule engine
   - `admin-dashboard` — D1 + KV + monitoring
   - `generic-api` — D1 + Hono (base template)
3. Template selection logic based on role description
4. Tests for template generation
5. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-03.md`

---

## Phase 4 — Company Builder orchestrator

**Status:** `pending`

**Goal:** Build the full company builder pipeline.

### Steps

1. Create `@nowarelabs/company-builder` package:
   - `CompanyBuilder` class
   - `CompanyOrchestrator` extending `OrchestratorService`
2. Pipeline: NL description → parser → cfour model → orchestrator hierarchy → system building → deployment
3. Orchestrator hierarchy factory:
   - Root orchestrator (company)
   - SS orchestrators (departments)
   - Container orchestrators (teams)
   - Component orchestrators (roles)
   - Code orchestrators (tasks)
4. Parallel system building (stigmergic agents for code, system builder for infrastructure)
5. Build status tracking and reporting
6. Tests for full pipeline (mocked Cloudflare API)
7. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-04.md`

---

## Phase 5 — Durable Objects for state

**Status:** `pending`

**Goal:** Add SystemDO and DeploymentDO for stateful tracking.

### Steps

1. Add to `@nowarelabs/durable-objects`:
   - `SystemDO` — tracks system build state, health, deployment status
   - `DeploymentDO` — tracks deployment history, rollback points
2. State management for system lifecycle:
   - Provisioning → Building → Deployed → Healthy → Degraded → Failed
   - Rollback state machine
3. Integration with CompanyBuilder
4. Tests for DO state management
5. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-05.md`

---

## Phase 6 — Monitoring and health checks

**Status:** `pending`

**Goal:** Implement health check system and alert rules.

### Steps

1. `HealthChecker` class in system-builder:
   - HTTP health checks with configurable intervals
   - Status code validation
   - Response time tracking
   - Error rate calculation
2. `AlertManager` class:
   - Rule-based alerting (error rate, latency, availability)
   - Actions: notify, restart, scale, rollback
   - Cooldown management
3. `MetricsCollector` class:
   - Request count, latency, error rate
   - D1 query metrics
   - Custom metrics per system
4. Integration with CompanyBuilder for monitoring setup
5. Tests for health checks, alerts, metrics
6. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-06.md`

---

## Phase 7 — Self-healing system

**Status:** `pending`

**Goal:** Implement automatic recovery and maintenance.

### Steps

1. `SelfHealer` class in company-builder:
   - Health monitoring loop
   - Automatic restart on failure
   - Rollback on repeated failures
   - Scale adjustment based on load
2. Recovery strategies:
   - Level 1: Restart (simple restart)
   - Level 2: Rollback (deploy previous version)
   - Level 3: Rebuild (rebuild from scratch)
   - Level 4: Alert (human intervention)
3. Pattern-based learning:
   - Record failure patterns
   - Predict failures before they happen
   - Adjust thresholds based on history
4. Integration with orchestrator hierarchy
5. Tests for self-healing scenarios
6. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-07.md`

---

## Phase 8 — Integration test and end-to-end

**Status:** `pending`

**Goal:** Full integration test of the company builder pipeline.

### Steps

1. End-to-end integration test:
   - Input: natural language company description
   - Process: parse → generate cfour → build orchestrator hierarchy → build systems → deploy
   - Output: fleet of running systems with health checks
2. Test with realistic company description:
   - "Build a payment processing company with KYC, fraud detection, notifications"
   - Verify 5+ systems are built and deployed
3. Test self-healing:
   - Simulate system failure
   - Verify automatic recovery
4. Test rollback:
   - Deploy bad version
   - Verify automatic rollback
5. Run full workspace tests
6. Run `vp check --fix` and `vp test`

**Progress:** `progress/phase-08.md`

---

## Dependencies

- 04-project-stigmergic-agents (done)
- 03-project-entropy-gate (done)
- 02-project-orchestrator-migration (done)
- 01-project-gen-diesel (done)

## Success Criteria

- [ ] NL description → cfour model works
- [ ] System builder provisions D1 + Workers (mocked)
- [ ] Company builder orchestrates full pipeline
- [ ] Self-healing recovers from failures
- [ ] All 5+ phases pass tests
- [ ] Full workspace tests pass
