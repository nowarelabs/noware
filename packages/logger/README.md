# @nowarelabs/logger

A production-ready logger with OpenTelemetry integration, lifecycle hooks, and unified interface for any runtime (Node.js, Cloudflare Workers, etc.).

## Core Concepts

### LogLevel

Numeric log levels for filtering and threshold control.

```typescript
import { LogLevel } from "@nowarelabs/logger";

LogLevel.DEBUG; // 0
LogLevel.INFO; // 1
LogLevel.WARN; // 2
LogLevel.ERROR; // 3
LogLevel.FATAL; // 4
```

### LogContext

A type alias for `EnvLike` (`Record<string, unknown>`), used to pass structured context with log entries.

```typescript
import type { LogContext } from "@nowarelabs/logger";
```

## Usage Reference

### 1. Quick Start (Simple Config)

For standalone usage without request context:

```typescript
import { Logger } from "@nowarelabs/logger";

const logger = new Logger({ service: "my-app" });
logger.info("Application started");
```

### 2. With Request Context (Cloudflare Workers, etc.)

For full lifecycle hook support and OpenTelemetry tracing:

```typescript
import { Logger } from "@nowarelabs/logger";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const logger = new Logger(request, env, ctx, {
      service: "my-worker",
      level: LogLevel.DEBUG,
    });

    logger.info("Request received", { path: request.url });
  },
};
```

### 3. Constructor Overloads

**Simple config (standalone):**

```typescript
new Logger({
  service: string;        // Required: service name
  environment?: string;   // Overrides env detection
  level?: LogLevel;       // Minimum log level
  context?: LogContext;   // Initial context
})
```

**With request context:**

```typescript
new Logger(
  request: RequestLike,   // Incoming request
  env: EnvLike,           // Environment bindings
  ctx: ContextLike,       // Execution context
  options?: {
    service?: string;     // Default: "app"
    environment?: string;
    level?: LogLevel;
    context?: LogContext;
  }
)
```

### 4. Logging Methods

```typescript
const logger = new Logger({ service: "app" });

logger.debug("Debug message", { requestId: "123" });
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error occurred", { code: 500 });
logger.fatal("Fatal error", {}, new Error("Critical failure"));
```

### 5. Static Configuration

```typescript
import { Logger, LogLevel } from "@nowarelabs/logger";

// Set default log level
Logger.LEVEL = LogLevel.DEBUG;

// Set default environment
Logger.ENVIRONMENT = "staging";
```

### 6. Context Enrichment

```typescript
const logger = new Logger({ service: "app" });

// Add context and get a new logger instance
const enrichedLogger = logger.withContext({
  userId: "user-123",
  sessionId: "sess-456",
});

enrichedLogger.info("User action logged");
// Log entry includes: { userId: "user-123", sessionId: "sess-456" }
```

### 7. Lifecycle Hooks

Logger supports `before`, `after`, and `around` hooks for cross-cutting concerns.

#### Static Hooks (Configuration)

Best for global logging concerns:

```typescript
Logger.before((logger) => {
  logger.setMetadata("timestamp", Date.now());
});

Logger.after((logger, _result) => {
  console.log(`Logger finished: ${logger.getMetadata("service")}`);
});

Logger.around(async (logger, next) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;
  logger.info(`Operation took ${duration}ms`);
  return result;
});
```

#### Instance Hooks (Convention)

Override in subclasses for class-specific behavior:

```typescript
import { Logger, LogLevel } from "@nowarelabs/logger";
import type { LogContext, UseCaseResult } from "@nowarelabs/shared";

class CustomLogger extends Logger {
  protected async afterExecute(result: UseCaseResult<any>): Promise<void> {
    if (!result.success) {
      this.error(`Use case failed: ${result.error.message}`);
    }
  }
}
```

### 8. Environment Configuration

The logger reads from the `env` parameter (not `process.env`) for cross-runtime compatibility:

```typescript
// In Cloudflare Workers
new Logger(request, env, ctx, { service: "worker" });
// env.LOG_FORMAT, env.ENVIRONMENT, env.NODE_ENV are automatically read

// In Node.js
new Logger(request, { LOG_FORMAT: "pretty", ENVIRONMENT: "dev" }, ctx, { service: "app" });
```

**Supported environment variables:**
| Variable | Purpose | Default |
|----------|---------|---------|
| `ENVIRONMENT` or `NODE_ENV` | Environment detection | `"production"` |
| `LOG_FORMAT` | Output format (`pretty` or JSON) | JSON in prod, pretty in dev |

### 9. OpenTelemetry Integration

Logs are automatically linked to active spans:

```typescript
import { trace } from "@opentelemetry/api";

const span = tracer.startSpan("operation");
context.with(trace.setSpan(context.active(), span), () => {
  const logger = new Logger(request, env, ctx, { service: "app" });
  logger.info("Within span");

  span.end(); // Span status auto-set to ERROR on logger.error()
});
```

### 10. Output Formats

**JSON (Production):**

```json
{
  "timestamp": "2026-05-19T10:30:00.000Z",
  "level": "INFO",
  "message": "Request received",
  "service": "my-app",
  "environment": "production",
  "trace_id": "abc123",
  "user_id": "user-1"
}
```

**Pretty (Development):**

```
10:30:00 INFO   (my-app): Request received user_id=user-1 [trace:abc123]
```

### 11. Subclassing BaseLogger

For custom logging implementations:

```typescript
import { BaseLogger, LogLevel } from "@nowarelabs/logger";

class SilentLogger extends BaseLogger {
  debug(_message: string, _attributes?: LogContext) {} // No-op
  info(_message: string, _attributes?: LogContext) {}
  warn(_message: string, _attributes?: LogContext) {}
  error(_message: string, _attributes?: LogContext) {}
  fatal(_message: string, _attributes?: LogContext) {}
}
```

## Development

- Install dependencies: `vp install`
- Run the unit tests: `vp test`
- Build the library: `vp pack`
- Check for lint issues: `vp check`

## Exports

| Export       | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `LogLevel`   | Enum for log levels (DEBUG=0, INFO=1, WARN=2, ERROR=3, FATAL=4) |
| `LogContext` | Type alias for `Record<string, unknown>`                        |
| `LogEntry`   | Interface for structured log entries                            |
| `BaseLogger` | Abstract base class with lifecycle hooks                        |
| `Logger`     | Production logger implementation extending BaseLogger           |
