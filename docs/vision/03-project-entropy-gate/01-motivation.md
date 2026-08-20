# 03 — Entropy Gate

## The problem

Multi-agent systems suffer from cross-contamination: one agent's hallucination propagates
to others through shared state, unvalidated inputs, and blind trust. In a system with 64
parallel Claude workers, this caused 41% unanimous agreement on wrong answers and a 34%
hallucination rate.

Our flax orchestrator has the same vulnerabilities:

1. **No validation between agents** — the orchestrator dispatches tasks to downstream agents
   with arbitrary attributes (branch names, repo paths, ticket IDs) that are never validated.

2. **Unchecked response casts** — `dispatch-agent.ts:95` does `(await response.json()) as unknown`
   with zero schema validation on what the target agent returned.

3. **Unvalidated attribute passthrough** — `...data.attributes` spreads arbitrary key-value
   pairs from the orchestrator LLM through to downstream agents.

4. **No stage ordering enforcement** — the orchestrator can jump from "requirements" to
   "release" and D1 records it happily.

5. **Shared conversation contamination** — all agents operate on the same conversationId.
   Agent A's hallucinated finding enters the conversation and becomes "truth" for Agent B.

## Why now

The entropy gate is the missing layer between dispatch and execution. Without it, every
agent-to-agent communication is a potential contamination vector. Building it after the
orchestrator migration means we can integrate it directly into the Port/Gateway layer.

## What we're building

An entropy gate that sits between `Port.execute()` and `Gateway.execute()`, validating
every cross-agent data flow:

```
Agent LLM → Tool → Port → [Entropy Gate] → Gateway → External
                          ↑
                     Validates:
                     - Schema (types correct)
                     - Semantics (values make sense)
                     - Ordering (stages follow sequence)
                     - Provenance (source tracked)
                     - Consistency (no contradictions)
```

## The five gates

### 1. Schema Gate (types)

Validates that data matches expected types and shapes. Uses valibot schemas.

- Agent names must be in the known set
- Branch names must match git branch patterns
- Repo names must match `org/repo` format
- Conversation IDs must be valid UUIDs

### 2. Semantic Gate (values)

Validates that values make sense in context.

- Branch names shouldn't contain hallucinated paths
- Task descriptions shouldn't reference nonexistent files
- Stage names must be valid pipeline stages
- Attribute values must be non-empty strings

### 3. Ordering Gate (sequence)

Enforces pipeline stage ordering.

- Stages must follow: requirements → architecture → coding → review → qa → release
- No backward transitions without explicit override
- Concurrent stage limits (e.g., only 1 coding agent at a time)

### 4. Provenance Gate (tracking)

Tracks where data came from.

- Every cross-agent message carries `sourceAgent` + `sourceTimestamp`
- Hallucination detection: if Agent A's output contradicts Agent B's, flag it
- Audit trail for debugging contamination chains

### 5. Consistency Gate (contradictions)

Detects when agents contradict each other.

- If Agent A says "login page exists" and Agent B says "login page doesn't exist", flag it
- If the orchestrator dispatches conflicting tasks, flag it
- Circuit breaker: if contamination threshold is exceeded, pause pipeline

## Scope

- Entropy gate as a new package: `@nowarelabs/entropy-gate`
- Integration into orchestrator's Port/Gateway layer
- Unit tests for each gate
- Integration test: inject hallucination → gate catches it

## Out of scope (for now)

- LLM-level hallucination detection (separate project)
- Dashboard visualization of gate decisions
- Machine learning-based consistency detection
