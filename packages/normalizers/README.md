# nomo/normalizers

A specialized layer for sanitizing and cleaning incoming data in nomo applications. Normalizers ensure that your models receive data in a consistent format (e.g., lowercase emails, trimmed strings) before validation or persistence.

## Installation

```bash
pnpm add nomo/normalizers
```

---

## 1. Core Concept: `BaseNormalizer`

Extend `BaseNormalizer` to define the "cleaning" logic for a specific data payload.

```typescript
import { BaseNormalizer } from "nomo/normalizers";

export class UserNormalizer extends BaseNormalizer {
  normalize() {
    return {
      ...this.data,
      email: this.data.email.trim().toLowerCase(),
      firstName: this.data.firstName.trim(),
      lastName: this.data.lastName.trim(),
    };
  }
}
```

---

## 2. Usage

### 2.1. Direct Execution

```typescript
const cleanData = new UserNormalizer(rawInput).normalize();
// or
const cleanData = UserNormalizer.normalize(rawInput);
```

### 2.2. Framework Integration

Normalizers work seamlessly with `nomo/controllers` semantic hooks to clean request bodies automatically.

```typescript
// UsersController.ts
static beforeActions = [
  { normalize: UserNormalizer, only: ['create', 'update'] }
];
```

By placing the normalizer before the validator in the `beforeActions` array, you guarantee that validation happens against clean, standardized data.

---

## 3. Best Practices

- **Idempotency**: `normalize()` should be idempotent; running it multiple times on the same data should produce the same result.
- **No Side Effects**: Normalizers should only transform data. They should not interact with databases or external APIs.
- **Narrow Focus**: Create specific normalizers for specific operations (e.g., `ProfileNormalizer`, `SearchQueryNormalizer`).

---

## License

MIT
