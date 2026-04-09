const ok = (data, message = "Success", status = 200, code = "OK") => ({
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
    return this;
  },
  async transformAsync(fn) {
    return ok(await fn(data));
  },
  async andThenAsync(fn) {
    return await fn(data);
  },
});
function err(
  errorOrTagged,
  message = "Error",
  status = 500,
  code = "ERROR",
  stack,
  detailsOrTagName,
  tagName = "tag",
) {
  // Check if first argument is tagged data
  const actualTagName =
    (typeof detailsOrTagName === "string" ? detailsOrTagName : tagName) || tagName;
  const isTaggedData =
    typeof errorOrTagged === "object" &&
    errorOrTagged !== null &&
    (actualTagName in errorOrTagged || "tag" in errorOrTagged);
  if (isTaggedData) {
    const taggedData = errorOrTagged;
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
        const errorObj = {
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
        return this;
      },
      andThen(_) {
        return this;
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
        return this;
      },
      async andThenAsync(_) {
        return this;
      },
    };
  }
  // Original behavior for string error
  const error = errorOrTagged;
  const details = detailsOrTagName;
  return {
    success: false,
    error,
    message,
    status,
    code,
    ...(stack !== undefined && { stack }),
    ...(details !== undefined && { details }),
    match(_, onError) {
      const errorObj = { error, message, status, code };
      if (stack !== undefined) errorObj.stack = stack;
      if (details !== undefined) errorObj.details = details;
      return onError(errorObj);
    },
    transform(_) {
      return this;
    },
    andThen(_) {
      return this;
    },
    recover(fn) {
      return fn({ error, message, status, code, stack, details });
    },
    async transformAsync(_) {
      return this;
    },
    async andThenAsync(_) {
      return this;
    },
  };
}
const getErrorDetails = (e) => {
  if (e && typeof e === "object") {
    const errorObj = e;
    const extractedDetails = {};
    for (const [key, value] of Object.entries(errorObj)) {
      if (key !== "message" && key !== "name" && key !== "stack") {
        extractedDetails[key] = value;
      }
    }
    return Object.keys(extractedDetails).length > 0 ? extractedDetails : undefined;
  }
  return undefined;
};
const safe = (fn) => {
  try {
    const result = fn();
    // If function already returns a Result, use it
    if (isResult(result)) {
      return result;
    }
    // Otherwise wrap the value
    return ok(result);
  } catch (e) {
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
const safeAsync = async (fn) => {
  try {
    const result = await fn();
    // If function already returns a Result, use it
    if (isResult(result)) {
      return result;
    }
    // Otherwise wrap the value
    return ok(result);
  } catch (e) {
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
function when(condition, value, defaultValue) {
  return condition ? value : defaultValue;
}
const whenResult = (
  condition,
  value,
  errorMessage = "Condition not met",
  errorCode = "CONDITION_FAILED",
  statusCode = 400,
) => (condition ? ok(value) : err(errorMessage, errorMessage, statusCode, errorCode));
const matchCode = (code, overrides, defaultValue) => {
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
const matchCodeResult = (
  code,
  overrides,
  errorMessage = `No match found for code: ${code}`,
  errorCode = "CODE_NOT_FOUND",
  statusCode = 404,
) => {
  const matched = matchCode(code, overrides);
  if (matched !== undefined) {
    const value = typeof matched === "function" ? matched() : matched;
    return isResult(value) ? value : ok(value);
  }
  return err(errorMessage, errorMessage, statusCode, errorCode);
};
const matchStatus = (status, overrides, defaultValue) =>
  status in overrides ? overrides[status] : defaultValue;
const matchStatusResult = (
  status,
  overrides,
  errorMessage = `No match found for status: ${status}`,
  errorCode = "STATUS_NOT_FOUND",
  statusCode = 404,
) => {
  const matched = matchStatus(status, overrides);
  if (matched !== undefined) {
    const value = typeof matched === "function" ? matched() : matched;
    return isResult(value) ? value : ok(value);
  }
  return err(errorMessage, errorMessage, statusCode, errorCode);
};
const matchResult = (result, handlers) => {
  if (result.success) {
    return handlers.ok(result.data);
  } else {
    const errorInfo = {
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
function tagged(value, arg2, arg3) {
  if (typeof arg2 === "object" && arg2 !== null) {
    const data = arg2;
    const tagName = arg3 || "tag";
    return { ...data, [tagName]: value };
  }
  const tagName = arg2 || "tag";
  return (data) => ({ ...data, [tagName]: value });
}
function taggedWith(tag, value, arg3) {
  if (typeof arg3 === "object" && arg3 !== null) {
    const data = arg3;
    return { ...data, [tag]: value };
  }
  return (data) => ({ ...data, [tag]: value });
}
const match = (result, handlers, tagName = "tag") => {
  if (!result.success) {
    // 1. Try to match on tag value in error details
    if (result.details && typeof result.details === "object") {
      const tagValue = result.details[tagName];
      if (tagValue !== undefined && tagValue !== null) {
        const handler = handlers[String(tagValue)];
        if (typeof handler === "function") {
          const { [tagName]: _, ...payload } = result.details;
          return ok(handler(payload));
        }
      }
    }
    // 2. If no match, use error handler
    if (handlers.error) {
      const errorInfo = {
        error: result.error,
        message: result.message,
        status: result.status,
        code: result.code,
        stack: result.stack,
        details: result.details,
      };
      return ok(handlers.error(errorInfo));
    }
    // 3. If no error handler, use default handler
    if (handlers.default) {
      return ok(handlers.default(result.details || {}));
    }
    // 4. If no handlers match, return the original error Result
    return result;
  }
  // Success path
  const data = result.data;
  const tagValue = data[tagName];
  if (tagValue !== undefined && tagValue !== null) {
    const handler = handlers[String(tagValue)];
    if (typeof handler === "function") {
      const { [tagName]: _, ...payload } = data;
      return ok(handler(payload));
    }
  }
  // Try default fallback for success
  if (handlers.default) {
    return ok(handlers.default(result.data));
  }
  return err(
    `No handler found for tag value: ${String(tagValue)}`,
    "Match error",
    500,
    "MATCH_ERROR",
  );
};
function isTagged(value, tag, tagValue) {
  const t = tag || "tag";
  const hasTag = typeof value === "object" && value !== null && t in value;
  if (!hasTag) return false;
  if (tagValue !== undefined) {
    return value[t] === tagValue;
  }
  return true;
}
const isResult = (value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof value.success === "boolean" &&
    "match" in value &&
    typeof value.match === "function"
  );
};
const isSuccess = (result) => result.success;
const isError = (result) => !result.success;
const isOk = (result) => result.success;
const isErr = (result) => !result.success;
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
export const all = (results) => {
  const data = [];
  for (const result of results) {
    if (!result.success) return result;
    data.push(result.data);
  }
  return ok(data);
};
export const allSettled = (results) => {
  const data = [];
  const errors = [];
  for (const r of results) {
    if (r.success) data.push(r.data);
    else errors.push(r);
  }
  return ok({ data, errors });
};
export const combine = (results) => {
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
export async function tryWhile(fn, isRetryable, options) {
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
export async function tryN(n, fn, options) {
  if (n <= 0) {
    throw new Error("n must be greater than 0");
  }
  n = Math.floor(n);
  return await tryWhile(
    fn,
    (err, nextAttempt) => {
      return nextAttempt <= n && (options?.isRetryable?.(err, nextAttempt) ?? true);
    },
    options,
  );
}
export function jitterBackoff(attempt, baseDelayMs, maxDelayMs) {
  const attemptUpperBoundMs = Math.min(2 ** attempt * baseDelayMs, maxDelayMs);
  return Math.floor(Math.random() * attemptUpperBoundMs);
}
export function isErrorRetryable(err) {
  const msg = String(err);
  return (
    Boolean(err?.retryable) && !err?.overloaded && !msg.includes("Durable Object is overloaded")
  );
}
