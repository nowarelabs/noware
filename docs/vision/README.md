# Vision: Architecture-as-Contract for Codegen Agents

Planning documents for turning `@nowarelabs/cfour` + `@nowarelabs/workspace-do` into the
foundation of an agent-driven product suite. The C4 architecture model is the single
source of truth; AI agents claim, edit, propose, branch, and merge against it under
crash-safe leases, and codegen flows out of it.

Read order: `01-motivation.md` → `02-package-conventions.md` → per-package specs
(`03`-`07`) → `08-ordered-work.md` (the implementation plan future sessions follow).

## North Star

**`05-project-company-builder/`** — One person describes a company. The system builds
everything. Each "employee" is a full system: API endpoint + DB + business logic +
integrations. Not an LLM wrapper. A real, operational system built from a thought.

## Projects

| Directory                            | What it is                                                       | Status                   |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------------ |
| `01-project-gen-diesel/`             | cfour extraction, workspace-do, agents, merge-review, gen-diesel | ✅ Complete (Phases 1-7) |
| `02-project-orchestrator-migration/` | Migrate orchestrator to full @nowarelabs stack                   | ✅ Complete              |
| `03-project-entropy-gate/`           | Validation layer between agents (anti-hallucination)             | ✅ Complete              |
| `04-project-stigmergic-agents/`      | Stigmergic architecture: atom DOs, agent DOs, pheromone signals  | ✅ Complete              |
| `05-project-company-builder/`        | North star: describe company → system builds everything          | ✅ Complete              |

## Index (01-project-gen-diesel)

| File                        | What it is                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `01-motivation.md`          | Why we are doing this — product vision, review findings, the layering decision, the Cloudflare constraint. |
| `02-package-conventions.md` | The exact package scaffold + tooling conventions all packages must follow.                                 |
| `03-cfour-spec.md`          | cfour: what stays, what moves out, what gets added. Pure domain only.                                      |
| `04-workspace-do-spec.md`   | workspace-do: durability + RPC additions only.                                                             |
| `05-gen-diesel-spec.md`     | `@nowarelabs/gen-diesel`: the new codegen / "generative DSL" package.                                      |
| `06-agents-spec.md`         | `@nowarelabs/agents`: multi-agent orchestration + crash-safe leases.                                       |
| `07-merge-review-spec.md`   | `@nowarelabs/merge-review`: review/approval + CI pipeline.                                                 |
| `08-ordered-work.md`        | The master work list, in order, with acceptance criteria per phase.                                        |

## Decisions in one screen

1. **cfour = pure C4 domain.** No DO concepts, no RPC, no file IO, no node builtins.
2. **workspace-do = durability + RPC.** Only things that need SQLite persistence or the DO
   lifecycle.
3. **Codegen moves out of cfour into `@nowarelabs/gen-diesel`.** The generator pipeline,
   `register`, `addBuildingBlock`, and their file/crypto code are not domain logic — and
   they are the reason cfour currently imports `node:crypto` / `node:fs/promises`, which
   breaks the "runs on Cloudflare" rule.
4. **Agent orchestration lives in `@nowarelabs/agents`; review/CI lives in
   `@nowarelabs/merge-review`.** Both compose cfour + workspace-do.
5. **Everything must run on Cloudflare Workers.** No node builtins in `src/` of any package
   core. Node-only adapters live behind subpath exports (e.g. `@nowarelabs/gen-diesel/node`).
6. **No regressions.** Every behavior covered today (139 cfour + 18 workspace-do tests) stays
   covered — tests move with their code, never get deleted.

## Philosophical concepts → Implementation gap

These concepts are described in the motivation docs but not yet in the implementation plans:

| Concept                         | Described in                                    | Needs                                       |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Artifact storage                | 04-project/01-motivation.md (Principle 7)       | Separate storage entity for code artifacts  |
| Crash recovery                  | 04-project/01-motivation.md (Principle 7)       | Agent DO restart mechanism                  |
| System-wide consistency         | 04-project/01-motivation.md (Principle 6)       | Cross-atom consistency checking             |
| Cascade completion verification | 04-project/01-motivation.md (Principle 2)       | Verification that signal reached all levels |
| Concurrency control             | 04-project/01-motivation.md (Why simpler)       | Scheduling, resource limits                 |
| Scaling mechanism               | 04-project/01-motivation.md (Why more powerful) | Auto-scaling, load distribution             |
| Company → cfour model           | 05-project/01-motivation.md                     | Natural language parser                     |
| Employee = full system          | 05-project/01-motivation.md                     | System builder (Layer 2)                    |
| Self-healing                    | 05-project/01-motivation.md                     | Automatic recovery mechanisms               |
