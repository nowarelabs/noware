# nomo/logger

Production-ready logger for nomo applications with OpenTelemetry and SIEM support.

## Features

- **Structured JSON Logging**: Outputs logs as single-line JSON string to `stdout`, ready for SIEM ingestion (Logpush, Datadog, Splunk).
- **OpenTelemetry Integrated**: Automatically captures `trace_id` and `span_id` from the active OTel context.
- **Contextual Logging**: Easily create sub-loggers with persistent metadata (e.g., `request_id`, `user_id`).
- **Level Support**: `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` levels with environment-aware defaults.
- **Span Events**: Automatically adds log messages as events to the active OTel span.

## Installation

```bash
pnpm add nomo/logger
```

## Usage

### Basic Logging

```typescript
import { Logger, LogLevel } from "nomo/logger";

const logger = new Logger({
  service: "my-service",
  environment: "production",
  level: LogLevel.INFO,
});

logger.info("Application started");
logger.fatal("Critical failure"); // New FATAL level
```

### Contextual Logging

```typescript
const requestLogger = logger.withContext({ request_id: "abc-123" });
requestLogger.info("Processing request"); // includes request_id in JSON
```

### Error Logging

```typescript
try {
  throw new Error("Database connection failed");
} catch (e) {
  logger.error("Failed to connect", { db: "main" }, e);
  // Automatically captures stack trace and error message
}
```

### Beautiful Development Logs

In development, the logger switches to a human-readable, colorized format. This happens automatically when:

- `Logger.ENVIRONMENT` is set to `"development"`
- OR the environment variable `LOG_FORMAT=pretty` is set.

```bash
# Example Output:
10:04:54 PM INFO  (router): Processing POST /accounts request_id=3c13... [trace:e56d6eb5]
10:04:54 PM DEBUG (models): Executing SQL: SELECT * FROM ... [trace:e56d6eb5]
```

### Global Configuration

The `Router` automatically configures the logger's global environment and level. However, you can set them manually for isolated environments like queues or custom scripts:

```typescript
Logger.ENVIRONMENT = "development";
Logger.LEVEL = LogLevel.DEBUG;
```

### Trace Correlation (OpenTelemetry)

The logger is fully Integrated with OpenTelemetry. It automatically captures:

- `trace_id` & `span_id` from the active context.
- Standard attributes (if logged within a `Router` span).

#### Contextual Fetch

To continue a trace through an outgoing HTTP request, use `ctx.fetch()` (available in Controllers and Services) instead of the global `fetch()`:

```typescript
// Inside a Controller or Service
const res = await this.fetch("https://api.external.com/data");
// Automatically injects 'traceparent' header into the outgoing request
```

---

## License

MIT
