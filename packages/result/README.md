# Result

A TypeScript Result type implementation inspired by Rust's Result and functional programming patterns. Provides a type-safe way to handle success and error cases without throwing exceptions.

## Installation

```bash
vp install
```

## Usage

### Creating Results

```typescript
import { ok, err, safe, safeAsync, Result } from "@nowarelabs/result";

// Success result
const success: Result<string> = ok("Hello");

// Error result
const failure: Result<never> = err("Something went wrong", "Error message", 500, "ERROR");

// Wrapping sync functions (catches exceptions)
const wrapped = safe(() => {
  if (Math.random() > 0.5) throw new Error("Oops");
  return "Success";
});

// Wrapping async functions
const asyncWrapped = await safeAsync(async () => {
  const data = await fetch("/api/data");
  return data.json();
});
```

### Chaining Operations

```typescript
const result = ok(10)
  .transform((x) => x * 2) // Transform the data
  .andThen((x) => ok(x + 5)) // Chain to another Result
  .recover(() => ok("fallback")); // Recover from errors

// Async chaining
const asyncResult = await ok(10)
  .transformAsync(async (x) => await process(x))
  .andThenAsync(async (x) => await save(x));
```

### Pattern Matching

```typescript
import { match, matchResult, matchCode, matchStatus } from "@nowarelabs/result";

// Match on result
const value = matchResult(result, {
  ok: (data) => `Got: ${data}`,
  err: (error) => `Error: ${error.message}`,
});

// Match on error tags
const taggedError = err("fail", "Failed", 404, "NOT_FOUND", undefined, { tag: "not_found" });
const matched = match(taggedError, {
  not_found: (payload) => "Resource not found",
  default: () => "Unknown error",
});

// Match on error codes
const handled = matchCode(error.code, {
  NETWORK_TIMEOUT: () => retry(),
  AUTH_EXPIRED: () => refreshToken(),
  default: () => handleGeneric(error),
});

// Match on HTTP status
const response = matchStatus(httpStatus, {
  200: () => "OK",
  404: () => "Not found",
  500: () => "Server error",
});
```

### Collection Operations

```typescript
import { all, allSettled, combine } from "@nowarelabs/result";

// All - fails fast on first error
const combined = all([ok(1), ok(2), ok(3)]);
// Result<[1, 2, 3]>

// AllSettled - collects all successes and errors
const settled = allSettled([ok(1), err("error"), ok(3)]);
// Result<{ data: [1, 3], errors: [ErrorInfo] }>

// Combine - wraps array of results
const wrapped = combine([ok(1), err("fail"), ok(3)]);
// Result<Result<number>[]>
```

### Tagged Errors

```typescript
import { tagged, taggedWith, isTagged } from "@nowarelabs/result";

// Create tagged data
const taggedData = tagged("error", { message: "Invalid email" });
// { message: "Invalid email", tag: "error" }

// Create with custom tag name
const customTag = taggedWith("errorType", "validation", { field: "email" });
// { field: "email", errorType: "validation" }

// Check if value is tagged
if (isTagged(error, "tag", "validation")) {
  // Handle validation error
}
```

### Type Guards

```typescript
import { isResult, isSuccess, isError, isOk, isErr } from "@nowarelabs/result";

if (isSuccess(result)) {
  // result is SuccessResult<T>
  console.log(result.data);
}

if (isErr(result)) {
  // result is ErrorResult
  console.log(result.message);
}
```

### Retry Logic

```typescript
import {
  tryWhile,
  tryN,
  RetryConditionAlways,
  RetryConditionNever,
  jitterBackoff,
  isErrorRetryable,
} from "@nowarelabs/result";

// Retry until success or non-retryable error
const data = await tryWhile(
  () => fetch("/api"),
  (err) => isErrorRetryable(err), // Custom retry condition
  { baseDelayMs: 100, maxDelayMs: 5000 },
);

// Retry exactly N times
const result = await tryN(3, async (attempt) => {
  if (attempt < 3) throw new Error("Failed");
  return "Success";
});

// Jittered backoff calculation
const delay = jitterBackoff(attempt, 100, 1000);
// Returns random delay between 0 and min(2^attempt * base, max)
```

## API Reference

### Core Functions

| Function                                                          | Description                                 |
| ----------------------------------------------------------------- | ------------------------------------------- |
| `ok<T>(data, message?, status?, code?)`                           | Creates a success Result                    |
| `err<T>(error, message?, status?, code?, stack?, details?)`       | Creates an error Result                     |
| `safe<T>(fn)`                                                     | Wraps sync function, catching exceptions    |
| `safeAsync<T>(fn)`                                                | Wraps async function, catching exceptions   |
| `when<T>(condition, value, default?)`                             | Returns value or default based on condition |
| `whenResult<T>(condition, value, errorMsg?, errorCode?, status?)` | Returns Result based on condition           |

### Transformation Functions

| Function                   | Description                    |
| -------------------------- | ------------------------------ |
| `transform<T, U>(fn)`      | Maps success data to new value |
| `andThen<T, U>(fn)`        | Chains to another Result       |
| `transformAsync<T, U>(fn)` | Async version of transform     |
| `andThenAsync<T, U>(fn)`   | Async version of andThen       |
| `recover<T>(fn)`           | Transforms error to success    |

### Matching Functions

| Function                                                                 | Description                   |
| ------------------------------------------------------------------------ | ----------------------------- |
| `matchCode(code, handlers, default?)`                                    | Match error code to handler   |
| `matchCodeResult<T>(code, handlers, errorMsg?, errorCode?, status?)`     | Match code returning Result   |
| `matchStatus(status, handlers, default?)`                                | Match HTTP status code        |
| `matchStatusResult<T>(status, handlers, errorMsg?, errorCode?, status?)` | Match status returning Result |
| `matchResult<T, R>(result, handlers)`                                    | Pattern match on Result       |
| `match<T>(result, handlers, tagName?)`                                   | Match on tag value            |

### Collection Functions

| Function                 | Description                          |
| ------------------------ | ------------------------------------ |
| `all<T>(results)`        | Combine results, fail on first error |
| `allSettled<T>(results)` | Collect all successes and errors     |
| `combine<T>(results)`    | Wrap array of results                |

### Tagging Functions

| Function                               | Description                     |
| -------------------------------------- | ------------------------------- |
| `tagged<T>(value, data?, tagName?)`    | Create tagged object            |
| `taggedWith<T>(tag, value, data?)`     | Create object with specific tag |
| `isTagged(value, tagName?, tagValue?)` | Type guard for tagged values    |

### Type Guards

| Function               | Description                |
| ---------------------- | -------------------------- |
| `isResult<T>(value)`   | Check if value is Result   |
| `isSuccess<T>(result)` | Check if result is success |
| `isError<T>(result)`   | Check if result is error   |
| `isOk<T>(result)`      | Alias for isSuccess        |
| `isErr<T>(result)`     | Alias for isError          |

### Retry Functions

| Function                                          | Description                          |
| ------------------------------------------------- | ------------------------------------ |
| `tryWhile<T>(fn, isRetryable, options?)`          | Retry until success or non-retryable |
| `tryN<T>(n, fn, options?)`                        | Retry exactly N times                |
| `jitterBackoff(attempt, baseDelayMs, maxDelayMs)` | Calculate jittered delay             |
| `isErrorRetryable(err)`                           | Check if error is retryable          |
| `RetryConditionAlways`                            | Always retry                         |
| `RetryConditionNever`                             | Never retry                          |

### Types

- `Result<T>` - Union of SuccessResult<T> and ErrorResult
- `SuccessResult<T>` - Success variant with data
- `ErrorResult` - Error variant with error info
- `ErrorInfo` - Error details: error, message, status, code, stack, details
- `ErrorDetails` - Record of additional error data

## References

This implementation draws inspiration from:

- [Rust Result](https://doc.rust-lang.org/std/result/) - The original Result type design
- [Elm Result](https://package.elm-lang.org/packages/elm/core/latest/Result) - Functional error handling
- [NeverThrow](https://github.com/supermsar/neverthrow) - TypeScript Result library
- [Cloudflare Workers Retry Logic](https://github.com/cloudflare/actors/blob/9ba112503132ddf6b5cef37ff145e7a2dd5ffbfc/packages/core/src/retries.ts) - Exponential backoff implementation

## Development

- Install dependencies:

  ```bash
  vp install
  ```

- Run the unit tests:

  ```bash
  vp test
  ```

- Build the library:
  ```bash
  vp pack
  ```
