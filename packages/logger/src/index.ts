import { context, trace } from "@opentelemetry/api";

type LogEnv = { LOG_FORMAT?: string };
const LOG_FORMAT = (globalThis as unknown as LogEnv).LOG_FORMAT;

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export type LogContext = Record<string, unknown>;

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  service?: string;
  environment?: string;
  [key: string]: unknown;
}

export class Logger {
  private level?: LogLevel;
  private service: string;
  private environment?: string;
  private context: LogContext = {};
  public static ENVIRONMENT = "production";
  public static LEVEL = LogLevel.INFO;

  constructor(options: {
    service: string;
    environment?: string;
    level?: LogLevel;
    context?: LogContext;
  }) {
    this.service = options.service;
    this.environment = options.environment;
    this.level = options.level;
    this.context = options.context || {};
  }

  public setLevel(level: LogLevel) {
    this.level = level;
  }

  public withContext(context: LogContext): Logger {
    return new Logger({
      service: this.service,
      environment: this.environment,
      level: this.level,
      context: { ...this.context, ...context },
    });
  }

  public debug(message: string, attributes: LogContext = {}) {
    this.log(LogLevel.DEBUG, message, attributes);
  }

  public info(message: string, attributes: LogContext = {}) {
    this.log(LogLevel.INFO, message, attributes);
  }

  public warn(message: string, attributes: LogContext = {}) {
    this.log(LogLevel.WARN, message, attributes);
  }

  public error(message: string, attributes: LogContext = {}, error?: Error) {
    const errorAttributes = error
      ? {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
        }
      : {};
    this.log(LogLevel.ERROR, message, { ...errorAttributes, ...attributes });
  }

  public fatal(message: string, attributes: LogContext = {}, error?: Error) {
    const errorAttributes = error
      ? {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
        }
      : {};
    this.log(LogLevel.FATAL, message, { ...errorAttributes, ...attributes });
  }

  private log(level: LogLevel, message: string, attributes: LogContext = {}) {
    const currentLevel = this.level !== undefined ? this.level : Logger.LEVEL;
    if (level < currentLevel) return;

    const currentEnv = this.environment || Logger.ENVIRONMENT;

    const currentSpan = trace.getSpan(context.active());
    const spanContext = currentSpan?.spanContext();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      service: this.service,
      environment: currentEnv,
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
      ...this.context,
      ...attributes,
    };

    // Switch between Pretty and JSON based on environment
    if (currentEnv === "development" || LOG_FORMAT === "pretty") {
      console.log(this.formatPretty(entry));
    } else {
      // Output to stdout as a single JSON line for SIEM ingestion (Production)
      console.log(JSON.stringify(entry));
    }

    // Also add as event to current span if available
    if (currentSpan) {
      currentSpan.addEvent(message, {
        level: LogLevel[level],
        ...this.context,
        ...attributes,
      });

      if (level === LogLevel.ERROR) {
        currentSpan.setStatus({ code: 2 }); // SpanStatusCode.ERROR
      }
    }
  }

  private formatPretty(entry: LogEntry): string {
    const colors = {
      reset: "\x1b[0m",
      dim: "\x1b[2m",
      bold: "\x1b[1m",
      blue: "\x1b[34m",
      cyan: "\x1b[36m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      red: "\x1b[31m",
      magenta: "\x1b[35m",
    };

    const levelColors: Record<string, string> = {
      DEBUG: colors.dim,
      INFO: colors.green,
      WARN: colors.yellow,
      ERROR: colors.red,
      FATAL: colors.magenta,
    };

    const timestamp = colors.dim + new Date(entry.timestamp).toLocaleTimeString() + colors.reset;
    const levelColor = levelColors[entry.level] || colors.reset;
    const level = levelColor + colors.bold + entry.level.padEnd(5) + colors.reset;
    const service = colors.cyan + (entry.service || "app") + colors.reset;
    const msg = colors.bold + entry.message + colors.reset;

    let meta = "";
    const skipKeys = [
      "timestamp",
      "level",
      "message",
      "service",
      "environment",
      "trace_id",
      "span_id",
    ];
    const entries = Object.entries(entry).filter(([k]) => !skipKeys.includes(k));

    if (entries.length > 0) {
      meta =
        " " +
        entries
          .map(
            ([k, v]) =>
              colors.dim + k + "=" + colors.reset + (typeof v === "object" ? JSON.stringify(v) : v),
          )
          .join(" ");
    }

    const traceInfo = entry.trace_id
      ? ` ${colors.dim}[trace:${entry.trace_id.slice(0, 8)}]${colors.reset}`
      : "";

    return `${timestamp} ${level} (${service}): ${msg}${meta}${traceInfo}`;
  }
}
