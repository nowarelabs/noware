# 04 — Stigmergic Agent Architecture: Ordered Work

Implementation phases. Every phase ends with `vp check` + `vp test` green.

**Strategy:** Hybrid — extend existing packages for most concepts, new packages for
entropy gate and pattern catalog.

## Phase 1 — D1 schema + types (extended packages)

Goal: Add stigmergic tables to existing packages.

1. Add D1 schema to `@nowarelabs/durable-objects`:
   - `orchestrators` table (id, level, element_id, parent_id, child_ids, current_model,
     last_pheromone_check, diffs_processed, created_at, updated_at)
   - `atoms` table (id, cfour_element_id, atom_type, content, language, file_path,
     parent_component_id, relationships, assigned_pattern, status, agent_do_id,
     created_at, updated_at)
   - `atom_versions` table (id, atom_id, content, agent_do_id, timestamp,
     pheromone_events, cfour_validation, pattern_compliance, archived)
   - `agent_actions` table (id, agent_do_id, type, atom_id, timestamp, result, details)
2. Add pheromone schema to `@nowarelabs/events`:
   - `pheromone_events` table (id, type, element_id, level, agent_do_id, timestamp,
     cfour_diff, metadata, consumed_by)
3. Add claim/branch/merge schema to `@nowarelabs/cfour`:
   - `claims` table (id, atom_id, agent_do_id, status, acquired_at, expires_at,
     released_at, acquisitions)
   - `branches` table (id, atom_id, agent_do_id, content, base_version_id, status,
     created_at, updated_at, versions)
   - `merges` table (id, atom_id, source_branch_id, target_branch_id, status,
     created_at, merged_at, conflicts, resolution)
4. Add stigmergic types to `@nowarelabs/shared`:
   - `OrchestratorState`, `CfourDiff`, `AtomState`, `AtomVersion`
   - `AgentState`, `AgentAction`, `PheromoneEvent`
   - `ClaimState`, `ClaimAcquisition`
   - `BranchState`, `BranchVersion`
   - `MergeState`, `MergeConflict`, `MergeResolution`
5. `vp check` + `vp test` green.

## Phase 2 — Pattern catalog (new package)

Goal: Create the fixed pattern catalog.

1. Create `packages/pattern-catalog/` package (pure variant).
2. Create `src/architectural-patterns.ts`:
   - `mvc` — Model-View-Controller spec
   - `clean` — Clean Architecture spec (UseCase/Controller/Presenter)
   - `ddd` — Domain-Driven Design spec (Entity/ValueObject/Aggregate/Repository)
   - `event-driven` — Event-Driven spec (Event/Handler/Bus)
   - `onion` — Onion Architecture spec (Domain/Application/Infrastructure)
   - Each pattern: name, description, constraints, requiredElements, allowedRelationships
3. Create `src/coding-patterns.ts`:
   - All Refactoring Guru patterns (creational, structural, behavioral)
   - Each pattern: name, description, constraints, requiredInterfaces, requiredMethods
4. Create `src/pattern-catalog.ts`:
   - `PATTERN_CATALOG` — combined catalog of all patterns
   - `getPattern(name)` — look up pattern by name
   - `validatePattern(code, pattern)` — check if code matches pattern constraints
5. Create `tests/pattern-catalog.test.ts`:
   - Pattern catalog is complete
   - Pattern lookup works
   - Pattern validation works
6. `vp check` + `vp test` green.

## Phase 3 — Orchestrator DO (extended `@nowarelabs/durable-objects`)

Goal: Implement the hierarchical orchestrator system.

1. Add `OrchestratorDO` class to `@nowarelabs/durable-objects`:
   - `run()` — main loop (read model → read parent diffs → process → cascade → release)
   - `processDiffs(parentDiffs, model)` — decide what changes at my level
   - `applyChanges(diffs)` — apply changes to my level
   - `cascadeToChildren(diffs)` — send cfour diffs to child orchestrators
   - `receiveDiffs(diffs)` — receive cfour diffs from parent
   - `releasePheromones(diffs)` — emit pheromone events
2. Add orchestrator hierarchy to `@nowarelabs/agent-runtime`:
   - `OrchestratorHierarchy` class — manages root → SS → Container → Component
   - `CascadeLogic` class — decides what cascades to children
3. Create `tests/orchestrator-do.test.ts`:
   - Main loop execution
   - Diff processing logic
   - Cascading to children
   - Receiving from parent
   - Pheromone release
4. `vp check` + `vp test` green.

## Phase 4 — Atom DO (extended `@nowarelabs/durable-objects`)

Goal: Implement the atom DO with full state and history.

1. Add `AtomDO` class to `@nowarelabs/durable-objects`:
   - `get()` — read current state
   - `update(state)` — update atom state
   - `addVersion(version)` — add to version history
   - `getNeighbors()` — read adjacent atoms from relationships
   - `archiveVersions()` — archive versions after merge
2. Create `tests/atom-do.test.ts`:
   - CRUD operations
   - Version history management
   - Neighbor resolution
   - Archive after merge
3. `vp check` + `vp test` green.

## Phase 5 — Claim DO (extended `@nowarelabs/cfour`)

Goal: Implement claim system — only one agent touches an atom at a time.

1. Add `ClaimDO` class to `@nowarelabs/cfour`:
   - `acquire(agentDoId, ttl)` — claim an atom (fail if already claimed)
   - `release(agentDoId)` — release claim (only claimant can release)
   - `steal(agentDoId)` — force-release expired claim (crash recovery)
   - `isActive()` — check if claim is still valid
   - `extend(ttl)` — extend claim TTL
2. Create `tests/claim-do.test.ts`:
   - Successful acquisition
   - Rejected acquisition (already claimed)
   - Release by claimant
   - Rejected release (wrong agent)
   - Expiration and steal
   - TTL extension
3. `vp check` + `vp test` green.

## Phase 6 — Branch DO (extended `@nowarelabs/cfour`)

Goal: Implement branch system — agents can experiment on copies.

1. Add `BranchDO` class to `@nowarelabs/cfour`:
   - `create(atomDoId, agentDoId, baseVersion)` — create branch from version
   - `update(branchId, content)` — update branch content
   - `merge(branchId, targetBranchId?)` — merge branch into target
   - `abandon(branchId)` — abandon branch
   - `getConflicts(branchId, targetBranchId)` — detect merge conflicts
2. Create `tests/branch-do.test.ts`:
   - Branch creation from version
   - Branch updates
   - Clean merge (no conflicts)
   - Conflict detection
   - Abandonment
3. `vp check` + `vp test` green.

## Phase 7 — Merge DO (extended `@nowarelabs/merge-review`)

Goal: Implement merge system — reconcile divergent work.

1. Add `AtomMergeResolver` class to `@nowarelabs/merge-review`:
   - `create(atomId, sourceBranchId, targetBranchId?)` — create merge request
   - `autoMerge(mergeId)` — attempt automatic merge (no conflicts)
   - `manualMerge(mergeId, resolutions)` — merge with manual conflict resolution
   - `gateMerge(mergeId)` — merge through entropy gate validation
   - `reject(mergeId, reason)` — reject merge
2. Create `tests/atom-merge-resolver.test.ts`:
   - Auto merge (clean)
   - Manual merge (with resolutions)
   - Gate merge (validates through entropy gate)
   - Rejection
   - Conflict resolution strategies
3. `vp check` + `vp test` green.

## Phase 8 — Pheromone system (extended `@nowarelabs/events`)

Goal: Implement the pheromone event log and polling mechanism.

1. Add `PheromoneSignalEmitter` class to `@nowarelabs/events`:
   - `emit(event)` — create pheromone event
   - `poll(agentDoId, lastCheck)` — read unconsumed events
   - `consume(eventId, agentDoId)` — mark event as consumed
   - `emitOnWrite(atomDoId, agentDoId)` — auto-signal on atom modification
   - `emitCfourDiff(diff)` — signal from cfour diff
2. Create `tests/pheromone-signal.test.ts`:
   - Event creation
   - Polling with timestamp
   - Consumption tracking
   - Auto-signal on write
   - Cfour diff signaling
3. `vp check` + `vp test` green.

## Phase 9 — Agent DO core loop (extended `@nowarelabs/durable-objects`)

Goal: Implement the agent's main loop and local decision-making.

1. Add `AgentDO` class to `@nowarelabs/durable-objects`:
   - `run()` — main loop (read state → read contract → read neighbors → read signals → decide → execute)
   - `decide(atom, contract, neighbors, signals)` — local decision logic
   - `readCfourContract()` — load cfour model
   - `readNeighbors(relationshipIds)` — read adjacent atoms
   - `readPheromones()` — poll for signals
   - `execute(action)` — perform action
   - `leaveCue(action)` — emit pheromone after write
2. Create `tests/agent-do.test.ts`:
   - Core loop execution
   - Decision-making logic
   - Neighbor reading
   - Pheromone polling
   - Cue leaving
3. `vp check` + `vp test` green.

## Phase 10 — Entropy gate (new package)

Goal: Create the entropy gate validation layer.

1. Create `packages/entropy-gate/` package (pure variant).
2. Create `src/index.ts`:
   - `EntropyGate` class — validates before every write
   - `validateSchema(content)` — type/schema validation
   - `validatePattern(content, pattern)` — pattern compliance validation
   - `validateCfour(content, contract)` — cfour alignment validation
   - `handleRejection(decision, atomDo)` — update atom status to conflict
   - `handleAcceptance(decision, atomDo, content)` — write change + add version
3. Create `tests/entropy-gate.test.ts`:
   - Valid write passes all gates
   - Invalid schema triggers conflict
   - Pattern violation triggers conflict
   - Cfour misalignment triggers conflict
4. `vp check` + `vp test` green.

## Phase 11 — Bidding mechanism (hybrid with pheromones)

Goal: Add competitive bidding alongside pheromone signals.

1. Add bidding mechanism to `@nowarelabs/agent-runtime`:
   - `AuctionMechanism` class — selects highest bidder
   - `submitBid(bid)` — systems submit bids based on entity state
   - `selectWinner(entityId)` — select highest bidder
   - `execute(winner)` — execute winning system with capability access
2. Add bid evaluation to `@nowarelabs/durable-objects`:
   - `evaluateBids(entityId)` — evaluate all bids for an entity
   - `storeBid(bid)` — persist bid
   - `getBidsForEntity(entityId)` — retrieve bids
3. Create `tests/bidding-mechanism.test.ts`:
   - Bid submission
   - Condition evaluation
   - Winner selection
   - Execution with capabilities
4. `vp check` + `vp test` green.

## Phase 12 — Dynamic component definitions

Goal: Runtime component schema definitions.

1. Add component registry to `@nowarelabs/cfour`:
   - `ComponentRegistry` class — manages component definitions
   - `define(name, schema)` — define new component type at runtime
   - `update(name, schema)` — update existing component type
   - `validate(name, data)` — validate instance against schema
2. Add component instance management to `@nowarelabs/durable-objects`:
   - `ComponentInstance` class — typed data attached to entities
   - `attach(entityId, componentName, data)` — attach component to entity
   - `detach(entityId, componentName)` — remove component from entity
   - `getComponent(entityId, componentName)` — get component data
3. Create `tests/dynamic-components.test.ts`:
   - Component definition creation
   - Schema validation
   - Component instance attachment
   - Runtime schema evolution
4. `vp check` + `vp test` green.

## Phase 13 — General invariants

Goal: System-wide constraints that must hold true.

1. Add invariant system to `@nowarelabs/validators`:
   - `InvariantChecker` class — evaluates invariant expressions
   - `createInvariant(expression)` — create new invariant
   - `check(invariant)` — check if invariant holds
   - `checkAll()` — check all invariants
2. Add invariant enforcement to `@nowarelabs/entropy-gate`:
   - Check invariants after every write
   - Reject writes that would violate invariants
3. Create `tests/invariants.test.ts`:
   - Invariant creation
   - Invariant evaluation
   - Invariant violation detection
   - Invariant enforcement on writes
4. `vp check` + `vp test` green.

## Phase 14 — Capability-based security

Goal: Fine-grained access control for systems.

1. Add capability system to `@nowarelabs/agent-runtime`:
   - `CapabilityEnforcer` class — enforces read/write/execute access
   - `checkCapability(systemId, componentName, action)` — check access
   - `enforce(systemId, componentName, action)` — enforce or throw
2. Add capability definitions to system specifications:
   - Each system declares `capabilities: Capability[]`
   - Capabilities specify component + access level
3. Create `tests/capability-security.test.ts`:
   - Capability declaration
   - Access checking
   - Enforcement on actions
   - Violation errors
4. `vp check` + `vp test` green.

## Phase 15 — Hot-swappable systems

Goal: Deploy/update/remove systems without downtime.

1. Add system manager to `@nowarelabs/agent-runtime`:
   - `SystemManager` class — manages system lifecycle
   - `deploy(definition)` — deploy new system
   - `update(name, definition)` — update existing system
   - `remove(name)` — remove system
   - `hotSwap(name, definition)` — update without downtime
2. Add system persistence to `@nowarelabs/durable-objects`:
   - `systems` table — stores system definitions
   - System state tracking (running, stopped, updating)
3. Create `tests/hot-swap.test.ts`:
   - System deployment
   - System update
   - System removal
   - Hot-swap without downtime
   - Bid migration during hot-swap
4. `vp check` + `vp test` green.

## Phase 16 — cfour adapter (extended `@nowarelabs/cfour`)

Goal: Connect the stigmergic system to the cfour architecture model.

1. Add stigmergic adapter methods to `@nowarelabs/cfour`:
   - `loadModel(modelId)` — load cfour model
   - `getSoftwareSystems(modelId)` — extract SS elements
   - `getContainers(ssId)` — extract Container elements
   - `getComponents(containerId)` — extract Component elements
   - `getCodeElements(componentId)` — extract Code elements
   - `getRelationships(modelId)` — extract adjacency from relationships
   - `getDiff(oldModel, newModel)` — compute cfour diff
   - `validateAtom(atom, model)` — check atom matches cfour element
   - `validatePattern(atom, pattern)` — check atom follows assigned pattern
2. Create `tests/cfour-stigmergic-adapter.test.ts`:
   - Model loading
   - Element extraction at each level
   - Relationship extraction
   - Diff computation
   - Validation
3. `vp check` + `vp test` green.

## Phase 17 — Signal propagation integration

Goal: Wire up the cascading signal system end-to-end.

1. Add signal propagation to `@nowarelabs/agent-runtime`:
   - `propagateDiff(diff, rootOrchestrator)` — cascade diff through hierarchy
   - `processDiffAtLevel(diff, orchestrator)` — process diff at one level
   - `shouldCascadeToChildren(diff, level)` — decide if diff affects children
   - `createPheromoneFromDiff(diff)` — convert cfour diff to pheromone event
2. Create `tests/signal-propagation.test.ts`:
   - Diff cascades from root → SS → Container → Component → Code
   - Each level processes diff correctly
   - Some diffs don't cascade (level-specific changes)
   - Pheromone events created at each level
3. `vp check` + `vp test` green.

## Phase 18 — Integration test

Goal: End-to-end test with full hierarchy.

1. Create `tests/integration.test.ts`:
   - Create cfour model: 1 SS → 2 Containers → 4 Components → 8 Code elements
   - Create orchestrator DOs for each level
   - Create atom DOs + agent DOs for each Code element
   - Root changes SS description → cascade through all levels
   - Each level receives diff, updates state, cascades to children
   - Code agents receive diff, update their understanding
   - Entropy gate catches pattern violations
   - Claims enforce ownership (only one agent per atom)
   - Branches allow parallel experiments
   - Merges reconcile divergent work
   - Bidding mechanism selects winners at each level
   - Dynamic components are defined at runtime
   - Invariants are checked after every write
   - Capability security enforces access control
   - Hot-swap updates systems without downtime
   - All atoms eventually reach "merged" state
2. Full test suite green.
3. `vp check` + `vp test` green.

## Definition of done

- Extended packages have stigmergic functionality.
- `@nowarelabs/pattern-catalog` exists with fixed pattern catalog.
- `@nowarelabs/entropy-gate` exists with validation layer.
- Orchestrator DOs cascade cfour diffs level by level.
- Atom DOs persist full state + history until merge.
- Claim DOs enforce ownership (one agent per atom).
- Branch DOs allow parallel experiments.
- Merge DOs reconcile divergent work.
- Agent DOs run core loop: read → decide → execute → leave cue.
- Bidding mechanism selects winners at each level.
- Dynamic component definitions work at runtime.
- General invariants enforce system-wide constraints.
- Capability-based security enforces access control.
- Hot-swappable systems deploy/update without downtime.
- Entropy gate validates schema, pattern compliance, and cfour alignment.
- Cfour adapter connects to architecture model.
- Signal propagation cascades from root through entire hierarchy.
- Integration test shows full hierarchy converging.
- `vp check` + `vp test` green.
