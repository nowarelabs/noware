# nomo/formatters

The presentation-layer transformation engine for nomo. Formatters take raw data (usually from models or services) and transform it into a UI-optimized structure or string, keeping your views and controllers clean.

## Installation

```bash
pnpm add nomo/formatters
```

---

## 1. Core Concept: `BaseFormatter`

Extend `BaseFormatter` to encapsulate presentation logic. This is ideal for things like "Full Name" construction, currency formatting, or date localization.

```typescript
import { BaseFormatter } from "nomo/formatters";

export class UserFormatter extends BaseFormatter {
  format() {
    return {
      fullName: `${this.data.firstName} ${this.data.lastName}`,
      joinedAt: new Date(this.data.createdAt).toLocaleDateString(),
      avatarUrl: this.data.avatar || "/default-avatar.png",
    };
  }
}
```

---

## 2. Usage

### 2.1. Direct Execution

```typescript
const formatted = new UserFormatter(userRecord).format();
// or
const formatted = UserFormatter.format(userRecord);
```

### 2.2. Controller Integration

You can use formatters in controller actions to prepare data for the view layer.

```typescript
async show() {
  const user = await this.service.findUser(this.pathParams.id);
  return this.render({
    view: UserShowView,
    json: UserFormatter.format(user)
  });
}
```

---

## 3. Why Use Formatters?

- **Reusability**: Use the same formatting logic in JSON API responses and JSX views.
- **Testability**: Presentation logic becomes easily unit-testable outside of an HTTP context.
- **Clean Slate**: Keep your Models focused on data/logic and your Views focused on structure/styling.

---

## License

MIT
