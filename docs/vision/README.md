# Vision: Architecture-as-Contract for Codegen Agents

Planning documents for turning `@nowarelabs/cfour` + `@nowarelabs/workspace-do` into the
foundation of an agent-driven product suite. The C4 architecture model is the single
source of truth; AI agents claim, edit, propose, branch, and merge against it under
crash-safe leases, and codegen flows out of it.

Read order: `01-motivation.md` → `02-package-conventions.md` → per-package specs
(`03`-`07`) → `08-ordered-work.md` (the implementation plan future sessions follow).

## Projects

| Directory                            | What it is                                                       | Status                   |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------------ |
| `01-project-gen-diesel/`             | cfour extraction, workspace-do, agents, merge-review, gen-diesel | ✅ Complete (Phases 1-7) |
| `02-project-orchestrator-migration/` | Migrate orchestrator to full @nowarelabs stack                   | 📋 Planned               |
| `03-project-entropy-gate/`           | Validation layer between agents (anti-hallucination)             | 📋 Planned               |

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
