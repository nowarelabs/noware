# nomo/jobs

A unified, Rails-inspired background processing system for Cloudflare Workers. It provides a simple, class-based DSL for managing asynchronous tasks through Cloudflare Queues and stateful workflows through Cloudflare Workflows.

## Installation

```bash
pnpm add nomo/jobs
```

---

## 1. Core Concept: `BaseJob`

All background units extend `BaseJob`. The `perform` method is where the actual work happens.

```typescript
import { BaseJob } from "nomo/jobs";

export class WelcomeEmailJob extends BaseJob<{ email: string }> {
  async perform(ctx: any) {
    // Send email logic...
  }
}
```

---

## 2. Job Types

### 2.1. `QueueJob` (Asynchronous Tasks)

Uses Cloudflare Queues for standard single-pass background work.

```typescript
import { QueueJob } from "nomo/jobs";

export class ProcessDataJob extends QueueJob {
  // ... implement perform
}

// Dispatching:
await ProcessDataJob.performLater(env.QUEUE, { id: 123 });
```

### 2.2. `WorkflowJob` (Stateful Workflows)

Uses Cloudflare Workflows for complex, multi-step processes that require sleep, retries, and state persistence.

```typescript
import { WorkflowJob } from "nomo/jobs";

export class OnboardingWorkflow extends WorkflowJob {
  async perform(ctx: any) {
    await this.step("send-welcome", async () => { ... }, ctx);
    await this.sleep(86400, ctx); // Wait 1 day
    await this.step("send-followup", async () => { ... }, ctx);
  }
}

// Dispatching:
await OnboardingWorkflow.performLater(env.WORKFLOW, { userId: 1 });
```

---

## 3. The `JobDispatcher`

The `JobDispatcher` is the glue that runs your jobs when an event (Queue message or Workflow trigger) arrives at your Worker.

```typescript
// worker.ts
import { JobDispatcher } from "nomo/jobs";

const dispatcher = new JobDispatcher([WelcomeEmailJob, OnboardingWorkflow]);

export default {
  async queue(batch, env, ctx) {
    await dispatcher.handleQueue(batch, env, ctx);
  },
  // ... same for workflow
};
```

---

## 4. Key Methods

- **`performLater(driver, params)`**: Dispatches the job to the background.
- **`performNow(params)`**: Executes the job immediately (blocking).
- **`step(name, callback, ctx)`**: (Workflow only) Wraps a logic block as an atomic, retryable step.
- **`sleep(seconds, ctx)`**: (Workflow only) Pauses the workflow instance.

---

## License

MIT
