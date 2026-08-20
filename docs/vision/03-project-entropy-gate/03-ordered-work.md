# 03 — Entropy Gate: Ordered Work

Implementation phases. Every phase ends with `vp check` + `vp test` green.

## Phase 1 — Package scaffold + types

Goal: Create the entropy-gate package with core types.

1. Scaffold `packages/entropy-gate` per `02-package-conventions.md` (pure variant).
2. Create `src/types.ts`:
   - `GateResult` — { pass, gate, reason?, metadata? }
   - `GateDecision` — { allowed, gates[], timestamp, sourceAgent?, targetAgent? }
   - `GateContext` — { sourceAgent, targetAgent, currentStage, metadata? }
   - `GateConfig` — { schema?, semantic?, ordering?, provenance?, consistency?, stageOrder?, maxConcurrent?, circuitBreaker? }
3. Create `src/config.ts`:
   - `defaultConfig` — default gate configuration
   - `strictConfig` — all gates enabled, strict validation
   - `permissiveConfig` — only schema gate enabled
4. Create `src/index.ts` — re-exports.
5. `vp check` + `vp pack` green.

## Phase 2 — Schema Gate

Goal: Type/schema validation gate.

1. Create `src/gates/schema.gate.ts`:
   - Agent name validation (picklist of 15)
   - Branch name validation (regex: `^[a-z0-9][a-z0-9\-\/]*$`, max 64)
   - Repo name validation (regex: `^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$`)
   - Conversation ID validation (UUID format)
   - Stage name validation (picklist of pipeline stages)
2. Create `tests/gates/schema.test.ts`:
   - Valid agent names pass
   - Invalid agent names fail
   - Valid branch names pass
   - Invalid branch names fail
   - Valid repo names pass
   - Invalid repo names fail
3. `vp check` + `vp test` green.

## Phase 3 — Semantic Gate

Goal: Value validation gate.

1. Create `src/gates/semantic.gate.ts`:
   - Task description validation (length 10-500, contains action verb)
   - Attribute value validation (non-empty, max length 200)
   - Conversation body validation (non-empty)
2. Create `tests/gates/semantic.test.ts`:
   - Valid tasks pass
   - Too short/long tasks fail
   - Tasks without action verbs fail
   - Valid attributes pass
   - Empty attributes fail
3. `vp check` + `vp test` green.

## Phase 4 — Ordering Gate

Goal: Pipeline stage ordering enforcement.

1. Create `src/gates/ordering.gate.ts`:
   - Stage order array (configurable)
   - Forward transition validation
   - Backward transition rejection
   - Unknown stage rejection
   - Concurrent stage limits
2. Create `tests/gates/ordering.test.ts`:
   - Forward transitions pass
   - Backward transitions fail
   - Unknown stages fail
   - Concurrent limits enforced
3. `vp check` + `vp test` green.

## Phase 5 — Provenance Gate

Goal: Source tracking and cycle detection.

1. Create `src/gates/provenance.gate.ts`:
   - ProvenanceRecord tracking
   - Data hashing (SHA-256 via Web Crypto)
   - Cycle detection (echo detection)
   - Audit trail
2. Create `tests/gates/provenance.test.ts`:
   - Tracking works
   - Cycles detected
   - Audit trail maintained
3. `vp check` + `vp test` green.

## Phase 6 — Consistency Gate

Goal: Contradiction detection.

1. Create `src/gates/consistency.gate.ts`:
   - Claim recording
   - Contradiction detection (same claim, different truth values)
   - Agent agreement tracking
2. Create `tests/gates/consistency.test.ts`:
   - Contradictions detected
   - Agreement tracked
3. `vp check` + `vp test` green.

## Phase 7 — Base gate + integration

Goal: Compose all gates into EntropyGate class.

1. Create `src/gate.ts`:
   - `EntropyGate` class
   - `evaluate(input, context)` — runs all enabled gates in sequence
   - Short-circuit on first failure (configurable)
   - Circuit breaker logic
2. Create `tests/index.test.ts`:
   - All gates composed correctly
   - Short-circuit behavior
   - Circuit breaker triggers
3. Create `tests/integration.test.ts`:
   - Integration with mock Port/Gateway
   - Full flow: input → gate → execution
4. `vp check` + `vp test` green.

## Phase 8 — Orchestrator integration

Goal: Integrate entropy gate into orchestrator's dispatch flow.

1. Add `@nowarelabs/entropy-gate` as dependency to orchestrator-agent.
2. Update `dispatch.gateway.ts` to use EntropyGate:
   ```typescript
   async execute(input: DispatchAgentInput) {
     const decision = await this.gate.evaluate(input, { ... });
     if (!decision.allowed) return { success: false, error: ..., status: "abandoned" };
     return this.callAgent(input);
   }
   ```
3. Update `hitl.gateway.ts` to validate HITL records through gate.
4. Add gate metrics to dashboard (optional, follow-up).
5. Write integration test: inject invalid dispatch → gate rejects.
6. `vp check` + `vp test` green.

## Definition of done

- `@nowarelabs/entropy-gate` package exists with all 5 gates.
- Each gate has unit tests.
- EntropyGate class composes all gates.
- Orchestrator dispatches through entropy gate.
- Invalid dispatches are rejected.
- Valid dispatches pass through.
- `vp check` + `vp test` green.
- Circuit breaker works (contamination threshold → pause).
