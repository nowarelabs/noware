# nomo/result

A type-safe, functional error handling library for TypeScript. It provides a robust alternative to `try/catch` and `null` checks, ensuring that errors are handled as first-class values.

## Installation

```bash
pnpm add nomo/result
```

---

## 1. Core Concepts

The `nomo/result` package is built around the `Result<T>` type, which represents the outcome of an operation that can either succeed or fail.

- **`SuccessResult<T>`**: Contains the successful payload (`data`).
- **`ErrorResult`**: Contains error details (`error`, `message`, `status`, `code`).

By returning a `Result`, you force the consumer to explicitly handle both success and failure cases, leading to more resilient and predictable code.

---

## 2. Creating Results

### 2.1. Basic Construction

Use `ok` and `err` to create results directly.

```typescript
import { ok, err } from "nomo/result";

// Success
const result = ok({ id: 1, name: "Project" });

// Error
const failure = err("NOT_FOUND", "Project not found", 404);
```

### 2.2. Safe Wrappers

Use `safe` and `safeAsync` to wrap code that might throw exceptions. They automatically catch errors and return an `ErrorResult`.

```typescript
import { safe, safeAsync } from "nomo/result";

// Synchronous
const res = safe(() => JSON.parse(input));

// Asynchronous
const asyncRes = await safeAsync(async () => {
  return await api.call();
});
```

---

## 3. Transforming and Chaining

Results can be transformed and chained without manual success checks.

### 3.1. `transform` / `transformAsync`

Maps the successful data to a new value.

```typescript
const count = ok("hello").transform((s) => s.length); // ok(5)
```

### 3.2. `andThen` / `andThenAsync`

Chains multiple operations that return results.

```typescript
const user = await findUser(id)
  .andThenAsync(async (u) => await validateUser(u))
  .andThen((u) => ok(u.profile));
```

### 3.3. `recover`

Allows falling back to a successful result if the current result is an error.

```typescript
const settings = await getCustomSettings().recover((error) =>
  ok(DEFAULT_SETTINGS),
);
```

---

## 4. Result Matching

Matching is the preferred way to extract data from a `Result`.

### 4.1. Basic Matching

```typescript
result.match(
  (data) => console.log("Success:", data),
  (error) => console.error("Error:", error.message),
);
```

### 4.2. Semantic Tag Matching

The `match` helper allows for powerful pattern matching based on "tags" within the data or error details.

```typescript
import { match, tagged } from "nomo/result";

const res = ok(tagged("created", { id: 1 }));

const output = match(res, {
  created: (payload) => `Created item ${payload.id}`,
  updated: (payload) => `Updated item ${payload.id}`,
  error: (err) => `Failed: ${err.message}`,
});
```

---

## 5. Collective Operations

### 5.1. `all`

Combines an array of results into a single result containing an array of data. Fails fast if any result is an error.

```typescript
const combined = all([res1, res2, res3]); // Result<[T1, T2, T3]>
```

### 5.2. `allSettled`

Gathers all successes and errors from an array of results.

```typescript
const { data, errors } = allSettled(results).data;
```

---

## 6. Type Checking Utilities

```typescript
import { isOk, isErr, isResult } from "nomo/result";

if (isOk(res)) {
  // res is narrowed to SuccessResult
  console.log(res.data);
}
```

---

## License

MIT
