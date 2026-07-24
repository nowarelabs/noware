# @nowarelabs/telemetry

Unified observability for Standard Gauge: logs, traces, and metrics through a single `Logger` interface. Embedded in every base class for implicit observability from day one.

## Core Concepts

### LogLevel

Numeric log levels for filtering and threshold control.

```typescript
import { LogLevel } from "@nowarelabs/telemetry";

LogLevel.DEBUG; // 0
LogLevel.INFO; // 1
LogLevel.WARN; // 2
LogLevel.ERROR; // 3
LogLevel.FATAL; // 4
```

### Three Pillars

| Pillar      | Purpose                        | API                                                        |
| ----------- | ------------------------------ | ---------------------------------------------------------- |
| **Logs**    | Structured, leveled messages   | `logger.info()`, `logger.error()`, etc.                    |
| **Traces**  | Distributed tracing with spans | `logger.span("name", fn)`                                  |
| **Metrics** | Counters, histograms, gauges   | `logger.counter()`, `logger.histogram()`, `logger.gauge()` |

## Usage Reference

### 1. Quick Start (Standalone)

```typescript
import { Logger, LogLevel } from "@nowarelabs/telemetry";

const logger = new Logger({ service: "my-app" });
logger.info("Application started");
```

### 2. With Request Context

```typescript
import { Logger, LogLevel } from "@nowarelabs/telemetry";

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
  request: RequestLike,
  env: EnvLike,
  ctx: ContextLike,
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

### 5. Distributed Tracing

The `span()` method creates OpenTelemetry child spans automatically:

```typescript
const result = await logger.span("process-order", async () => {
  logger.info("Processing started");
  const order = await db.create(orderData);
  logger.info("Processing completed", { orderId: order.id });
  return order;
});
```

**Span with attributes:**

```typescript
await logger.span("validate-input", { "user.id": userId }, async () => {
  await validate(input);
});
```

**Error recording:** Spans automatically record exceptions via `span.recordException()` and set the span status to ERROR. Errors are also logged automatically.

**Context propagation:** Spans use OpenTelemetry's `context.with()` for proper parent-child propagation. All logs within a span automatically include `trace_id` and `span_id`.

### 6. Metrics

Metrics are emitted as structured log entries and buffered for batch flush at request end:

```typescript
// Counter - increment by 1 (default)
logger.counter("orders.created");

// Counter - increment by custom value
logger.counter("items.processed", 5);

// Histogram - record timing/distribution
logger.histogram("request.duration_ms", 42.5);

// Gauge - record point-in-time value
logger.gauge("queue.depth", 10);
```

**Metric output (JSON):**

```json
{
  "type": "metric",
  "metric_type": "counter",
  "name": "orders.created",
  "value": 1,
  "timestamp": "2026-05-19T10:30:00.000Z",
  "service": "OrderService",
  "trace_id": "abc123"
}
```

**Batch flush:** When a span completes (or the request ends), all buffered metrics are flushed as a single `metrics_batch` log entry via `ctx.waitUntil()`.

### 7. Static Configuration

```typescript
import { Logger, LogLevel } from "@nowarelabs/telemetry";

// Set default log level
Logger.LEVEL = LogLevel.DEBUG;

// Set default environment
Logger.ENVIRONMENT = "staging";

// Disable all logging (master switch)
Logger.ENABLED = false;

// Disable metrics only
Logger.METRICS_ENABLED = false;
```

### 8. Context Enrichment

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

### 9. Lifecycle Hooks

Logger supports `before`, `after`, and `around` hooks for cross-cutting concerns:

```typescript
Logger.before((logger) => {
  logger.setMetadata("timestamp", Date.now());
});

Logger.around(async (logger, next) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;
  logger.info(`Operation took ${duration}ms`);
  return result;
});
```

### 10. Implicit Observability in Base Classes

Every base class automatically creates a `Logger` instance and instruments its `run()` method:

```typescript
import { BaseService } from "@nowarelabs/services";

// This service gets full observability for free:
class OrderService extends BaseService {
  protected model = orderModel;

  // No logging code needed - run() automatically:
  // 1. Creates a span named "OrderService.create"
  // 2. Logs "create started" at INFO
  // 3. Logs "create completed" at DEBUG
  // 4. Records counter "OrderService.create.success"
  // 5. Records histogram "OrderService.create.duration_ms"
  // 6. On error: logs error + records error counter

  async create(data: OrderData): Promise<Order> {
    // Your business logic here
    return this.model.create(data);
  }
}
```

**Available on:** `BaseService`, `BaseController`, `BaseRpc`, `BaseRpcServer`, `BaseFeature`, `BasePlugin`

**BaseFeature per-phase spans:** `BaseFeature.handle()` creates child spans for each lifecycle phase:

```
PlaceOrderFeature.handle
├── validate
├── prepare
├── execute
└── finalize
```

### 11. Environment Variables

| Variable                    | Purpose                          | Default                     |
| --------------------------- | -------------------------------- | --------------------------- |
| `ENVIRONMENT` or `NODE_ENV` | Environment detection            | `"production"`              |
| `LOG_FORMAT`                | Output format (`pretty` or JSON) | JSON in prod, pretty in dev |
| `LOG_LEVEL`                 | Minimum log level                | `INFO`                      |

### 12. Output Formats

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

**Metrics (Pretty):**

```
10:30:00 METRIC (OrderService): counter/orders.created = 1 [trace:abc123]
10:30:00 METRIC (OrderService): histogram/orders.create.duration_ms = 42.3 [trace:abc123]
```

### 13. Subclassing BaseLogger

For custom logging implementations:

```typescript
import { BaseLogger, LogLevel } from "@nowarelabs/telemetry";

class SilentLogger extends BaseLogger {
  debug(_message: string, _attributes?: LogContext) {}
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

| Export          | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `LogLevel`      | Enum for log levels (DEBUG=0, INFO=1, WARN=2, ERROR=3, FATAL=4) |
| `LogContext`    | Type alias for `Record<string, unknown>`                        |
| `LogEntry`      | Interface for structured log entries                            |
| `MetricEntry`   | Interface for structured metric entries                         |
| `LoggerOptions` | Interface for Logger constructor options                        |
| `BaseLogger`    | Abstract base class with lifecycle hooks                        |
| `Logger`        | Production logger with logs, traces, and metrics                |
| `MetricsBuffer` | Request-scoped metric accumulation and flush                    |
