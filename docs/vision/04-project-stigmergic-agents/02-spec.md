# 04 — Stigmergic Agent Architecture: Spec

## Package mapping

The stigmergic architecture extends existing @nowarelabs packages and adds two new ones.

### Extended packages

| Package                       | What gets added                             | Rationale                                                |
| ----------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `@nowarelabs/cfour`           | Atom-level branching, merging, claim TTL    | cfour already has branches/claims — extend to atom level |
| `@nowarelabs/durable-objects` | Atom DO, Agent DO, Orchestrator DO classes  | DO utilities already exist — add stigmergic-specific DOs |
| `@nowarelabs/events`          | Pheromone signal system (poll-based D1 log) | Event system already exists — add pheromone events       |
| `@nowarelabs/agent-runtime`   | Orchestrator hierarchy, cascade logic       | Agent runtime already manages agents — add hierarchy     |
| `@nowarelabs/validators`      | Schema validation, cfour alignment checks   | Validators already exist — add stigmergic validation     |
| `@nowarelabs/merge-review`    | Atom-level merge with conflict resolution   | Merge review already exists — add atom-level merging     |

### New packages

| Package                       | What it is                            | Why new                                       |
| ----------------------------- | ------------------------------------- | --------------------------------------------- |
| `@nowarelabs/entropy-gate`    | Pattern compliance + validation layer | Cross-cutting concern, used by all agents     |
| `@nowarelabs/pattern-catalog` | Fixed architectural + coding patterns | Standalone catalog, referenced by cfour model |

### Composition

```
@nowarelabs/cfour (extended)
  ├── Atom-level branching
  ├── Atom-level merging
  └── Claim TTL

@nowarelabs/durable-objects (extended)
  ├── AtomDO class
  ├── AgentDO class
  └── OrchestratorDO class

@nowarelabs/events (extended)
  └── PheromoneSignalEmitter class

@nowarelabs/agent-runtime (extended)
  ├── OrchestratorHierarchy class
  └── CascadeLogic class

@nowarelabs/validators (extended)
  └── SchemaValidator class

@nowarelabs/merge-review (extended)
  └── AtomMergeResolver class

@nowarelabs/entropy-gate (NEW)
  ├── EntropyGate class
  ├── PatternComplianceChecker
  └── CfourAlignmentChecker

@nowarelabs/pattern-catalog (NEW)
  ├── ArchitecturalPatterns (MVC, Clean, DDD, Event-Driven, Onion)
  ├── CodingPatterns (Refactoring Guru)
  └── PatternSpec types
```

## System architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Root Orchestrator DO                           │
│  • Owns all Software Systems                                     │
│  • Releases pheromone signals (cfour diffs)                      │
│  • Never directs construction                                    │
│  • Monitors system health across all levels                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ cfour diffs cascade down
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                   SS Orchestrator DO (one per Software System)   │
│  • Owns Containers within its Software System                    │
│  • Receives cfour diffs from Root                                │
│  • Decides what changes at Container level                       │
│  • Cascades signals to Container Orchestrators                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ cfour diffs cascade down
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│              Container Orchestrator DO (one per Container)       │
│  • Owns Components within its Container                          │
│  • Receives cfour diffs from SS Orchestrator                     │
│  • Decides what changes at Component level                       │
│  • Cascades signals to Component Orchestrators                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ cfour diffs cascade down
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│            Component Orchestrator DO (one per Component)         │
│  • Owns Code elements within its Component                       │
│  • Receives cfour diffs from Container Orchestrator              │
│  • Decides what changes at Code level                            │
│  • Cascades signals to Code Agents                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │ cfour diffs cascade down
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Code Agent DO (one per function/method)        │
│  • Owns one atom (C4 Code element)                               │
│  • Receives cfour diffs from Component Orchestrator              │
│  • Does the actual work (writes code following pattern)          │
│  • Leaves cues for neighboring atoms                             │
└─────────────────────────────────────────────────────────────────┘
```

## Core entities

### Orchestrator DO (hierarchical)

Each orchestrator DO manages its level of the C4 hierarchy.

```typescript
interface OrchestratorState {
  // Identity
  id: string;
  level: "root" | "ss" | "container" | "component";
  elementId: string; // C4 element this orchestrator owns

  // Hierarchy
  parentId?: string; // Parent orchestrator DO
  childOrchestratorIds: string[]; // Child orchestrator DOs

  // State
  currentModel: CfourModel; // Current cfour model snapshot
  lastPheromoneCheck: number;

  // History
  diffsProcessed: CfourDiff[];
  createdAt: number;
  updatedAt: number;
}

interface CfourDiff {
  id: string;
  level: "ss" | "container" | "component" | "code";
  elementId: string;
  changeType: "description" | "pattern" | "relationship" | "structure" | "add" | "remove";
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  sourceOrchestratorId: string; // Who created this diff
}
```

### Orchestrator DO methods

```typescript
class OrchestratorDO {
  // The main loop — runs continuously while element exists
  async run(): Promise<void> {
    while (true) {
      // 1. Read cfour model
      const model = await this.readCfourModel();

      // 2. Check for diffs from parent
      const parentDiffs = await this.readParentDiffs();

      // 3. Process diffs — decide what changes at my level
      const myDiffs = await this.processDiffs(parentDiffs, model);

      // 4. Apply changes to my level
      await this.applyChanges(myDiffs);

      // 5. Cascade to children
      await this.cascadeToChildren(myDiffs);

      // 6. Release pheromones for my level
      await this.releasePheromones(myDiffs);

      // 7. Wait before next iteration
      await this.wait(5000); // 5 second polling interval
    }
  }

  // Process parent diffs — decide what changes at my level
  private async processDiffs(parentDiffs: CfourDiff[], model: CfourModel): Promise<CfourDiff[]> {
    const myDiffs: CfourDiff[] = [];

    for (const diff of parentDiffs) {
      // Does this diff affect my level?
      if (this.affectsMyLevel(diff, model)) {
        // What needs to change at my level?
        const changes = await this.decideChanges(diff, model);
        myDiffs.push(...changes);
      }
    }

    return myDiffs;
  }

  // Cascade cfour diffs to child orchestrators
  private async cascadeToChildren(diffs: CfourDiff[]): Promise<void> {
    for (const childId of this.state.childOrchestratorIds) {
      const childOrchestrator = this.env.ORCHESTRATOR_DO.get(childId);
      await childOrchestrator.receiveDiffs(diffs);
    }
  }

  // Receive diffs from parent
  async receiveDiffs(diffs: CfourDiff[]): Promise<void> {
    this.state.diffsProcessed.push(...diffs);
    // The main loop will process these on next iteration
  }
}
```

### Atom DO

The atom is a C4 Code element — a function, method, or statement.

```typescript
interface AtomState {
  // Identity
  id: string;
  cfourElementId: string;
  atomType: "function" | "method" | "statement";

  // Code
  content: string;
  language: string;
  filePath: string;

  // cfour metadata
  parentComponentId: string;
  relationships: string[];

  // Pattern
  assignedPattern: CodingPattern; // From framework catalog

  // State
  status: "idle" | "working" | "review" | "merged" | "conflict";
  agentDoId: string;

  // History
  versions: AtomVersion[];
  createdAt: number;
  updatedAt: number;
}

interface AtomVersion {
  id: string;
  content: string;
  agentDoId: string;
  timestamp: number;
  pheromoneEvents: string[];
  cfourValidation: CfourValidationResult;
  patternCompliance: PatternComplianceResult; // Did it follow the pattern?
}
```

### Agent DO

The agent is the worker bee, paired 1:1 with an Atom DO.

```typescript
interface AgentState {
  // Identity
  id: string;
  atomDoId: string;
  agentType: string;

  // Context
  cfourContract: CfourModel;
  assignedPattern: CodingPattern; // From framework catalog
  neighborAtomIds: string[];

  // State
  status: "idle" | "reading" | "working" | "leaving-cue" | "waiting";
  lastPheromoneCheck: number;

  // History
  actions: AgentAction[];
  createdAt: number;
  updatedAt: number;
}

interface AgentAction {
  id: string;
  type: "read-atom" | "read-neighbor" | "write-atom" | "leave-cue" | "read-pheromone";
  atomDoId?: string;
  timestamp: number;
  result: "success" | "failure" | "skipped";
  details?: string;
}
```

### Pheromone Signal

Pheromone signals are cfour diffs in a D1 log that agents poll.

```typescript
interface PheromoneEvent {
  id: string;
  type:
    | "atom-needs-work"
    | "atom-ready"
    | "atom-conflict"
    | "atom-merged"
    | "atom-deleted"
    | "pattern-changed"
    | "description-changed"
    | "relationship-changed";
  atomDoId?: string;
  elementId: string; // C4 element this signal affects
  level: "ss" | "container" | "component" | "code";
  agentDoId?: string;
  timestamp: number;
  cfourDiff?: CfourDiff; // The actual change
  metadata?: Record<string, unknown>;
  consumedBy: string[];
}
```

### Claim DO

Claims enforce ownership — only one agent touches an atom at a time. Like a lock on a
cell in the beehive.

```typescript
interface ClaimState {
  // Identity
  id: string;
  atomDoId: string; // Which atom is claimed
  agentDoId: string; // Which agent holds the claim

  // State
  status: "active" | "released" | "expired" | "stolen";
  acquiredAt: number;
  expiresAt: number; // Claims expire after timeout (crash safety)
  releasedAt?: number;

  // History
  acquisitions: ClaimAcquisition[];
}

interface ClaimAcquisition {
  agentDoId: string;
  acquiredAt: number;
  releasedAt?: number;
  reason?: string; // Why released (completed, crashed, stolen)
}
```

### Branch DO

Branches allow parallel experiments — like bees building comb in different directions.
An agent can branch an atom to try a different approach without affecting the main line.

```typescript
interface BranchState {
  // Identity
  id: string;
  atomDoId: string; // Original atom
  agentDoId: string; // Who created this branch

  // Code
  content: string; // Branch's version of the code
  baseVersionId: string; // Version this branch was created from

  // State
  status: "active" | "merged" | "abandoned";
  createdAt: number;
  updatedAt: number;

  // History
  versions: BranchVersion[]; // Changes made on this branch
}

interface BranchVersion {
  id: string;
  content: string;
  agentDoId: string;
  timestamp: number;
  cfourValidation: CfourValidationResult;
  patternCompliance: PatternComplianceResult;
}
```

### Merge DO

Merges reconcile divergent work — like surface tension snapping circles into hexagons.
When branches diverge, the merge process reconciles them.

```typescript
interface MergeState {
  // Identity
  id: string;
  atomDoId: string; // Target atom
  sourceBranchId: string; // Branch being merged
  targetBranchId?: string; // Target branch (or main)

  // State
  status: "pending" | "auto" | "manual" | "conflict" | "merged" | "rejected";
  createdAt: number;
  mergedAt?: number;

  // Conflict resolution
  conflicts?: MergeConflict[];
  resolution?: MergeResolution;
}

interface MergeConflict {
  id: string;
  section: string; // Which part of the code conflicts
  sourceValue: string; // What the branch has
  targetValue: string; // What the target has
  agentDoId?: string; // Who resolves this conflict
}

interface MergeResolution {
  strategy: "auto" | "manual" | "gate";
  resolvedBy: string; // Agent or gate that resolved
  resolvedAt: number;
  details: string;
}
```

## Pattern framework

The @nowarelabs framework offers a fixed catalog of patterns. The cfour model references
these patterns. The entropy gate enforces them.

### Architectural patterns

```typescript
type ArchitecturalPattern =
  | "mvc" // Model-View-Controller
  | "clean" // Clean Architecture (UseCase/Controller/Presenter)
  | "ddd" // Domain-Driven Design (Entity/ValueObject/Aggregate/Repository)
  | "event-driven" // Event-Driven (Event/Handler/Bus)
  | "onion"; // Onion Architecture (Domain/Application/Infrastructure)

interface ArchitecturalPatternSpec {
  name: ArchitecturalPattern;
  description: string;
  constraints: PatternConstraint[];
  requiredElements: string[]; // What C4 elements must exist
  allowedRelationships: string[]; // What relationships are allowed
}
```

### Coding patterns

```typescript
type CodingPattern =
  // Creational
  | "factory"
  | "abstract-factory"
  | "builder"
  | "prototype"
  | "singleton"
  // Structural
  | "adapter"
  | "bridge"
  | "composite"
  | "decorator"
  | "facade"
  | "proxy"
  // Behavioral
  | "chain-of-responsibility"
  | "command"
  | "iterator"
  | "mediator"
  | "observer"
  | "strategy";

interface CodingPatternSpec {
  name: CodingPattern;
  description: string;
  constraints: PatternConstraint[];
  requiredInterfaces: string[]; // What interfaces must exist
  requiredMethods: string[]; // What methods must be implemented
}
```

### Pattern catalog (fixed in framework)

```typescript
const PATTERN_CATALOG: Record<CodingPattern, CodingPatternSpec> = {
  factory: {
    name: "factory",
    description: "Creates objects without specifying exact classes",
    constraints: [
      { type: "interface", name: "Creator", methods: ["factoryMethod"] },
      { type: "interface", name: "Product", methods: ["operation"] },
    ],
    requiredInterfaces: ["Creator", "Product"],
    requiredMethods: ["factoryMethod", "operation"],
  },
  observer: {
    name: "observer",
    description: "Defines subscription mechanism to notify multiple objects",
    constraints: [
      { type: "interface", name: "Subject", methods: ["attach", "detach", "notify"] },
      { type: "interface", name: "Observer", methods: ["update"] },
    ],
    requiredInterfaces: ["Subject", "Observer"],
    requiredMethods: ["attach", "detach", "notify", "update"],
  },
  // ... all Refactoring Guru patterns
};
```

### Pattern enforcement in cfour

The cfour model references patterns:

```typescript
// C4 Container specifies architectural pattern
interface Container {
  id: string;
  name: string;
  description: string;
  architecturalPattern: ArchitecturalPattern; // "clean", "ddd", etc.
  components: Component[];
}

// C4 Component specifies coding patterns
interface Component {
  id: string;
  name: string;
  description: string;
  codingPatterns: CodingPattern[]; // ["observer", "factory"]
  codeElements: CodeElement[];
}
```

## D1 schema

### orchestrators table

```sql
CREATE TABLE orchestrators (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('root', 'ss', 'container', 'component')),
  element_id TEXT NOT NULL,
  parent_id TEXT,
  child_ids TEXT NOT NULL DEFAULT '[]',
  current_model TEXT NOT NULL DEFAULT '{}',
  last_pheromone_check INTEGER NOT NULL DEFAULT 0,
  diffs_processed TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### atoms table

```sql
CREATE TABLE atoms (
  id TEXT PRIMARY KEY,
  cfour_element_id TEXT NOT NULL,
  atom_type TEXT NOT NULL CHECK (atom_type IN ('function', 'method', 'statement')),
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'typescript',
  file_path TEXT NOT NULL,
  parent_component_id TEXT NOT NULL,
  relationships TEXT NOT NULL DEFAULT '[]',
  assigned_pattern TEXT NOT NULL DEFAULT 'factory',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'review', 'merged', 'conflict')),
  agent_do_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### atom_versions table

```sql
CREATE TABLE atom_versions (
  id TEXT PRIMARY KEY,
  atom_id TEXT NOT NULL REFERENCES atoms(id),
  content TEXT NOT NULL,
  agent_do_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  pheromone_events TEXT NOT NULL DEFAULT '[]',
  cfour_validation TEXT NOT NULL DEFAULT '{}',
  pattern_compliance TEXT NOT NULL DEFAULT '{}',
  archived INTEGER NOT NULL DEFAULT 0
);
```

### agent_actions table

```sql
CREATE TABLE agent_actions (
  id TEXT PRIMARY KEY,
  agent_do_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('read-atom', 'read-neighbor', 'write-atom', 'leave-cue', 'read-pheromone')),
  atom_id TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'skipped')),
  details TEXT
);
```

### pheromone_events table

```sql
CREATE TABLE pheromone_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN (
    'atom-needs-work', 'atom-ready', 'atom-conflict', 'atom-merged', 'atom-deleted',
    'pattern-changed', 'description-changed', 'relationship-changed'
  )),
  element_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('ss', 'container', 'component', 'code')),
  agent_do_id TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  cfour_diff TEXT,
  metadata TEXT,
  consumed_by TEXT NOT NULL DEFAULT '[]'
);
```

### claims table

```sql
CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  atom_id TEXT NOT NULL REFERENCES atoms(id),
  agent_do_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'expired', 'stolen')),
  acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  released_at INTEGER,
  acquisitions TEXT NOT NULL DEFAULT '[]'
);
```

### branches table

```sql
CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  atom_id TEXT NOT NULL REFERENCES atoms(id),
  agent_do_id TEXT NOT NULL,
  content TEXT NOT NULL,
  base_version_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'abandoned')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  versions TEXT NOT NULL DEFAULT '[]'
);
```

### merges table

```sql
CREATE TABLE merges (
  id TEXT PRIMARY KEY,
  atom_id TEXT NOT NULL REFERENCES atoms(id),
  source_branch_id TEXT NOT NULL REFERENCES branches(id),
  target_branch_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'auto', 'manual', 'conflict', 'merged', 'rejected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  merged_at INTEGER,
  conflicts TEXT,
  resolution TEXT
);
```

## Entropy gate integration

The entropy gate sits between the agent and the atom DO, checking pattern compliance:

```typescript
private async execute(action: AgentAction): Promise<void> {
  if (action.type === "write-atom") {
    // 1. Schema validation
    const schemaResult = await this.entropyGate.validateSchema(action.newContent);
    if (!schemaResult.pass) {
      await this.reject(action, schemaResult.reason);
      return;
    }

    // 2. Pattern compliance validation
    const patternResult = await this.entropyGate.validatePattern(
      action.newContent,
      this.state.assignedPattern
    );
    if (!patternResult.pass) {
      await this.reject(action, patternResult.reason);
      return;
    }

    // 3. Cfour alignment validation
    const cfourResult = await this.entropyGate.validateCfour(
      action.newContent,
      this.state.cfourContract
    );
    if (!cfourResult.pass) {
      await this.reject(action, cfourResult.reason);
      return;
    }

    // 4. All gates passed — write the change
    await this.atomDo.update({
      content: action.newContent,
      status: "idle",
      updatedAt: Date.now()
    });

    // 5. Add version to history
    await this.atomDo.addVersion({
      content: action.newContent,
      agentDoId: this.state.id,
      timestamp: Date.now(),
      cfourValidation: cfourResult,
      patternCompliance: patternResult
    });
  }
}
```

## Signal propagation example

### Scenario: Rename Software System from "mpesa api" to "flutterwave api"

```
1. Root Orchestrator detects cfour model change:
   { level: "ss", elementId: "mpesa-api", changeType: "description",
     oldValue: "mpesa api", newValue: "flutterwave api" }

2. Root Orchestrator cascades to SS Orchestrator for "mpesa-api"

3. SS Orchestrator receives diff, updates its own description
   → Releases pheromone: "description-changed" for its element

4. SS Orchestrator cascades to Container Orchestrators:
   - "api-gateway" container
   - "payment-service" container
   - "notification-service" container

5. Each Container Orchestrator receives diff
   → Updates its understanding of what it's building
   → Releases pheromone: "description-changed" for its element
   → Cascades to Component Orchestrators

6. Each Component Orchestrator receives diff
   → Updates its understanding
   → Releases pheromone: "description-changed" for its element
   → Cascades to Code Agents

7. Each Code Agent receives diff
   → Updates its understanding of what it's building
   → If the rename affects its code, it works on updating
   → If not, it ignores the signal

Total: One change at root level cascades through the entire hierarchy.
Each level decides what needs to change at its level.
No central coordination needed.
```

## Test strategy

### Unit tests (per entity)

- **Orchestrator DO**: diff processing, cascading, pheromone release
- **Atom DO**: state management, version history, neighbor relationships
- **Agent DO**: core loop, decision-making, cue leaving
- **Pattern catalog**: pattern specs, constraint validation
- **Entropy gate**: pattern compliance checking

### Integration test

1. Create cfour model: 1 SS → 2 Containers → 4 Components → 8 Code elements
2. Create orchestrator DOs for each level
3. Create atom DOs + agent DOs for each Code element
4. Root changes SS description → cascade through all levels
5. Each level receives diff, updates state, cascades to children
6. Code agents receive diff, update their understanding
7. Entropy gate catches pattern violations

### Test commands

```bash
cd packages/stigmergic
vp test       # unit tests
vp check      # lint + format
```
