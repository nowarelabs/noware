# 03 — Entropy Gate Spec

## Architecture

### Package structure

```
packages/entropy-gate/
  src/
    index.ts                    # Exports EntropyGate, all gate types
    gate.ts                     # Base EntropyGate class
    gates/
      schema.gate.ts            # Type/schema validation
      semantic.gate.ts          # Value validation
      ordering.gate.ts          # Stage ordering enforcement
      provenance.gate.ts        # Source tracking
      consistency.gate.ts       # Contradiction detection
    types.ts                    # GateResult, GateDecision, GateConfig
    config.ts                   # Default gate configurations
  tests/
    index.test.ts               # Unit tests
    integration.test.ts         # Integration test with orchestrator
```

### Base gate interface

```typescript
interface GateResult {
  pass: boolean;
  gate: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface GateDecision {
  allowed: boolean;
  gates: GateResult[];
  timestamp: number;
  sourceAgent?: string;
  targetAgent?: string;
}

class EntropyGate {
  constructor(config: GateConfig);
  async evaluate(input: unknown, context: GateContext): Promise<GateDecision>;
}
```

### Gate configuration

```typescript
interface GateConfig {
  schema?: boolean; // Enable schema gate (default: true)
  semantic?: boolean; // Enable semantic gate (default: true)
  ordering?: boolean; // Enable ordering gate (default: true)
  provenance?: boolean; // Enable provenance gate (default: true)
  consistency?: boolean; // Enable consistency gate (default: true)

  stageOrder?: string[]; // Allowed stage sequence
  maxConcurrent?: number; // Max concurrent agents per stage
  circuitBreaker?: {
    threshold: number; // Hallucination count to trigger
    cooldownMs: number; // How long to pause
  };
}
```

### Integration with Ports

The entropy gate wraps Port execution:

```typescript
// In a Gateway or Port
class DispatchAgentGateway implements IDispatchAgentPort {
  private gate = new EntropyGate(defaultConfig);

  async execute(input: DispatchAgentInput): Promise<UseCaseResult<DispatchAgentOutput>> {
    // 1. Evaluate through entropy gate
    const decision = await this.gate.evaluate(input, {
      sourceAgent: "orchestrator",
      targetAgent: input.agent,
      currentStage: input.stage,
    });

    if (!decision.allowed) {
      return {
        success: false,
        error: new Error(
          `Entropy gate rejected: ${decision.gates
            .filter((g) => !g.pass)
            .map((g) => g.reason)
            .join(", ")}`,
        ),
        status: "abandoned",
      };
    }

    // 2. Proceed with actual execution
    return this.callAgent(input);
  }
}
```

## Gate details

### 1. Schema Gate

Validates data types and shapes using valibot schemas.

```typescript
// Agent name validation
const agentNameSchema = v.picklist([
  "orchestrator",
  "coding",
  "code-review",
  "solutions-architect",
  "product-requirements",
  "business-data-analyst",
  "database-data-engineer",
  "ux-ui-designer",
  "security-appsec",
  "devops-cicd",
  "release-manager",
  "qa-test",
  "sre-observability",
  "documentation",
  "support-feedback",
  "support",
]);

// Branch name validation
const branchNameSchema = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9\-\/]*$/), v.maxLength(64));

// Repo name validation
const repoNameSchema = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$/));
```

### 2. Semantic Gate

Validates values make sense in context.

```typescript
// Task description validation
function validateTaskDescription(task: string): GateResult {
  if (task.length < 10) return { pass: false, gate: "semantic", reason: "Task too short" };
  if (task.length > 500) return { pass: false, gate: "semantic", reason: "Task too long" };
  if (/\b(implement|add|fix|create)\b/i.test(task)) return { pass: true, gate: "semantic" };
  return { pass: false, gate: "semantic", reason: "Task lacks action verb" };
}

// Attribute value validation
function validateAttributes(attrs: Record<string, string>): GateResult {
  for (const [key, value] of Object.entries(attrs)) {
    if (value.length === 0)
      return { pass: false, gate: "semantic", reason: `Empty value for ${key}` };
    if (value.length > 200)
      return { pass: false, gate: "semantic", reason: `Value too long for ${key}` };
  }
  return { pass: true, gate: "semantic" };
}
```

### 3. Ordering Gate

Enforces pipeline stage sequence.

```typescript
const DEFAULT_STAGE_ORDER = [
  "requirements",
  "architecture",
  "coding",
  "review",
  "qa",
  "release",
  "sre-docs",
];

function validateStageOrder(
  currentStage: string,
  nextStage: string,
  stageOrder: string[] = DEFAULT_STAGE_ORDER,
): GateResult {
  const currentIdx = stageOrder.indexOf(currentStage);
  const nextIdx = stageOrder.indexOf(nextStage);

  if (currentIdx === -1)
    return { pass: false, gate: "ordering", reason: `Unknown stage: ${currentStage}` };
  if (nextIdx === -1)
    return { pass: false, gate: "ordering", reason: `Unknown stage: ${nextStage}` };
  if (nextIdx <= currentIdx)
    return {
      pass: false,
      gate: "ordering",
      reason: `Backward transition: ${currentStage} → ${nextStage}`,
    };

  return { pass: true, gate: "ordering" };
}
```

### 4. Provenance Gate

Tracks data source and detects potential contamination.

```typescript
interface ProvenanceRecord {
  sourceAgent: string;
  timestamp: number;
  dataHash: string;
  parentHash?: string;
}

class ProvenanceTracker {
  private records: Map<string, ProvenanceRecord[]> = new Map();

  track(agent: string, data: unknown, parentHash?: string): string {
    const hash = this.hashData(data);
    const record = { sourceAgent: agent, timestamp: Date.now(), dataHash: hash, parentHash };
    const agentRecords = this.records.get(agent) ?? [];
    agentRecords.push(record);
    this.records.set(agent, agentRecords);
    return hash;
  }

  detectCycle(agent: string, dataHash: string): boolean {
    // Check if this agent has seen this data before (echo detection)
    const records = this.records.get(agent) ?? [];
    return records.some((r) => r.dataHash === dataHash);
  }
}
```

### 5. Consistency Gate

Detects contradictions between agents.

```typescript
interface Contradiction {
  agents: [string, string];
  claim: string;
  evidence: [unknown, unknown];
}

class ConsistencyChecker {
  private claims: Map<string, { agent: string; claim: string; timestamp: number }[]> = new Map();

  recordClaim(agent: string, claim: string): void {
    const claims = this.claims.get(claim) ?? [];
    claims.push({ agent, claim, timestamp: Date.now() });
    this.claims.set(claim, claims);
  }

  detectContradictions(): Contradiction[] {
    // Simple contradiction detection: same claim, different agents, different truth values
    // This is a placeholder — real implementation would use semantic analysis
    return [];
  }
}
```

## Test strategy

### Unit tests (per gate)

- **Schema Gate**: valid/invalid agent names, branch names, repo names
- **Semantic Gate**: task descriptions, attribute values
- **Ordering Gate**: forward transitions, backward transitions, unknown stages
- **Provenance Gate**: tracking, cycle detection
- **Consistency Gate**: contradiction detection

### Integration test

1. Create orchestrator with entropy gate enabled
2. Dispatch a task with invalid agent name → gate rejects
3. Dispatch a task with valid data → gate allows
4. Dispatch backward stage transition → gate rejects
5. Dispatch conflicting tasks → gate detects contradiction

### Test commands

```bash
cd packages/entropy-gate
vp test       # unit tests
vp check      # lint + format
```
