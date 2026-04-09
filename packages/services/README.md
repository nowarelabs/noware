# nomo/services

The business logic orchestration layer for nomo applications. Services provide a centralized location for complex domain logic, coordinating between models, external APIs, and background jobs.

## Installation

```bash
pnpm add nomo/services
```

---

## 1. Philosophy

In the nomo architecture, Controllers handle request/response flow while Models handle data persistence. **Services** bridge the gap, containing the "brain" of your application.

Rules of Thumb:

- Controllers should be "skinny": Extract logic to services.
- Models should be "skinny": Focus on data integrity and lifecycle.
- Services are "FAT": They orchestrate the meaningful work.

---

## 2. Using `BaseService`

Extend `BaseService` to create a new business logic unit. Services have access to the Cloudflare `env` and can be easily injected into controllers or jobs.

```typescript
import { BaseService } from "nomo/services";
import { Account } from "nomo/models";

export class RegistrationService extends BaseService {
  async register(params: any) {
    const account = new Account(this.env.DB);
    const user = await account.create(params);

    // Additional logic: analytics, background jobs, etc.
    return user;
  }
}
```

---

## 3. Integration with Controllers

Services are typically instantiated and passed to controllers within the routing layer or a registry.

```typescript
// router.ts
const authService = new AuthService(env);
router.resources("accounts", AccountsController, authService);

// AccountsController.ts
export class AccountsController extends BaseController {
  async create() {
    // Accessible via this.service
    const result = await this.service.signUp(this.params);
    return this.render({ json: result });
  }
}
```

---

## 4. Best Practices

- **One Responsibility**: Create focused services (e.g., `BillingService`, `NotificationService`) rather than a single monolithic `AppService`.
- **Result-Oriented**: Services should ideally return `Result` types from `nomo/result` to ensure type-safe error handling at the controller level.
- **Environment Awareness**: Always use `this.env` to access bindings (DB, Queues, KV) instead of importing globals.

---

## License

MIT
