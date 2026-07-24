import type {
  EnvLike,
  LoggerContext,
  ContextLike,
  RequestLike,
  HookOptions,
  RegisteredHook,
} from "@nowarelabs/shared";
import { runBeforeHooks, runAfterHooks, runAroundHooks } from "@nowarelabs/shared";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";

// ── LogLevel ───────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

// ── Types ──────────────────────────────────────────────────────────

export type LogContext = EnvLike;

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  environment?: string;
  trace_id?: string;
  span_id?: string;
  trace_flags?: number;
  error_name?: string;
  error_message?: string;
  error_stack?: string;
  [key: string]: unknown;
}

export interface MetricEntry {
  type: "metric";
  metric_type: "counter" | "histogram" | "gauge";
  name: string;
  value: number;
  timestamp: string;
  service?: string;
  environment?: string;
  trace_id?: string;
  span_id?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  service: string;
  environment?: string;
  level?: LogLevel;
  context?: LogContext;
}

// ── BaseLogger ─────────────────────────────────────────────────────

export abstract class BaseLogger<
  Ctx extends LoggerContext = LoggerContext,
  Env extends EnvLike = EnvLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  static before(fn: (instance: BaseLogger) => unknown, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn, options });
  }

  static after(
    fn: (instance: BaseLogger, result: unknown) => unknown,
    options?: HookOptions,
  ): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn, options });
  }

  static around(
    fn: (instance: BaseLogger, next: () => Promise<unknown>) => Promise<unknown>,
    options?: HookOptions,
  ): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn, options });
  }

  protected env: Env;
  protected ctx: Ctx;
  protected request: RequestLike;
  protected metadata: Record<string, unknown> = {};

  constructor(request: RequestLike, env: Env, ctx: Ctx) {
    this.request = request;
    this.env = env;
    this.ctx = ctx;
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }

  protected async beforeExecute(): Promise<void> {}

  protected async afterExecute(_result: unknown): Promise<void> {}

  protected async runLogHooks(action: () => Promise<unknown>): Promise<unknown> {
    const Ctor = this.constructor as typeof BaseLogger;
    const shouldRunHook = (opts?: HookOptions) => this.shouldRunHook(opts);

    const beforeResult = await runBeforeHooks(
      this,
      BaseLogger.collectHooks(Ctor, "beforeHooks"),
      shouldRunHook,
    );
    if (beforeResult) return beforeResult;

    const output = await runAroundHooks(
      this,
      BaseLogger.collectHooks(Ctor, "aroundHooks"),
      action,
      shouldRunHook,
    );

    return runAfterHooks(this, BaseLogger.collectHooks(Ctor, "afterHooks"), output, shouldRunHook);
  }

  protected static collectHooks(ctor: object, prop: string): RegisteredHook[] {
    const hooks: RegisteredHook[] = [];
    let current: object | null = ctor;
    while (current && current !== Function.prototype) {
      if (Object.hasOwn(current, prop)) {
        hooks.unshift(...(current as Record<string, RegisteredHook[]>)[prop]);
      }
      current = Object.getPrototypeOf(current);
    }
    return hooks;
  }

  protected setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  protected getMetadata<T = unknown>(key: string): T | undefined {
    return this.metadata[key] as T;
  }

  protected getEnv<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.env[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected waitUntil(promise: Promise<unknown>): void {
    this.ctx.waitUntil(promise);
  }
}

const c = {
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
  DEBUG: c.dim,
  INFO: c.green,
  WARN: c.yellow,
  ERROR: c.red,
  FATAL: c.magenta,
};

const skipKeys = new Set([
  "timestamp",
  "level",
  "message",
  "service",
  "environment",
  "trace_id",
  "span_id",
  "trace_flags",
]);

export function formatPretty(entry: LogEntry): string {
  const ts = c.dim + new Date(entry.timestamp).toLocaleTimeString() + c.reset;
  const lv = (levelColors[entry.level] || c.reset) + c.bold + entry.level.padEnd(5) + c.reset;
  const svc = c.cyan + (entry.service || "app") + c.reset;
  const msg = c.bold + entry.message + c.reset;

  const meta = Object.entries(entry)
    .filter(([k]) => !skipKeys.has(k))
    .map(([k, v]) => c.dim + k + "=" + c.reset + JSON.stringify(v))
    .join(" ");

  const traceInfo = entry.trace_id
    ? ` ${c.dim}[trace:${entry.trace_id.slice(0, 8)}]${c.reset}`
    : "";

  const metaStr = meta ? ` ${meta}` : "";
  return `${ts} ${lv} (${svc}): ${msg}${metaStr}${traceInfo}`;
}

export function formatMetricPretty(entry: MetricEntry): string {
  const ts = c.dim + new Date(entry.timestamp).toLocaleTimeString() + c.reset;
  const tp = c.magenta + c.bold + "METRIC".padEnd(5) + c.reset;
  const svc = c.cyan + (entry.service || "app") + c.reset;
  const name = c.bold + entry.name + c.reset;
  const value = c.green + String(entry.value) + c.reset;

  const traceInfo = entry.trace_id
    ? ` ${c.dim}[trace:${entry.trace_id.slice(0, 8)}]${c.reset}`
    : "";

  return `${ts} ${tp} (${svc}): ${entry.metric_type}/${name} = ${value}${traceInfo}`;
}


// ── Logger ─────────────────────────────────────────────────────────

export class Logger<
  Ctx extends LoggerContext = LoggerContext,
  Env extends EnvLike = EnvLike,
> extends BaseLogger<Ctx, Env> {
  public static ENVIRONMENT = "production";
  public static LEVEL = LogLevel.INFO;
  public static ENABLED = true;
  public static METRICS_ENABLED = true;

  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  private level?: LogLevel;
  private service: string;
  private metricsBuffer: MetricsBuffer;

  constructor(options: LoggerOptions);
  constructor(request: RequestLike, env: Env, ctx: Ctx, options?: LoggerOptions);
  constructor(
    requestOrOptions: RequestLike | LoggerOptions,
    env?: Env,
    ctx?: Ctx,
    options?: LoggerOptions,
  ) {
    if (
      arguments.length === 1 &&
      typeof requestOrOptions === "object" &&
      !("raw" in requestOrOptions)
    ) {
      const opts = requestOrOptions as LoggerOptions;
      super({} as RequestLike, {} as Env, { waitUntil: () => {} } as unknown as Ctx);
      this.service = opts.service;
      this.level = opts.level;
      this.metricsBuffer = new MetricsBuffer(this.ctx);
      if (opts.environment) {
        this.setMetadata("environment", opts.environment);
      }
      if (opts.context) {
        Object.entries(opts.context).forEach(([k, v]) => this.setMetadata(k, v));
      }
    } else {
      super(requestOrOptions as RequestLike, env!, ctx!);
      this.service = options?.service || "app";
      this.level = options?.level;
      this.metricsBuffer = new MetricsBuffer(this.ctx);
      if (options?.environment) {
        this.setMetadata("environment", options.environment);
      }
      if (options?.context) {
        Object.entries(options.context).forEach(([k, v]) => this.setMetadata(k, v));
      }
    }
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public withContext(context: LogContext): Logger<Ctx, Env> {
    return new Logger(this.request, this.env, this.ctx, {
      service: this.service,
      level: this.level,
      environment: this.getMetadata<string>("environment"),
      context: { ...(this.metadata as LogContext), ...context },
    });
  }

  // ── Logs ──────────────────────────────────────────────────────────

  public debug(message: string, attributes: LogContext = {}): void {
    this.log(LogLevel.DEBUG, message, attributes);
  }

  public info(message: string, attributes: LogContext = {}): void {
    this.log(LogLevel.INFO, message, attributes);
  }

  public warn(message: string, attributes: LogContext = {}): void {
    this.log(LogLevel.WARN, message, attributes);
  }

  public error(message: string, attributes: LogContext = {}, error?: Error): void {
    const errorAttributes = error
      ? {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
        }
      : {};
    this.log(LogLevel.ERROR, message, { ...errorAttributes, ...attributes });
  }

  public fatal(message: string, attributes: LogContext = {}, error?: Error): void {
    const errorAttributes = error
      ? {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
        }
      : {};
    this.log(LogLevel.FATAL, message, { ...errorAttributes, ...attributes });
  }

  private log(level: LogLevel, message: string, attributes: LogContext = {}): void {
    if (!Logger.ENABLED) return;

    const currentLevel = this.level !== undefined ? this.level : Logger.LEVEL;
    if (level < currentLevel) return;

    const Ctor = this.constructor as typeof BaseLogger;
    const hasHooks =
      BaseLogger.collectHooks(Ctor, "beforeHooks").length > 0 ||
      BaseLogger.collectHooks(Ctor, "aroundHooks").length > 0 ||
      BaseLogger.collectHooks(Ctor, "afterHooks").length > 0;

    const write = async (): Promise<void> => {
      const currentSpan = trace.getSpan(context.active());
      const spanContext = currentSpan?.spanContext();

      const logFormat = this.getEnv<string>("LOG_FORMAT");
      const environment =
        this.getMetadata<string>("environment") ||
        this.getEnv("ENVIRONMENT") ||
        this.getEnv("NODE_ENV") ||
        Logger.ENVIRONMENT;

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel[level],
        message,
        service: this.service,
        environment,
        trace_id: spanContext?.traceId,
        span_id: spanContext?.spanId,
        trace_flags: spanContext?.traceFlags,
        ...this.metadata,
        ...attributes,
      };

      if (environment === "development" || logFormat === "pretty") {
        console.log(formatPretty(entry));
      } else {
        console.log(JSON.stringify(entry));
      }

      if (currentSpan) {
        currentSpan.addEvent(message, {
          "log.level": LogLevel[level],
          "log.service": this.service,
          ...this.metadata,
          ...attributes,
        });

        if (level >= LogLevel.ERROR) {
          currentSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message,
          });
        }
      }
    };

    if (hasHooks) {
      void this.runLogHooks(write);
    } else {
      void write();
    }
  }

  // ── Traces ────────────────────────────────────────────────────────

  public async span<T>(name: string, fn: () => Promise<T>): Promise<T>;
  public async span<T>(
    name: string,
    attrs: Record<string, unknown>,
    fn: () => Promise<T>,
  ): Promise<T>;
  public async span<T>(
    nameOrAttrs: string | Record<string, unknown>,
    fnOrAttrs: (() => Promise<T>) | Record<string, unknown>,
    maybeFn?: () => Promise<T>,
  ): Promise<T> {
    const name = typeof nameOrAttrs === "string" ? nameOrAttrs : "span";
    const fn = typeof fnOrAttrs === "function" ? fnOrAttrs : maybeFn!;
    const attrs =
      typeof nameOrAttrs === "object"
        ? nameOrAttrs
        : typeof fnOrAttrs === "object"
          ? fnOrAttrs
          : undefined;

    const tracer = trace.getTracer("noware");
    const span = tracer.startSpan(
      name,
      attrs ? { attributes: attrs as Record<string, string | number | boolean> } : undefined,
    );

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn());
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      this.error(`${name} failed`, {}, err);
      throw error;
    } finally {
      span.end();
      this.metricsBuffer.flush();
    }
  }

  // ── Metrics ───────────────────────────────────────────────────────

  public counter(name: string, value?: number, attrs?: Record<string, unknown>): void {
    if (!Logger.METRICS_ENABLED) return;
    const entry = this.buildMetricEntry("counter", name, value ?? 1, attrs);
    this.metricsBuffer.push(entry);
    this.writeMetric(entry);
  }

  public histogram(name: string, value: number, attrs?: Record<string, unknown>): void {
    if (!Logger.METRICS_ENABLED) return;
    const entry = this.buildMetricEntry("histogram", name, value, attrs);
    this.metricsBuffer.push(entry);
    this.writeMetric(entry);
  }

  public gauge(name: string, value: number, attrs?: Record<string, unknown>): void {
    if (!Logger.METRICS_ENABLED) return;
    const entry = this.buildMetricEntry("gauge", name, value, attrs);
    this.metricsBuffer.push(entry);
    this.writeMetric(entry);
  }

  private buildMetricEntry(
    metricType: "counter" | "histogram" | "gauge",
    name: string,
    value: number,
    attrs?: Record<string, unknown>,
  ): MetricEntry {
    const currentSpan = trace.getSpan(context.active());
    const spanContext = currentSpan?.spanContext();

    return {
      type: "metric",
      metric_type: metricType,
      name,
      value,
      timestamp: new Date().toISOString(),
      service: this.service,
      environment:
        this.getMetadata<string>("environment") || this.getEnv("ENVIRONMENT") || Logger.ENVIRONMENT,
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
      ...this.metadata,
      ...attrs,
    };
  }

  private writeMetric(entry: MetricEntry): void {
    const logFormat = this.getEnv<string>("LOG_FORMAT");
    const environment = entry.environment;
    if (environment === "development" || logFormat === "pretty") {
      console.log(formatMetricPretty(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }
}

export class MetricsBuffer {
  private entries: MetricEntry[] = [];
  private flushed = false;

  constructor(private ctx: ContextLike) {}

  push(entry: MetricEntry): void {
    if (!this.flushed) this.entries.push(entry);
  }

  flush(): void {
    if (this.flushed || this.entries.length === 0) return;
    this.flushed = true;
    const batch = { type: "metrics_batch" as const, metrics: this.entries };
    this.ctx.waitUntil(Promise.resolve(console.log(JSON.stringify(batch))));
  }

  get hasEntries(): boolean {
    return this.entries.length > 0;
  }
}
