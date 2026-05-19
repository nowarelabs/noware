import { context, trace } from "@opentelemetry/api";
import type {
  EnvLike,
  ContextLike,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export type LogContext = EnvLike;

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  service?: string;
  environment?: string;
  [key: string]: any;
}

export abstract class BaseLogger<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected env: Env;
  protected ctx: Ctx;
  protected request: RequestLike;
  protected metadata: Record<string, unknown> = {};

  constructor(request: RequestLike, env: Env, ctx: Ctx) {
    this.request = request;
    this.env = env;
    this.ctx = ctx;
  }

  static before<T extends BaseLogger>(fn: HookFunction<T>, options?: HookOptions): void {
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseLogger>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseLogger>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  static skipBefore<T extends BaseLogger>(fn: HookFunction<T>): void {
    this.beforeHooks = this.beforeHooks.filter((h) => h.fn !== fn);
  }

  static skipAfter<T extends BaseLogger>(fn: AfterHookFunction<T>): void {
    this.afterHooks = this.afterHooks.filter((h) => h.fn !== fn);
  }

  static skipAround<T extends BaseLogger>(fn: AroundHookFunction<T>): void {
    this.aroundHooks = this.aroundHooks.filter((h) => h.fn !== fn);
  }

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }

  protected async beforeExecute(): Promise<void> {}

  protected async afterExecute(_result: any): Promise<void> {}

  protected async runBeforeHooks<R = any>(): Promise<R | null> {
    const constructor = this.constructor as typeof BaseLogger;
    for (const { fn, options } of constructor.beforeHooks) {
      if (!this.shouldRunHook(options)) continue;
      const result = await (fn as HookFunction)(this);
      if (result !== undefined && result !== null) return result as R;
    }
    return null;
  }

  protected async runAfterHooks<R = any>(result: R): Promise<R> {
    const constructor = this.constructor as typeof BaseLogger;
    for (const { fn, options } of constructor.afterHooks) {
      if (!this.shouldRunHook(options)) continue;
      const hookResult = await (fn as AfterHookFunction)(this, result);
      if (hookResult !== undefined && hookResult !== null) result = hookResult as R;
    }
    return result;
  }

  protected async runAroundHooks<R = any>(action: () => Promise<R>): Promise<R> {
    const constructor = this.constructor as typeof BaseLogger;
    const applicableHooks = constructor.aroundHooks.filter(({ options }) =>
      this.shouldRunHook(options),
    );

    if (applicableHooks.length === 0) return action();

    let index = 0;
    const next = async (): Promise<R> => {
      if (index >= applicableHooks.length) return action();
      const { fn } = applicableHooks[index++];
      return (fn as AroundHookFunction)(this, next);
    };

    return next();
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

export class Logger<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
> extends BaseLogger<Ctx, Env> {
  public static ENVIRONMENT = "production";
  public static LEVEL = LogLevel.INFO;

  private level?: LogLevel;
  private service: string;

  constructor(options: {
    service: string;
    environment?: string;
    level?: LogLevel;
    context?: LogContext;
  });
  constructor(
    request: RequestLike,
    env: Env,
    ctx: Ctx,
    options?: {
      service: string;
      environment?: string;
      level?: LogLevel;
      context?: LogContext;
    },
  );
  constructor(
    requestOrOptions:
      | RequestLike
      | { service: string; environment?: string; level?: LogLevel; context?: LogContext },
    env?: Env,
    ctx?: Ctx,
    options?: { service: string; environment?: string; level?: LogLevel; context?: LogContext },
  ) {
    if (
      arguments.length === 1 &&
      typeof requestOrOptions === "object" &&
      !("raw" in requestOrOptions)
    ) {
      const opts = requestOrOptions as {
        service: string;
        environment?: string;
        level?: LogLevel;
        context?: LogContext;
      };
      super({} as RequestLike, {} as Env, { waitUntil: () => {} } as unknown as Ctx);
      this.service = opts.service;
      this.level = opts.level;
    } else {
      super(requestOrOptions as RequestLike, env!, ctx!);
      this.service = options?.service || "app";
      this.level = options?.level;
      if (options?.context) {
        Object.entries(options.context).forEach(([k, v]) => this.setMetadata(k, v));
      }
    }
  }

  public setLevel(level: LogLevel) {
    this.level = level;
  }

  public withContext(context: LogContext): Logger<Ctx, Env> {
    const logger = new Logger(this.request, this.env, this.ctx, {
      service: this.service,
      level: this.level,
      context: { ...(this.metadata as LogContext), ...context },
    });
    return logger;
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

    const currentEnv = this.getEnv("ENVIRONMENT") || this.getEnv("NODE_ENV") || Logger.ENVIRONMENT;
    const logFormat = this.getEnv("LOG_FORMAT");

    const currentSpan = trace.getSpan(context.active());
    const spanContext = currentSpan?.spanContext();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      service: this.service,
      environment: currentEnv as string,
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
      ...this.metadata,
      ...attributes,
    };

    if (currentEnv === "development" || logFormat === "pretty") {
      console.log(this.formatPretty(entry));
    } else {
      console.log(JSON.stringify(entry));
    }

    if (currentSpan) {
      currentSpan.addEvent(message, {
        level: LogLevel[level],
        ...this.metadata,
        ...attributes,
      });

      if (level === LogLevel.ERROR) {
        currentSpan.setStatus({ code: 2 });
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
