# nomo/controllers

An action-oriented controller framework for nomo applications. It introduces a Rails-inspired flow with lifecycle hooks, automated data processing, and a flexible rendering system.

## Installation

```bash
pnpm add nomo/controllers
```

---

## 1. Core Concepts

### 1.1. `BaseController`

All controllers must extend `BaseController`. It provides a structured environment for handling requests, interacting with services, and rendering responses.

```typescript
import { BaseController } from "nomo/controllers";

export class UsersController extends BaseController {
  async index() {
    const users = await this.service.listUsers();
    return this.render({ json: users });
  }
}
```

---

## 2. Lifecycle Hooks (`beforeAction` / `afterAction`)

Define hooks to run logic before or after specific actions. Hooks can be generic functions, named controller methods, or semantic data processors.

### 2.1. Basic Usage

```typescript
export class UsersController extends BaseController {
  static beforeActions = [{ run: "authenticate", only: ["create", "update"] }];

  private async authenticate() {
    if (!this.request.headers.get("Authorization")) {
      return this.render({ json: { error: "Unauthorized" }, status: 401 });
    }
  }
}
```

---

## 3. Semantic Hooks

Noblakbox controllers support special semantic keys in hooks to automate common data transformations.

### 3.1. `normalize`, `validate`, and `format`

When these keys are present, the controller automatically executes the corresponding class-based logic and stores the result in `ctx.validJson`.

```typescript
static beforeActions = [
  {
    normalize: UserNormalizer,
    validate: UserValidator,
    only: ['create']
  }
];

async create() {
  // this.params automatically points to normalized and validated data
  const user = await this.service.createUser(this.params);
  return this.render({ json: user, status: 201 });
}
```

---

## 4. Rendering System

The `render` method is a unified interface for responding to clients.

- **JSON**: `this.render({ json: data })`
- **Text**: `this.render({ text: 'Hello' })`
- **HTML**: `this.render({ html: '<h1>Title</h1>' })`
- **Views**: `this.render({ view: AccountShowView, layout: ApplicationLayout })`
  - _Note: `render` automatically initializes the `nomo/assets` pipeline from the environment and injects it into views/layouts._
- **Custom Types**: XML, CSV, and XLSX are also supported via specific keys.

---

## 5. API Reference

### `BaseController` Methods

- **`render(options)`**: The primary response helper.
- **`params`**: Dynamic getter for the (often validated/normalized) request body.
- **`pathParams`**: Access to URL parameters (`:id`, etc.).
- **`env`**: Access to the Cloudflare Environment variables/bindings.
- **`ctx`**: Access to the `RouterContext`.

---

## License

MIT
