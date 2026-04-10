# Jobs

Background job processing for asynchronous tasks.

## QueueJob

```typescript
import { QueueJob } from 'nomo/jobs';

export class SendEmailJob extends QueueJob<{ to: string; subject: string; body: string }> {
  static queue = 'emails';
  static retryLimit = 3;
  static timeout = 30;

  async perform() {
    await sendEmail(this.params.to, this.params.subject, this.params.body);
  }
}
```

## WorkflowJob

```typescript
import { WorkflowJob } from 'nomo/jobs';

export class UserOnboardingWorkflow extends WorkflowJob<{ userId: string; email: string }> {
  async perform(ctx) {
    await this.step('create_account', async () => {
      // Create account
    }, ctx);
    
    await this.sleep(5); // Wait 5 seconds
    
    await this.step('send_welcome', async () => {
      await sendEmail(ctx.params.email, 'Welcome!');
    }, ctx);
  }
}
```

## JobDispatcher

```typescript
import { JobDispatcher } from 'nomo/jobs';

const dispatcher = new JobDispatcher({
  emails: SendEmailJob,
  notifications: NotificationJob
});

// In worker
export default class AppWorker extends BaseWorker<Env> {
  dispatcher = dispatcher;
}
```

## Triggering Jobs

```typescript
// From controller
const runner = new JobRunner({ env: this.env, ctx: this.ctx });
await runner.enqueue('SendEmailJob', { to: 'user@example.com', subject: 'Hi!' });
```