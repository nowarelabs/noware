type ErrorDetails = Record<string, unknown>;

type ErrorInfo = {
  error: string;
  message: string;
  status: number;
  code: string;
  stack?: string;
  details?: ErrorDetails;
};

type SuccessResult<T> = {
  success: true;
  data: T;
  error?: never;
  message: string;
  status: number;
  code: string;
  match: <U>(onSuccess: (data: T) => U, onError: (error: ErrorInfo) => U) => U;
  transform: <U>(fn: (data: T) => U) => Result<U>;
  andThen: <U>(fn: (data: T) => Result<U>) => Result<U>;
  recover: <U>(fn: (error: ErrorInfo) => Result<U>) => Result<T>;
  transformAsync: <U>(fn: (data: T) => Promise<U>) => Promise<Result<U>>;
  andThenAsync: <U>(fn: (data: T) => Promise<Result<U>>) => Promise<Result<U>>;
};

type ErrorResult = {
  success: false;
  data?: never;
  error: string;
  message: string;
  status: number;
  code: string;
  stack?: string;
  details?: ErrorDetails;
  match: <U>(onSuccess: (data: never) => U, onError: (error: ErrorInfo) => U) => U;
  transform: <U>(fn: (data: never) => U) => Result<U>;
  andThen: <U>(fn: (data: never) => Result<U>) => Result<U>;
  recover: <T>(fn: (error: ErrorInfo) => Result<T>) => Result<T>;
  transformAsync: <U>(fn: (data: never) => Promise<U>) => Promise<Result<U>>;
  andThenAsync: <U>(fn: (data: never) => Promise<Result<U>>) => Promise<Result<U>>;
};

type Result<T> = SuccessResult<T> | ErrorResult;

const ok = <T>(
  data: T,
  message: string = "Success",
  status: number = 200,
  code: string = "OK",
): Result<T> => ({
  success: true,
  data,
  message,
  status,
  code,
  match(onSuccess, _) {
    return onSuccess(data);
  },
  transform(fn) {
    return ok(fn(data));
  },
  andThen(fn) {
    return fn(data);
  },
  recover(_) {
    return this as unknown as Result<T>;
  },
  async transformAsync(fn) {
    return ok(await fn(data));
  },
  async andThenAsync(fn) {
    return await fn(data);
  },
});

function err(
  error: string,
  message?: string,
  status?: number,
  code?: string,
  stack?: string,
  details?: ErrorDetails,
): Result<never>;
function err<TagValue extends string | number | boolean>(
  taggedData: { tag: TagValue } & Record<string, unknown>,
  message?: string,
  status?: number,
  code?: string,
  stack?: string,
  tagName?: string,
): Result<never>;
function err<TagValue extends string | number | boolean>(
  errorOrTagged: string | ({ tag: TagValue } & Record<string, unknown>),
  message: string = "Error",
  status: number = 500,
  code: string = "ERROR",
  stack?: string,
  detailsOrTagName?: ErrorDetails | string,
  tagName: string = "tag",
): Result<never> {
  // Check if first argument is tagged data
  const actualTagName =
    (typeof detailsOrTagName === "string" ? detailsOrTagName : tagName) || tagName;
  const isTaggedData =
    typeof errorOrTagged === "object" &&
    errorOrTagged !== null &&
    (actualTagName in errorOrTagged || "tag" in errorOrTagged);

  if (isTaggedData) {
    const taggedData = errorOrTagged as Record<string, unknown>;
    const tagValue = taggedData[actualTagName] || taggedData.tag;

    // Extract error message from tagged data (prefer 'error' or 'message' property, or tag itself)
    const errorMessage =
      (typeof taggedData.error === "string" ? taggedData.error : null) ||
      (typeof taggedData.message === "string" ? taggedData.message : null) ||
      (message !== "Error" ? message : null) ||
      (tagValue ? String(tagValue) : "Error");

    // Create tagged payload
    const taggedPayload = { ...taggedData };

    return {
      success: false,
      error: errorMessage,
      message: message !== "Error" ? message : errorMessage,
      status,
      code,
      ...(stack !== undefined && { stack }),
      details: taggedPayload,
      match(_, onError) {
        const errorMsg = message !== "Error" ? message : errorMessage;
        const errorObj: ErrorInfo = {
          error: errorMessage,
          message: errorMsg,
          status,
          code,
        };
        if (stack !== undefined) errorObj.stack = stack;
        errorObj.details = taggedPayload;
        return onError(errorObj);
      },
      transform(_) {
        return this as unknown as Result<never>;
      },
      andThen(_) {
        return this as unknown as Result<never>;
      },
      recover(fn) {
        const errorMsg = message !== "Error" ? message : errorMessage;
        return fn({
          error: errorMessage,
          message: errorMsg,
          status,
          code,
          stack,
          details: taggedPayload,
        });
      },
      async transformAsync(_) {
        return this as unknown as Result<never>;
      },
      async andThenAsync(_) {
        return this as unknown as Result<never>;
      },
    };
  }

  // Original behavior for string error
  const error = errorOrTagged as string;
  const details = detailsOrTagName as ErrorDetails | undefined;

  return {
    success: false,
    error,
    message,
    status,
    code,
    ...(stack !== undefined && { stack }),
    ...(details !== undefined && { details }),
    match(_, onError) {
      const errorObj: ErrorInfo = { error, message, status, code };
      if (stack !== undefined) errorObj.stack = stack;
      if (details !== undefined) errorObj.details = details;
      return onError(errorObj);
    },
    transform(_) {
      return this as unknown as Result<never>;
    },
    andThen(_) {
      return this as unknown as Result<never>;
    },
    recover(fn) {
      return fn({ error, message, status, code, stack, details });
    },
    async transformAsync(_) {
      return this as unknown as Result<never>;
    },
    async andThenAsync(_) {
      return this as unknown as Result<never>;
    },
  };
}

const getErrorDetails = (e: unknown): ErrorDetails | undefined => {
  if (e && typeof e === "object") {
    const errorObj = e as Record<string, unknown>;
    const extractedDetails: ErrorDetails = {};
    for (const [key, value] of Object.entries(errorObj)) {
      if (key !== "message" && key !== "name" && key !== "stack") {
        extractedDetails[key] = value;
      }
    }
    return Object.keys(extractedDetails).length > 0 ? extractedDetails : undefined;
  }
  return undefined;
};

const safe = <T>(fn: () => T | Result<T>): Result<T> => {
  try {
    const result = fn();
    // If function already returns a Result, use it
    if (isResult<T>(result)) {
      return result;
    }

    // Otherwise wrap the value
    return ok(result);
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const stack = error.stack;
    const details = getErrorDetails(e);

    return err(
      error.message || "Operation failed",
      "Operation failed",
      500,
      "ERROR",
      stack,
      details,
    );
  }
};

const safeAsync = async <T>(fn: () => Promise<T | Result<T>>): Promise<Result<T>> => {
  try {
    const result = await fn();
    // If function already returns a Result, use it
    if (isResult<T>(result)) {
      return result;
    }
    // Otherwise wrap the value
    return ok(result);
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const stack = error.stack;
    const details = getErrorDetails(e);

    return err(
      error.message || "Operation failed",
      "Operation failed",
      500,
      "ASYNC_ERROR",
      stack,
      details,
    );
  }
};

function when<T>(condition: boolean, value: T, defaultValue: T): T;
function when<T>(condition: boolean, value: T): T | undefined;
function when<T>(condition: boolean, value: T, defaultValue?: T): T | undefined {
  return condition ? value : defaultValue;
}

const whenResult = <T>(
  condition: boolean,
  value: T,
  errorMessage: string = "Condition not met",
  errorCode: string = "CONDITION_FAILED",
  statusCode: number = 400,
): Result<T> => (condition ? ok(value) : err(errorMessage, errorMessage, statusCode, errorCode));

const matchCode = <T>(
  code: string,
  overrides: Record<string, T>,
  defaultValue?: T,
): T | undefined => {
  // Direct match check using 'in' operator to handle falsy values correctly
  if (code in overrides) {
    return overrides[code];
  }

  // Pattern matching for wildcards
  const patterns = Object.keys(overrides).filter((key) => key.includes("*"));
  for (const pattern of patterns) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    if (regex.test(code)) {
      return overrides[pattern];
    }
  }

  return defaultValue;
};

const matchCodeResult = <T>(
  code: string,
  overrides: Record<string, T | (() => T | Result<T>)>,
  errorMessage: string = `No match found for code: ${code}`,
  errorCode: string = "CODE_NOT_FOUND",
  statusCode: number = 404,
): Result<T> => {
  const matched = matchCode(code, overrides);
  if (matched !== undefined) {
    const value = typeof matched === "function" ? (matched as Function)() : matched;
    return isResult<T>(value) ? value : ok(value as T);
  }
  return err(errorMessage, errorMessage, statusCode, errorCode);
};

const matchStatus = <T>(
  status: number,
  overrides: Record<number, T>,
  defaultValue?: T,
): T | undefined => (status in overrides ? overrides[status] : defaultValue);

const matchStatusResult = <T>(
  status: number,
  overrides: Record<number, T | (() => T | Result<T>)>,
  errorMessage: string = `No match found for status: ${status}`,
  errorCode: string = "STATUS_NOT_FOUND",
  statusCode: number = 404,
): Result<T> => {
  const matched = matchStatus(status, overrides);
  if (matched !== undefined) {
    const value = typeof matched === "function" ? (matched as Function)() : matched;
    return isResult<T>(value) ? value : ok(value as T);
  }
  return err(errorMessage, errorMessage, statusCode, errorCode);
};

const matchResult = <T, R>(
  result: Result<T>,
  handlers: {
    ok: (data: T) => R;
    err: (error: ErrorInfo) => R;
  },
): R => {
  if (result.success) {
    return handlers.ok(result.data);
  } else {
    const errorInfo: ErrorInfo = {
      error: result.error,
      message: result.message,
      status: result.status,
      code: result.code,
    };
    if (result.stack !== undefined) {
      errorInfo.stack = result.stack;
    }
    if (result.details !== undefined) {
      errorInfo.details = result.details;
    }
    return handlers.err(errorInfo);
  }
};

function tagged<TagValue extends string | number | boolean, T extends Record<string, unknown>>(
  value: TagValue,
  data: T,
  tagName?: string,
): T & { tag: TagValue };
function tagged<TagValue extends string | number | boolean>(
  value: TagValue,
  tagName?: string,
): <T extends Record<string, unknown>>(data: T) => T & { tag: TagValue };
function tagged(value: any, arg2?: any, arg3?: any): any {
  if (typeof arg2 === "object" && arg2 !== null) {
    const data = arg2;
    const tagName = arg3 || "tag";
    return { ...data, [tagName]: value };
  }
  const tagName = arg2 || "tag";
  return (data: any) => ({ ...data, [tagName]: value });
}

function taggedWith<
  Tag extends string,
  TagValue extends string | number | boolean,
  T extends Record<string, unknown>,
>(tag: Tag, value: TagValue, data: T): T & { [K in Tag]: TagValue };
function taggedWith<Tag extends string, TagValue extends string | number | boolean>(
  tag: Tag,
  value: TagValue,
): <T extends Record<string, unknown>>(data: T) => T & { [K in Tag]: TagValue };
function taggedWith(tag: any, value: any, arg3?: any): any {
  if (typeof arg3 === "object" && arg3 !== null) {
    const data = arg3;
    return { ...data, [tag]: value };
  }
  return (data: any) => ({ ...data, [tag]: value });
}

type MatchHandlers<
  T extends { [K in TagName]: string | number | boolean },
  R,
  TagName extends string = "tag",
> = {
  [K in Extract<T[TagName], PropertyKey>]?: (
    payload: Omit<Extract<T, { [P in TagName]: K }>, TagName>,
  ) => R;
} & {
  error?: (error: ErrorInfo) => R;
  default?: (payload: unknown) => R;
  [key: string]: any;
};

const match = <
  T extends { [K in TagName]: string | number | boolean },
  TagName extends string = "tag",
  Handlers extends MatchHandlers<T, any, TagName> = MatchHandlers<T, any, TagName>,
>(
  result: Result<T>,
  handlers: Handlers,
  tagName: TagName = "tag" as TagName,
): Result<Handlers[keyof Handlers] extends (...args: any[]) => infer R ? R : never> => {
  type ReturnVal = Handlers[keyof Handlers] extends (...args: any[]) => infer R ? R : never;

  if (!result.success) {
    // 1. Try to match on tag value in error details
    if (result.details && typeof result.details === "object") {
      const tagValue = (result.details as Record<string, unknown>)[tagName] as
        | T[TagName]
        | undefined;

      if (tagValue !== undefined && tagValue !== null) {
        const handler = handlers[String(tagValue)];
        if (typeof handler === "function") {
          const { [tagName]: _, ...payload } = result.details as Record<string, unknown>;
          return ok(handler(payload) as ReturnVal);
        }
      }
    }

    // 2. If no match, use error handler
    if (handlers.error) {
      const errorInfo: ErrorInfo = {
        error: result.error,
        message: result.message,
        status: result.status,
        code: result.code,
        stack: result.stack,
        details: result.details,
      };
      return ok(handlers.error(errorInfo) as ReturnVal);
    }

    // 3. If no error handler, use default handler
    if (handlers.default) {
      return ok(handlers.default(result.details || {}) as ReturnVal);
    }

    // 4. If no handlers match, return the original error Result
    return result as unknown as Result<ReturnVal>;
  }

  // Success path
  const data = result.data as Record<string, unknown>;
  const tagValue = data[tagName] as T[TagName] | undefined;

  if (tagValue !== undefined && tagValue !== null) {
    const handler = handlers[String(tagValue)];
    if (typeof handler === "function") {
      const { [tagName]: _, ...payload } = data;
      return ok(handler(payload) as ReturnVal);
    }
  }

  // Try default fallback for success
  if (handlers.default) {
    return ok(handlers.default(result.data) as ReturnVal);
  }

  return err(
    `No handler found for tag value: ${String(tagValue)}`,
    "Match error",
    500,
    "MATCH_ERROR",
  ) as unknown as Result<ReturnVal>;
};

function isTagged(value: unknown): value is { tag: string | number | boolean };
function isTagged<Tag extends string, TagValue extends string | number | boolean>(
  value: unknown,
  tag: Tag,
  tagValue: TagValue,
): value is { [K in Tag]: TagValue };
function isTagged(value: unknown, tag?: string, tagValue?: any): boolean {
  const t = tag || "tag";
  const hasTag = typeof value === "object" && value !== null && t in value;
  if (!hasTag) return false;
  if (tagValue !== undefined) {
    return (value as Record<string, unknown>)[t] === tagValue;
  }
  return true;
}

const isResult = <T>(value: unknown): value is Result<T> => {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as Result<T>).success === "boolean" &&
    "match" in value &&
    typeof (value as Result<T>).match === "function"
  );
};

const isSuccess = <T>(result: Result<T>): result is SuccessResult<T> => result.success;
const isError = <T>(result: Result<T>): result is ErrorResult => !result.success;
const isOk = <T>(result: Result<T>): result is SuccessResult<T> => result.success;
const isErr = <T>(result: Result<T>): result is ErrorResult => !result.success;

export {
  ok,
  err,
  safe,
  safeAsync,
  when,
  whenResult,
  matchCode,
  matchCodeResult,
  matchStatus,
  matchStatusResult,
  matchResult,
  tagged,
  taggedWith,
  match,
  isTagged,
  isResult,
  isSuccess,
  isError,
  isOk,
  isErr,
};

export type { Result, SuccessResult, ErrorResult, ErrorInfo, ErrorDetails };

export const all = <T>(results: Result<T>[]): Result<T[]> => {
  const data: T[] = [];
  for (const result of results) {
    if (!result.success) return result as unknown as Result<T[]>;
    data.push(result.data);
  }
  return ok(data);
};

export const allSettled = <T>(results: Result<T>[]): Result<{ data: T[]; errors: ErrorInfo[] }> => {
  const data: T[] = [];
  const errors: ErrorInfo[] = [];
  for (const r of results) {
    if (r.success) data.push(r.data);
    else errors.push(r as unknown as ErrorInfo);
  }
  return ok({ data, errors });
};

export const combine = <T>(results: Result<T>[]): Result<Result<T>[]> => {
  return ok(results);
};

export const tryValue = safe;
export const tryAsync = safeAsync;

export function RetryConditionAlways() {
  return true;
}

export function RetryConditionNever() {
  return false;
}

// https://github.com/cloudflare/actors/blob/9ba112503132ddf6b5cef37ff145e7a2dd5ffbfc/packages/core/src/retries.ts
export async function tryWhile<T>(
  fn: (attempt: number) => Promise<T>,
  isRetryable: (err: unknown, nextAttempt: number) => boolean,
  options?: {
    baseDelayMs?: number;
    maxDelayMs?: number;

    verbose?: boolean;
  },
): Promise<T> {
  const baseDelayMs = Math.floor(options?.baseDelayMs ?? 100);
  const maxDelayMs = Math.floor(options?.maxDelayMs ?? 3000);
  if (baseDelayMs <= 0 || maxDelayMs <= 0) {
    throw new Error("baseDelayMs and maxDelayMs must be greater than 0");
  }
  if (baseDelayMs >= maxDelayMs) {
    throw new Error("baseDelayMs must be less than maxDelayMs");
  }
  let attempt = 1;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (options?.verbose) {
        console.info({
          message: "tryWhile",
          attempt,
          error: String(err),
          errorProps: err,
        });
      }
      attempt += 1;
      if (!isRetryable(err, attempt)) {
        throw err;
      }
      const delay = jitterBackoff(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export type TryNOptions = {
  /**
   * @param err Error thrown by the function.
   * @param nextAttempt Number of next attempt to make.
   * @returns Returns true if the error and nextAttempt number is retryable.
   */
  isRetryable?: (err: unknown, nextAttempt: number) => boolean;

  /**
   * Number of milliseconds to use as multiplier for the exponential backoff.
   */
  baseDelayMs?: number;
  /**
   * Maximum number of milliseconds to wait.
   */
  maxDelayMs?: number;

  /**
   * If true, logs the error and attempt number to the console.
   */
  verbose?: boolean;
};

export async function tryN<T>(
  n: number,
  fn: (attempt: number) => Promise<T>,
  options?: TryNOptions,
): Promise<T> {
  if (n <= 0) {
    throw new Error("n must be greater than 0");
  }
  n = Math.floor(n);

  return await tryWhile(
    fn,
    (err: unknown, nextAttempt: number) => {
      return nextAttempt <= n && (options?.isRetryable?.(err, nextAttempt) ?? true);
    },
    options,
  );
}

export function jitterBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const attemptUpperBoundMs = Math.min(2 ** attempt * baseDelayMs, maxDelayMs);
  return Math.floor(Math.random() * attemptUpperBoundMs);
}

export function isErrorRetryable(err: unknown): boolean {
  const msg = String(err);
  return (
    Boolean((err as any)?.retryable) &&
    !(err as any)?.overloaded &&
    !msg.includes("Durable Object is overloaded")
  );
}
