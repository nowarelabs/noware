# 05 — Company Builder: The North Star

## The vision

One person describes a company. The system builds everything.

Not just code. Not just APIs. Everything: the database, the business logic, the
integrations, the monitoring, the auth, the deployment. Each "employee" is a full system —
a running API endpoint with database, business logic, and integrations. Not an LLM wrapper.
A real, operational system built from a thought.

```
Person: "I want to build a payment processing company that handles mobile money
         transfers across East Africa, with KYC verification, fraud detection,
         and real-time notifications."

System: *generates cfour model*
        *spins up orchestrator hierarchy*
        *stigmergic agents build everything*
        *deploys running systems*

Result: 15 employees, each a full system:
        - Payment Gateway API (D1 + Hono + mobile money integrations)
        - KYC Verification Service (document verification + AML checks)
        - Fraud Detection Engine (rule-based + ML scoring)
        - Notification Service (SMS, email, push)
        - Compliance Reporter (regulatory reporting)
        - Customer Support Portal (ticketing + knowledge base)
        - Admin Dashboard (monitoring + management)
        - ... and 8 more
```

## Why this matters

Today, building a company requires:

- A CTO to design the architecture
- Engineers to build each system
- Months of work per system
- Ongoing maintenance and updates

With the company builder:

- One person describes the company
- The system generates the architecture
- Stigmergic agents build everything in parallel
- The system maintains itself

This isn't about replacing engineers. It's about making it possible for one person to
build what used to require a team of 20.

## The hierarchy

The cfour model becomes a company blueprint:

```
Company (Root Orchestrator)
  │
  ├── Department (Software System)
  │     │
  │     ├── Team (Container)
  │     │     │
  │     │     ├── Role (Component)
  │     │     │     │
  │     │     │     └── Task (Code element)
  │     │     │
  │     │     └── Role
  │     │           └── Task
  │     │
  │     └── Team
  │           └── Role
  │                 └── Task
  │
  └── Department
        └── ...
```

Each "employee" is a Container — a full, running system:

```
Employee: "Payment Gateway API"
  │
  ├── Database (D1)
  │     ├── accounts table
  │     ├── transactions table
  │     └── audit_log table
  │
  ├── Business Logic (Code elements)
  │     ├── processPayment()
  │     ├── validateTransaction()
  │     ├── generateReceipt()
  │     └── handleRefund()
  │
  ├── Integrations (Relationships)
  │     ├── M-Pesa API
  │     ├── Stripe API
  │     └── KYC Service
  │
  ├── Monitoring (Observability)
  │     ├── health checks
  │     ├── metrics
  │     └── alerting
  │
  └── Auth (Security)
        ├── API key management
        ├── rate limiting
        └── audit logging
```

## What makes this different from LLM code generation

Current LLM tools generate code snippets. This system generates **running systems**:

| Aspect      | LLM Code Generation   | Company Builder         |
| ----------- | --------------------- | ----------------------- |
| Output      | Code files            | Running systems         |
| Scope       | Single function/class | Full stack              |
| State       | Stateless             | Stateful (D1)           |
| Integration | None                  | APIs, webhooks, queues  |
| Monitoring  | None                  | Health, metrics, alerts |
| Auth        | None                  | API keys, rate limiting |
| Deployment  | Manual                | Automatic               |
| Maintenance | Manual                | Self-healing            |

## The three layers

### Layer 1: Codebase builder (current focus)

Builds individual codebases using stigmergic agents:

- Cfour model defines the architecture
- Atoms are code elements
- Agents build code following patterns
- Entropy gate ensures quality

**Status:** In design (04-project-stigmergic-agents)

### Layer 2: System builder (next)

Builds complete systems from codebases:

- Each Container becomes a deployable system
- D1 databases are provisioned
- Workers are deployed
- Integrations are configured
- Monitoring is set up

**Status:** Not started

### Layer 3: Company builder (north star)

Builds companies from descriptions:

- Person describes the company
- System generates the cfour model
- System builds all systems in parallel
- Systems are deployed and operational
- Systems maintain themselves

**Status:** Vision only

## The employee as a system

Each "employee" is not an LLM. It's a full system:

```
Employee: "Fraud Detection Engine"
  │
  ├── Input: transaction data
  ├── Processing: rule-based scoring + ML model
  ├── Output: risk score + recommendation
  ├── State: D1 database with fraud rules + history
  ├── Integrations: payment gateway, notification service
  ├── Monitoring: fraud rate, false positives, model accuracy
  └── Self-healing: automatically adjusts thresholds based on patterns
```

This employee:

- Never sleeps (always running)
- Never forgets (stateful database)
- Never makes the same mistake twice (learns from history)
- Never stops improving (self-healing)

## Why the stigmergic architecture enables this

The stigmergic architecture is the only architecture that can scale to company building:

1. **No central bottleneck** — 100 employees can be built simultaneously
2. **Local decisions** — each agent only needs to understand its own system
3. **Emergent structure** — the company structure emerges from the atoms
4. **Pattern enforcement** — consistent architecture across all systems
5. **Self-healing** — the system maintains itself through pheromone signals
6. **Crash recovery** — Durable Objects survive failures
7. **Parallel experiments** — branches allow trying different approaches

## What needs to exist before this is possible

### Must have (prerequisites)

- [ ] Stigmergic agent architecture (04-project-stigmergic-agents)
- [ ] Entropy gate for quality control (03-project-entropy-gate)
- [ ] Orchestrator migration to standard gauge (02-project-orchestrator-migration)
- [ ] Gen-diesel for code generation (01-project-gen-diesel)

### Should have (enablers)

- [ ] System builder (Layer 2)
- [ ] Deployment automation
- [ ] Monitoring and alerting
- [ ] Self-healing mechanisms

### Nice to have (accelerators)

- [ ] Company description parser (natural language → cfour model)
- [ ] Visual architecture editor
- [ ] Cost estimation
- [ ] Compliance checking

## Design decisions

| Decision             | Choice               | Rationale                           |
| -------------------- | -------------------- | ----------------------------------- |
| Company structure    | C4 hierarchy         | Maps naturally to company hierarchy |
| Employee = Container | Full system, not LLM | Operational, stateful, self-healing |
| Building approach    | Stigmergic           | Scales to 100+ parallel systems     |
| Quality control      | Entropy gate         | Ensures consistent architecture     |
| State management     | Durable Objects      | Crash-safe, persistent              |
| Database             | D1                   | Serverless, scales with demand      |
| Deployment           | Cloudflare Workers   | Global, fast, cheap                 |

## The end state

One person sits down and describes their company. Within hours, they have:

- 15 running systems, each a full employee
- D1 databases for each system
- API endpoints for integration
- Monitoring and alerting
- Auth and security
- Self-healing mechanisms

The person didn't write code. They described a vision. The system built it.

This is the north star. Everything else — orchestrator migration, entropy gate, stigmergic
agents — are steps toward this goal.
