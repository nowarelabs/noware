# nomo/validators

A class-based validation layer for nomo applications, leveraging the power of [Zod](https://zod.dev/). `nomo/validators` allows you to define complex validation logic as reusable objects.

## Installation

```bash
pnpm add nomo/validators
```

---

## 1. Core Concept: `BaseValidator`

Extend `BaseValidator` to create a dedicated validator for a resource or action. You must define a `schema` using Zod.

```typescript
import { BaseValidator } from "nomo/validators";
import { z } from "zod";

export class UserRegistrationValidator extends BaseValidator {
  protected schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    age: z.number().optional(),
  });
}
```

---

## 2. Usage

### 2.1. Direct Execution

You can run validation manually using the `validate()` or `safeValidate()` methods.

```typescript
// Throws ZodError if invalid
const data = new UserRegistrationValidator(input).validate();

// Returns { success: true, data } or { success: false, error }
const result = new UserRegistrationValidator(input).safeValidate();
```

### 2.2. Static Helper

For quick, one-off validations.

```typescript
const data = UserRegistrationValidator.validate(input);
```

---

## 3. Framework Integration

Validators are a key part of the `nomo/controllers` semantic hook system.

```typescript
// UsersController.ts
static beforeActions = [
  { validate: UserRegistrationValidator, only: ['create'] }
];
```

When used this way, the controller automatically handles `ZodError` exceptions and returns a structured `400 Bad Request` response with the validation details.

---

## License

MIT
