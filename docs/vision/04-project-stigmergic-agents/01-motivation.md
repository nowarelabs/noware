# 04 — Stigmergic Agent Architecture

## The beehive insight

There is no foreman, general contractor, or master architect inside a beehive. The queen
bee lays eggs and releases pheromones to maintain hive cohesion, but she plays zero role
in directing construction. Hive assembly relies on emergent behavior through stigmergy — a
decentralized process where individual worker bees react locally to structural cues left by
the bees before them.

A worker bee does not hold a blueprint of the final comb. She uses her antennae to feel the
immediate shape of adjacent wax and deposits new wax wherever a wall is uneven or
incomplete. She measures cell wall thickness (0.07mm) by pressing her mandibles against the
wax. She aligns vertical comb parallel to gravity using microscopic hair plates.

The hexagonal perfection isn't planned — it's what happens when you apply physics to
circles. Bees start with cylinders. Surface tension snaps them into hexagons. The geometry
emerges from local constraints, not global design.

## Translation to software

The current orchestrator model is a foreman:

```
Orchestrator → "Do X" → Agent → "Done" → Orchestrator → "Do Y" → Agent
              (command)          (report)            (command)          (report)
```

The stigmergic model is a beehive — but with hierarchy. Like a tree: roots, trunk,
branches, leaves. Each level has its own orchestrator that reads local state and cascades
signals downward.

```
Root Orchestrator (above all Software Systems)
  │
  ├── SS Orchestrator (one per Software System)
  │     │
  │     ├── Container Orchestrator (one per Container)
  │     │     │
  │     │     ├── Component Orchestrator (one per Component)
  │     │     │     │
  │     │     │     └── Code Agent (one per function/method)
  │     │     │
  │     │     └── Component Orchestrator
  │     │           └── Code Agent
  │     │
  │     └── Container Orchestrator
  │           └── Component Orchestrator
  │                 └── Code Agent
  │
  └── SS Orchestrator
        └── ...
```

## The seven principles

### 1. Hierarchical stigmergy

The system is a tree, not a flat network. Each level has its own orchestrator:

- **Root Orchestrator** — owns all Software Systems, manages cross-system concerns
- **SS Orchestrator** — owns one Software System, manages its Containers
- **Container Orchestrator** — owns one Container, manages its Components
- **Component Orchestrator** — owns one Component, manages its Code elements
- **Code Agent** — owns one function/method, does the actual work

Each orchestrator reads its own level's state and cascades signals downward. The root
doesn't tell code agents what to do — it tells SS orchestrators what changed. SS
orchestrators tell container orchestrators. Container orchestrators tell component
orchestrators. Component orchestrators tell code agents.

### 2. Signals cascade down

When a description changes at any level, the signal propagates level by level:

```
Root changes SS description: "mpesa api" → "flutterwave api"
  ↓
SS Orchestrator receives cfour diff
  ↓
SS Orchestrator updates its own state
  ↓
SS Orchestrator cascades to Container Orchestrators
  ↓
Each Container Orchestrator updates its state
  ↓
Each Container Orchestrator cascades to Component Orchestrators
  ↓
Each Component Orchestrator updates its state
  ↓
Each Component Orchestrator cascades to Code Agents
  ↓
Each Code Agent updates its understanding of what it's building
```

The signal is a cfour diff — a before/after snapshot of what changed. Each level reads
the diff and decides what needs to change at its level.

### 3. cfour as physics

In a beehive, surface tension and gravity constrain what shapes can emerge. In this
system, cfour IS that physics:

- **Elements** define what atoms exist (you can't build what isn't in the model)
- **Relationships** define adjacency (agent A knows which atoms are neighbors)
- **Claims** enforce ownership (only one agent touches an atom at a time)
- **Branches** allow parallel experiments (like bees building comb in different directions)
- **Merges** reconcile (like surface tension snapping circles into hexagons)

The codebase perfection isn't planned — it's what happens when you apply cfour constraints
to atoms.

### 4. The cfour model as pheromone medium

The cfour model itself is the pheromone layer. Changes to descriptions, relationships,
or structure ARE the signals. When the root orchestrator changes a Software System's
description, that change is visible to all descendants through the cfour model.

The cfour model is not just a contract — it's a living communication channel. Every
modification to the model is a pheromone signal that cascades through the hierarchy.

### 5. Pattern framework (finite, constrained)

The @nowarelabs framework offers a fixed catalog of architectural patterns and coding
patterns. These are the "physics" that constrain what can emerge:

**Architectural patterns:**

- MVC (Model-View-Controller)
- Clean Architecture
- Domain-Driven Design (DDD)
- Event-Driven Architecture
- Onion Architecture

**Coding patterns (Refactoring Guru):**

- Creational: Factory, Abstract Factory, Builder, Prototype, Singleton
- Structural: Adapter, Bridge, Composite, Decorator, Facade, Proxy
- Behavioral: Chain of Responsibility, Command, Iterator, Mediator, Observer, Strategy

The cfour model encodes which patterns apply. A Container might specify "Clean Architecture"
— meaning its Components must follow the UseCase/Controller/Presenter structure. A Component
might specify "Observer" — meaning its Code elements must implement the observer interface.

Patterns are not suggestions. They are constraints enforced by the entropy gate. Code that
doesn't match its pattern is rejected.

### 6. Entropy gate as surface tension

The entropy gate doesn't direct — it constrains. It checks:

- **Schema**: Does the code match the expected types?
- **Pattern compliance**: Does the code follow the assigned pattern?
- **Level consistency**: Does the code's pattern match its parent's pattern?
- **Cfour alignment**: Does the code implement what the cfour model says it should?

Invalid changes can't propagate, just like soap bubbles can't stay circular when packed
tight. When code doesn't match its pattern, the gate rejects it and the agent retries.

### 7. Atom as the smallest unit

The atom is a C4 Code element: a function, method, or statement. It's the smallest
assignable unit of work. Each atom gets:

- An **Atom DO** — persists state, history, neighbor relationships
- An **Agent DO** — the worker, paired 1:1 with the atom
- **Artifact storage** — the actual code

Atom DO and Agent DO are created and destroyed together. When the atom is merged, the
agent DO is archived. When the atom is deleted, both DOs die.

### 8. Local feedback loops

Each agent works on one atom. It reads:

- Its atom's current state (code, metadata, history)
- The cfour contract (what the atom should be, what pattern it follows)
- Neighbor atoms (what adjacent atoms are doing)
- Pheromone signals (what the system needs, what changed above)

It writes:

- Updated atom code
- Version history entry
- Pheromone cue (auto on write + explicit)

The agent never needs to understand the whole system — only its atom, its pattern, and
immediate neighbors. This is how a bee builds comb without knowing what a hexagon is.

## Why this is simpler AND more powerful

**Simpler because:**

- Each agent has one job: read local state, do the work, leave a cue
- No complex task queues, no dispatch logic, no centralized planning
- The cfour contract IS the blueprint — agents don't need to "understand" the whole system
- Crash recovery is trivial: atom DO survives, agent DO restarts, reads local state, resumes
- Patterns are pre-defined — agents don't invent architecture, they follow it

**More powerful because:**

- Natural parallelism — 100 atoms = 100 agents working simultaneously
- No bottleneck at the orchestrator — it just releases pheromones
- The codebase shape emerges from the atoms themselves
- Scale is linear — more atoms = more parallelism, no coordination overhead
- Pattern enforcement means consistent architecture across the whole system
- Hierarchical signals mean a single change cascades correctly through all levels

## The stigmergic loop

```
1. Agent reads atom's local state (what's here now?)
2. Agent reads cfour contract (what should be here? what pattern?)
3. Agent reads neighbor atoms (what are adjacent atoms doing?)
4. Agent reads pheromone signals (what changed above?)
5. Agent makes local change (writes code following pattern, leaves cue)
6. Cue becomes visible to neighboring agents (poll-based)
7. Next agent reads the updated state → repeats
```

## Design decisions

| Decision            | Choice                                   | Rationale                                                    |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Pheromone mechanism | Poll-based (D1 events log)               | Simple, durable, no push infrastructure needed               |
| Signal format       | Cfour diff (before/after model)          | Structured, machine-readable, carries full context           |
| Signal propagation  | Cascading down (parent → children)       | Level-by-level, each orchestrator decides what to change     |
| Atom granularity    | C4 Code element (function/method)        | Smallest assignable unit, maps directly to cfour model       |
| Agent DO lifecycle  | Persistent                               | Lives as long as the atom, survives crashes                  |
| Orchestrator tree   | Root → SS → Container → Component → Code | Mirrors C4 hierarchy, one orchestrator per level per element |
| Orchestrator power  | Pure pheromone                           | Never overrides local decisions, just signals                |
| Pattern authority   | Framework-owned (fixed catalog)          | @nowarelabs defines patterns, cfour model references them    |
| Pattern enforcement | Entropy gate checks compliance           | Code that doesn't match pattern is rejected                  |
| Conflict resolution | Entropy gate rejects                     | Physics resolves conflicts, no tiebreaker needed             |
| Atom DO state       | Full state + history                     | Code, cfour metadata, neighbors, timestamps, version history |
| Pheromone triggers  | Both (auto + explicit)                   | Writes auto-signal, agents can also explicit-signal          |
| Version history     | Keep until merge                         | Archive after merge, bounded storage                         |
| Coordination        | Hybrid: pheromones + bidding             | Pheromones cascade, systems bid on what to act on            |
| Component schema    | Dynamic (runtime JSON schema)            | Components defined at runtime, validated against schemas     |
| System constraints  | General invariants                       | System-wide constraints that must hold true                  |
| Access control      | Capability-based (read/write/execute)    | Systems declare what they can access                         |
| System lifecycle    | Hot-swappable                            | Deploy/update systems without downtime                       |

## Adopted from rescrv/stigmergy

Five concepts adopted from the [rescrv/stigmergy](https://github.com/rescrv/stigmergy) project:

### 1. Bidding mechanism (hybrid with pheromones)

Pheromones cascade signals down the hierarchy. But within a level, systems bid on which
entity to act on next. The highest bidder wins.

```
Pheromones: Root → SS → Container → Component → Code (cascade)
Bidding:    System A bids 10 on Atom X
            System B bids 15 on Atom X
            → System B wins, acts on Atom X
```

This combines hierarchical signaling (pheromones) with competitive prioritization (bidding).

### 2. Dynamic component definitions (runtime schema)

Components are defined at runtime with JSON schemas, not compile-time types. This means
new component types can be added without recompiling the system.

```typescript
// Runtime definition
await defineComponent("game::Health", {
  type: "object",
  properties: {
    current: { type: "integer", minimum: 0 },
    maximum: { type: "integer", minimum: 1 },
  },
  required: ["current", "maximum"],
});
```

### 3. General invariants (system-wide constraints)

Invariants are expressions that must hold true across the system. They provide runtime
validation of system-wide constraints, not just per-atom validation.

```typescript
// Invariant: total health across all entities must be <= 1000
await createInvariant("sum(health.current) <= 1000");
```

### 4. Capability-based security (read/write/execute)

Systems explicitly declare what component types they can read, write, or execute. This
creates fine-grained access control.

```typescript
// System declares access requirements
{
  component_access: [
    { component: "game::Health", access: "read" },
    { component: "game::Position", access: "read+write" },
    { component: "game::Attack", access: "execute" },
  ],
}
```

### 5. Hot-swappable systems

Systems can be deployed, updated, and removed without downtime. New systems immediately
start evaluating bids against existing entities.

```typescript
// Deploy new system
await deploySystem("healing-aura", healingAuraMarkdown);

// Update existing system
await updateSystem("healing-aura", updatedMarkdown);

// Remove system
await removeSystem("healing-aura");
```
