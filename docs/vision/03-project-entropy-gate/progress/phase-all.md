# Entropy Gate — All Phases (done)

Implements all 8 phases of `03-ordered-work.md`. The `@nowarelabs/entropy-gate`
package provides a validation layer between agents that prevents cross-contamination.

## Package: `@nowarelabs/entropy-gate`

### Phase 1 — Package scaffold + types

- `src/types.ts` — `GateResult`, `GateDecision`, `GateContext`, `GateConfig`
- `src/config.ts` — `defaultConfig`, `strictConfig`, `permissiveConfig`
- `src/index.ts` — barrel re-exports

### Phase 2 — Schema Gate

- `src/gates/schema.gate.ts` — agent name (16-agent picklist), branch name (regex), repo name (org/repo format), conversation ID (UUID), stage name validation

### Phase 3 — Semantic Gate

- `src/gates/semantic.gate.ts` — task description (10-500 chars, action verb), attribute values (non-empty, max 200), conversation body validation

### Phase 4 — Ordering Gate

- `src/gates/ordering.gate.ts` — forward-only stage transitions, unknown stage rejection, concurrent limits

### Phase 5 — Provenance Gate

- `src/gates/provenance.gate.ts` — `ProvenanceTracker` with Web Crypto SHA-256 hashing, echo detection, audit trail

### Phase 6 — Consistency Gate

- `src/gates/consistency.gate.ts` — `ConsistencyChecker` with claim recording, contradiction detection, agent agreement tracking

### Phase 7 — Base gate + integration

- `src/gate.ts` — `EntropyGate` class composing all 5 gates, short-circuit on first failure, circuit breaker logic, `createEntropyGate()` factory
- `tests/index.test.ts` — 47 tests covering all gates + integration

### Phase 8 — Orchestrator integration

- Added `@nowarelabs/entropy-gate` as dependency to orchestrator-agent
- Updated `dispatch-agent.ts` to evaluate through `EntropyGate` before dispatching
- Rejected dispatches return error status without calling the target agent

## Verification

| check      | result                    |
| ---------- | ------------------------- |
| `vp check` | clean (0 warnings)        |
| `vp test`  | 47 pass                   |
| full workspace | 47 files, 1228 tests pass |
