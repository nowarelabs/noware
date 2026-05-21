import { describe, expect, test, vi } from "vite-plus/test";
import {
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
  all,
  allSettled,
  combine,
  tryValue,
  tryAsync,
  RetryConditionAlways,
  RetryConditionNever,
  tryWhile,
  tryN,
  jitterBackoff,
  isErrorRetryable,
  type Result,
  type ErrorInfo,
} from "../src/index.ts";

describe("ok", () => {
  test("creates successful result with default values", () => {
    const result = ok("test value");
    expect(result.success).toBe(true);
    expect(result.data).toBe("test value");
    expect(result.message).toBe("Success");
    expect(result.status).toBe(200);
    expect(result.code).toBe("OK");
  });

  test("creates successful result with custom values", () => {
    const result = ok("data", "Created", 201, "CREATED");
    expect(result.success).toBe(true);
    expect(result.data).toBe("data");
    expect(result.message).toBe("Created");
    expect(result.status).toBe(201);
    expect(result.code).toBe("CREATED");
  });

  test("match returns data on success", () => {
    const result = ok(42);
    const value = result.match(
      (data) => data * 2,
      () => 0,
    );
    expect(value).toBe(84);
  });

  test("transform modifies data", () => {
    const result = ok(10);
    const transformed = result.transform((data) => data * 5);
    expect(transformed.success).toBe(true);
    expect(transformed.data).toBe(50);
  });

  test("andThen chains results", () => {
    const result = ok(5).andThen((data) => ok(data * 2));
    expect(result.success).toBe(true);
    expect(result.data).toBe(10);
  });

  test("andThen can return error", () => {
    const result = ok(5).andThen(() => err("failed"));
    expect(result.success).toBe(false);
    expect(result.error).toBe("failed");
  });

  test("recover does not affect success result", () => {
    const result = ok("good").recover(() => err("ignored"));
    expect(result.success).toBe(true);
    expect(result.data).toBe("good");
  });

  test("transformAsync returns Promise of Result", async () => {
    const result = ok(10);
    const asyncResult = result.transformAsync(async (data) => data * 2);
    const final = await asyncResult;
    expect(final.success).toBe(true);
    expect(final.data).toBe(20);
  });

  test("andThenAsync chains async results", async () => {
    const result = ok(5).andThenAsync(async (data) => ok(data + 10));
    const final = await result;
    expect(final.success).toBe(true);
    expect(final.data).toBe(15);
  });

  test("handles complex objects", () => {
    const data = { name: "test", items: [1, 2, 3] };
    const result = ok(data);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
  });
});

describe("err", () => {
  test("creates error result with default values", () => {
    const result = err("Something went wrong");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong");
    expect(result.message).toBe("Error");
    expect(result.status).toBe(500);
    expect(result.code).toBe("ERROR");
  });

  test("creates error result with custom values", () => {
    const result = err("Not found", "Resource missing", 404, "NOT_FOUND");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not found");
    expect(result.message).toBe("Resource missing");
    expect(result.status).toBe(404);
    expect(result.code).toBe("NOT_FOUND");
  });

  test("creates error result with stack trace", () => {
    const stack = "Error: test\n    at line 1";
    const result = err("Error", "Error", 500, "ERROR", stack);
    expect(result.stack).toBe(stack);
  });

  test("creates error result with details", () => {
    const details = { field: "email", reason: "invalid" };
    const result = err(
      "Validation failed",
      "Validation failed",
      400,
      "VALIDATION_ERROR",
      undefined,
      details,
    );
    expect(result.details).toEqual(details);
  });

  test("match returns error on error result", () => {
    const result = err("error message", "Error", 500, "ERROR");
    const value = result.match(
      () => "success",
      (error) => error.message,
    );
    expect(value).toBe("Error");
  });

  test("transform returns same error result", () => {
    const result: Result<string> = err("fail");
    const transformed = result.transform((data: string) => data.toUpperCase());
    expect(transformed.success).toBe(false);
    expect(transformed.error).toBe("fail");
  });

  test("andThen returns same error result", () => {
    const result = err("fail");
    const chained = result.andThen((data) => ok(data));
    expect(chained.success).toBe(false);
    expect(chained.error).toBe("fail");
  });

  test("recover transforms error to success", () => {
    const result = err("original").recover(() => ok("recovered"));
    expect(result.success).toBe(true);
    expect(result.data).toBe("recovered");
  });

  test("recover can transform error to different error", () => {
    const result = err("original").recover(() => err("new error"));
    expect(result.success).toBe(false);
    expect(result.error).toBe("new error");
  });

  test("transformAsync returns same error", async () => {
    const result = err("fail");
    const asyncResult = result.transformAsync(async (data) => data);
    const final = await asyncResult;
    expect(final.success).toBe(false);
    expect(final.error).toBe("fail");
  });

  test("andThenAsync returns same error", async () => {
    const result = err("fail");
    const asyncResult = result.andThenAsync(async (data) => ok(data));
    const final = await asyncResult;
    expect(final.success).toBe(false);
    expect(final.error).toBe("fail");
  });

  test("handles tagged data with default tag", () => {
    const taggedData = { tag: "NOT_FOUND", id: 123 };
    const result = err(taggedData as any, "Not found", 404, "NOT_FOUND");
    expect(result.success).toBe(false);
    expect(result.details?.tag).toBe("NOT_FOUND");
    expect(result.details?.id).toBe(123);
  });

  test("handles tagged data with custom tag name", () => {
    const taggedData = { errorType: "TIMEOUT", timeout: 30000 };
    const result = err(taggedData as any, "Timeout", 408, "TIMEOUT", undefined, "errorType");
    expect(result.success).toBe(false);
    expect(result.details?.errorType).toBe("TIMEOUT");
    expect(result.details?.timeout).toBe(30000);
  });

  test("extracts error message from tagged data 'error' property", () => {
    const taggedData = { tag: "VALIDATION", error: "Invalid email format" };
    const result = err(taggedData as any, "Validation failed", 400, "VALIDATION");
    expect(result.error).toBe("Invalid email format");
  });

  test("extracts error message from tagged data 'message' property", () => {
    const taggedData = { tag: "VALIDATION", message: "Email is required" };
    const result = err(taggedData as any, "Validation failed", 400, "VALIDATION");
    expect(result.error).toBe("Email is required");
  });
});

describe("safe", () => {
  test("wraps successful function", () => {
    const result = safe(() => 42);
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  test("catches synchronous errors", () => {
    const result = safe(() => {
      throw new Error("sync error");
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("sync error");
  });

  test("returns existing Result from function", () => {
    const result = safe(() => ok("already result"));
    expect(result.success).toBe(true);
    expect(result.data).toBe("already result");
  });

  test("includes stack trace in error", () => {
    const result = safe(() => {
      throw new Error("with stack");
    });
    expect(result.success).toBe(false);
    expect(result.stack).toBeDefined();
  });

  test("extracts error details from error object", () => {
    const customError = new Error("custom") as Error & { code: string; status: number };
    customError.code = "ERR_CODE";
    customError.status = 400;
    const result = safe(() => {
      throw customError;
    });
    expect(result.success).toBe(false);
    expect(result.details?.code).toBe("ERR_CODE");
    expect(result.details?.status).toBe(400);
  });

  test("handles non-Error thrown values", () => {
    const result = safe(() => {
      throw "string error";
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("string error");
  });

  test("handles objects thrown as errors", () => {
    const result = safe(() => {
      throw { message: "obj error", code: 123 };
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Operation failed");
    expect(result.details?.code).toBe(123);
  });
});

describe("safeAsync", () => {
  test("wraps successful async function", async () => {
    const result = await safeAsync(async () => 42);
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  test("catches async errors", async () => {
    const result = await safeAsync(async () => {
      throw new Error("async error");
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("async error");
  });

  test("returns existing Result from async function", async () => {
    const result = await safeAsync(async () => ok("already result"));
    expect(result.success).toBe(true);
    expect(result.data).toBe("already result");
  });

  test("includes stack trace in async error", async () => {
    const result = await safeAsync(async () => {
      throw new Error("async with stack");
    });
    expect(result.success).toBe(false);
    expect(result.stack).toBeDefined();
  });

  test("uses ASYNC_ERROR code for async errors", async () => {
    const result = await safeAsync(async () => {
      throw new Error("async error");
    });
    expect(result.code).toBe("ASYNC_ERROR");
  });
});

describe("when", () => {
  test("returns value when condition is true", () => {
    const result = when(true, "value");
    expect(result).toBe("value");
  });

  test("returns undefined when condition is false and no default", () => {
    const result = when(false, "value");
    expect(result).toBe(undefined);
  });

  test("returns defaultValue when condition is false", () => {
    const result = when(false, "value", "default");
    expect(result).toBe("default");
  });

  test("handles falsy values correctly", () => {
    expect(when(true, 0, 1)).toBe(0);
    expect(when(false, 0, 1)).toBe(1);
    expect(when(true, "", "default")).toBe("");
    expect(when(false, "", "default")).toBe("default");
  });
});

describe("whenResult", () => {
  test("returns ok result when condition is true", () => {
    const result = whenResult(true, "value");
    expect(result.success).toBe(true);
    expect(result.data).toBe("value");
  });

  test("returns error result when condition is false", () => {
    const result = whenResult(false, "value");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Condition not met");
  });

  test("uses custom error message", () => {
    const result = whenResult(false, "value", "Custom error");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Custom error");
    expect(result.code).toBe("CONDITION_FAILED");
    expect(result.status).toBe(400);
  });

  test("uses custom error code", () => {
    const result = whenResult(false, "value", "Error", "INVALID");
    expect(result.code).toBe("INVALID");
  });

  test("uses custom status code", () => {
    const result = whenResult(false, "value", "Error", "INVALID", 422);
    expect(result.status).toBe(422);
  });
});

describe("matchCode", () => {
  test("returns value for exact code match", () => {
    const result = matchCode("OK", { OK: "success", ERROR: "fail" });
    expect(result).toBe("success");
  });

  test("returns undefined for no match", () => {
    const result = matchCode("UNKNOWN", { OK: "success", ERROR: "fail" });
    expect(result).toBe(undefined);
  });

  test("uses default value when no match", () => {
    const result = matchCode("UNKNOWN", { OK: "success" }, "default");
    expect(result).toBe("default");
  });

  test("supports wildcard pattern matching", () => {
    const handlers = {
      "NETWORK_*": "network error",
      "AUTH_*": "auth error",
    };
    expect(matchCode("NETWORK_TIMEOUT", handlers)).toBe("network error");
    expect(matchCode("AUTH_EXPIRED", handlers)).toBe("auth error");
    expect(matchCode("UNKNOWN", handlers)).toBe(undefined);
  });

  test("handles falsy values correctly", () => {
    const handlers = { OK: 0, ERROR: 1 };
    expect(matchCode("OK", handlers)).toBe(0);
    expect(matchCode("UNKNOWN", handlers, -1)).toBe(-1);
  });
});

describe("matchCodeResult", () => {
  test("returns ok with value for matched code", () => {
    const result = matchCodeResult("OK", { OK: "success" });
    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
  });

  test("returns error for unmatched code", () => {
    const result = matchCodeResult("UNKNOWN", { OK: "success" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("No match found for code: UNKNOWN");
  });

  test("executes function handlers", () => {
    const result = matchCodeResult("DYNAMIC", {
      DYNAMIC: () => "computed",
    });
    expect(result.success).toBe(true);
    expect(result.data).toBe("computed");
  });

  test("wraps non-Result function return in ok", () => {
    const result = matchCodeResult("WRAP", {
      WRAP: () => "wrapped",
    });
    expect(result.success).toBe(true);
    expect(result.data).toBe("wrapped");
  });

  test("returns Result from function handler as-is", () => {
    const result = matchCodeResult("PRESERVE", {
      PRESERVE: () => err("preserve error"),
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("preserve error");
  });
});

describe("matchStatus", () => {
  test("returns value for exact status match", () => {
    const result = matchStatus(200, { 200: "ok", 404: "not found" });
    expect(result).toBe("ok");
  });

  test("returns undefined for no match", () => {
    const result = matchStatus(500, { 200: "ok" });
    expect(result).toBe(undefined);
  });

  test("uses default value when no match", () => {
    const result = matchStatus(500, { 200: "ok" }, "error");
    expect(result).toBe("error");
  });
});

describe("matchStatusResult", () => {
  test("returns ok with value for matched status", () => {
    const result = matchStatusResult(200, { 200: "success" });
    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
  });

  test("returns error for unmatched status", () => {
    const result = matchStatusResult(500, { 200: "ok" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("No match found for status: 500");
    expect(result.status).toBe(404);
    expect(result.code).toBe("STATUS_NOT_FOUND");
  });
});

describe("matchResult", () => {
  test("calls ok handler on success", () => {
    const result = ok(42);
    const value = matchResult(result, {
      ok: (data) => data * 2,
      err: () => 0,
    });
    expect(value).toBe(84);
  });

  test("calls err handler on error", () => {
    const result = err("error");
    const value = matchResult(result, {
      ok: () => 0,
      err: (error) => error.status,
    });
    expect(value).toBe(500);
  });

  test("passes error info to err handler", () => {
    const result = err("fail", "Failed", 400, "BAD_REQUEST");
    const info = matchResult(result, {
      ok: () => ({}) as ErrorInfo,
      err: (error) => error,
    });
    expect(info.error).toBe("fail");
    expect(info.message).toBe("Failed");
    expect(info.status).toBe(400);
    expect(info.code).toBe("BAD_REQUEST");
  });

  test("includes stack in error info when present", () => {
    const result = err("fail", "Failed", 500, "ERROR", "stack trace");
    const info = matchResult(result, {
      ok: () => ({}) as ErrorInfo,
      err: (error) => error,
    });
    expect(info.stack).toBe("stack trace");
  });

  test("includes details in error info when present", () => {
    const details = { field: "email" };
    const result = err("fail", "Failed", 400, "ERROR", undefined, details);
    const info = matchResult(result, {
      ok: () => ({}) as ErrorInfo,
      err: (error) => error,
    });
    expect(info.details).toEqual(details);
  });
});

describe("tagged", () => {
  test("creates tagged object with data", () => {
    const result = tagged("error", { message: "oops" });
    expect(result).toEqual({ message: "oops", tag: "error" });
  });

  test("creates tagged object with custom tag name", () => {
    const result = tagged("timeout", { retry: true }, "errorType");
    expect(result).toEqual({ retry: true, errorType: "timeout" });
  });

  test("returns curried function when no data provided", () => {
    const tagger = tagged("status");
    const result = tagger({ code: 200 });
    expect(result).toEqual({ code: 200, tag: "status" });
  });

  test("curried function uses custom tag name", () => {
    const tagger = tagged("type", "kind");
    const result = tagger({ value: 42 });
    expect(result).toEqual({ value: 42, kind: "type" });
  });
});

describe("taggedWith", () => {
  test("creates tagged object with data", () => {
    const result = taggedWith("type", "error", { message: "oops" });
    expect(result).toEqual({ message: "oops", type: "error" });
  });

  test("returns curried function when no data provided", () => {
    const tagger = taggedWith("status", 200);
    const result = tagger({ code: "OK" });
    expect(result).toEqual({ code: "OK", status: 200 });
  });
});

describe("match", () => {
  test("matches on success result with tag", () => {
    const result = ok({ tag: "created", id: 123 }) as Result<{ tag: string; id: number }>;
    const matched = match(result, {
      created: (payload) => `Created: ${payload.id}`,
    });
    expect(matched.success).toBe(true);
    expect(matched.data).toBe("Created: 123");
  });

  test("matches on error result with tag in details", () => {
    const result = err("error", "Error", 404, "NOT_FOUND", undefined, {
      tag: "not_found",
      resource: "user",
    }) as Result<{ tag: "not_found"; resource: string }>;
    const matched = match(result, {
      not_found: (payload) => `Not found: ${payload.resource}`,
    });
    expect(matched.success).toBe(true);
    expect(matched.data).toBe("Not found: user");
  });

  test("uses error handler when no tag match", () => {
    const result = err("error", "Error", 500, "ERROR", undefined, { tag: "unknown" });
    const matched = match(result, {
      error: (err) => `Error: ${err.message}`,
    });
    expect(matched.success).toBe(true);
    expect(matched.data).toBe("Error: Error");
  });

  test("uses default handler when no match", () => {
    const result = err("error", "Error", 500, "ERROR", undefined, { tag: "unknown" });
    const matched = match(result, {
      default: () => "default handler",
    });
    expect(matched.success).toBe(true);
    expect(matched.data).toBe("default handler");
  });

  test("returns original error when no handlers match", () => {
    const result = err("fail", "Fail", 500, "ERROR");
    const matched = match(result, {});
    expect(matched.success).toBe(false);
    expect(matched.error).toBe("fail");
  });

  test("uses custom tag name", () => {
    const result = err("error", "Error", 404, "NOT_FOUND", undefined, { errorType: "not_found" });
    const matched = match(
      result,
      {
        not_found: () => "matched",
      },
      "errorType",
    );
    expect(matched.success).toBe(true);
    expect(matched.data).toBe("matched");
  });

  test("default handler for success without tag", () => {
    const result = ok({ name: "test" });
    const matched = match(result, {
      default: (data) => (data as any).name,
    });
    expect(matched.success).toBe(true);
    expect(matched.data).toBe("test");
  });
});

describe("type guards", () => {
  describe("isTagged", () => {
    test("returns true for tagged object", () => {
      expect(isTagged({ tag: "error" })).toBe(true);
    });

    test("returns false for non-tagged object", () => {
      expect(isTagged({ message: "hello" })).toBe(false);
    });

    test("returns false for null", () => {
      expect(isTagged(null)).toBe(false);
    });

    test("checks specific tag value", () => {
      expect(isTagged({ tag: "error" }, "tag", "error")).toBe(true);
      expect(isTagged({ tag: "error" }, "tag", "success")).toBe(false);
    });

    test("checks custom tag name", () => {
      expect(isTagged({ errorType: "timeout" }, "errorType")).toBe(true);
    });
  });

  describe("isResult", () => {
    test("returns true for ok result", () => {
      expect(isResult(ok("data"))).toBe(true);
    });

    test("returns true for err result", () => {
      expect(isResult(err("error"))).toBe(true);
    });

    test("returns false for non-result object", () => {
      expect(isResult({ success: true })).toBe(false);
      expect(isResult({ data: "test" })).toBe(false);
    });

    test("returns false for null", () => {
      expect(isResult(null)).toBe(false);
    });

    test("checks for match function", () => {
      expect(isResult({ success: true, match: () => {} })).toBe(true);
    });
  });

  describe("isSuccess / isOk", () => {
    test("returns true for ok result", () => {
      const result = ok("data");
      expect(isSuccess(result)).toBe(true);
      expect(isOk(result)).toBe(true);
    });

    test("returns false for err result", () => {
      const result = err("error");
      expect(isSuccess(result)).toBe(false);
      expect(isOk(result)).toBe(false);
    });
  });

  describe("isError / isErr", () => {
    test("returns true for err result", () => {
      const result = err("error");
      expect(isError(result)).toBe(true);
      expect(isErr(result)).toBe(true);
    });

    test("returns false for ok result", () => {
      const result = ok("data");
      expect(isError(result)).toBe(false);
      expect(isErr(result)).toBe(false);
    });
  });
});

describe("all", () => {
  test("returns ok with all data when all results are successful", () => {
    const results = [ok(1), ok(2), ok(3)];
    const combined = all(results);
    expect(combined.success).toBe(true);
    expect(combined.data).toEqual([1, 2, 3]);
  });

  test("returns first error when any result is an error", () => {
    const results = [ok(1), err("failed"), ok(3)];
    const combined = all(results);
    expect(combined.success).toBe(false);
    expect(combined.error).toBe("failed");
  });

  test("returns error on first failure", () => {
    const results = [err("first"), ok(2), err("third")];
    const combined = all(results);
    expect(combined.success).toBe(false);
    expect(combined.error).toBe("first");
  });

  test("handles empty array", () => {
    const combined = all([]);
    expect(combined.success).toBe(true);
    expect(combined.data).toEqual([]);
  });
});

describe("allSettled", () => {
  test("returns ok with all data and no errors when all successful", () => {
    const results = [ok(1), ok(2)];
    const combined = allSettled(results);
    expect(combined.success).toBe(true);
    expect(combined.data!.data).toEqual([1, 2]);
    expect(combined.data!.errors).toEqual([]);
  });

  test("collects errors alongside successful data", () => {
    const results = [ok(1), err("error1"), ok(2), err("error2")];
    const combined = allSettled(results);
    expect(combined.success).toBe(true);
    expect(combined.data!.data).toEqual([1, 2]);
    expect(combined.data!.errors).toHaveLength(2);
    expect(combined.data!.errors[0].error).toBe("error1");
    expect(combined.data!.errors[1].error).toBe("error2");
  });

  test("handles all errors", () => {
    const results = [err("error1"), err("error2")];
    const combined = allSettled(results);
    expect(combined.success).toBe(true);
    expect(combined.data!.data).toEqual([]);
    expect(combined.data!.errors).toHaveLength(2);
  });

  test("handles empty array", () => {
    const combined = allSettled([]);
    expect(combined.success).toBe(true);
    expect(combined.data!.data).toEqual([]);
    expect(combined.data!.errors).toEqual([]);
  });
});

describe("combine", () => {
  test("wraps array of results in ok", () => {
    const results = [ok(1), err("error"), ok(3)];
    const combined = combine(results);
    expect(combined.success).toBe(true);
    expect(combined.data).toEqual(results);
  });

  test("handles empty array", () => {
    const combined = combine([]);
    expect(combined.success).toBe(true);
    expect(combined.data).toEqual([]);
  });
});

describe("tryValue (alias of safe)", () => {
  test("works the same as safe", () => {
    const result = tryValue(() => "test");
    expect(result.success).toBe(true);
    expect(result.data).toBe("test");
  });
});

describe("tryAsync (alias of safeAsync)", () => {
  test("works the same as safeAsync", async () => {
    const result = await tryAsync(async () => "test");
    expect(result.success).toBe(true);
    expect(result.data).toBe("test");
  });
});

describe("RetryConditionAlways", () => {
  test("returns true", () => {
    expect(RetryConditionAlways()).toBe(true);
  });
});

describe("RetryConditionNever", () => {
  test("returns false", () => {
    expect(RetryConditionNever()).toBe(false);
  });
});

describe("tryWhile", () => {
  test("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await tryWhile(fn, () => true);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("stops retrying when isRetryable returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const isRetryable = vi.fn().mockReturnValue(false);

    await expect(tryWhile(fn, isRetryable)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(isRetryable).toHaveBeenCalledTimes(1);
  });

  test("throws if baseDelayMs <= 0", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    await expect(tryWhile(fn, () => true, { baseDelayMs: 0 })).rejects.toThrow();
  });

  test("throws if maxDelayMs <= 0", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    await expect(tryWhile(fn, () => true, { maxDelayMs: 0 })).rejects.toThrow();
  });

  test("throws if baseDelayMs >= maxDelayMs", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    await expect(tryWhile(fn, () => true, { baseDelayMs: 100, maxDelayMs: 50 })).rejects.toThrow();
  });
});

describe("tryN", () => {
  test("throws if n <= 0", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    await expect(tryN(0, fn)).rejects.toThrow();
  });

  test("uses custom isRetryable", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const isRetryable = vi.fn().mockReturnValue(false);

    await expect(tryN(5, fn, { isRetryable })).rejects.toThrow();
    expect(isRetryable).toHaveBeenCalledTimes(1);
  });
});

describe("jitterBackoff", () => {
  test("returns value less than max delay", () => {
    const delay = jitterBackoff(3, 100, 1000);
    expect(delay).toBeLessThan(1000);
  });

  test("increases with attempt number", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const delay1 = jitterBackoff(1, 100, 10000);
    const delay2 = jitterBackoff(2, 100, 10000);
    expect(delay2).toBeGreaterThan(delay1);
    randomSpy.mockRestore();
  });

  test("never returns negative", () => {
    for (let i = 1; i <= 10; i++) {
      const delay = jitterBackoff(i, 100, 10000);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });

  test("caps at maxDelayMs", () => {
    const delay = jitterBackoff(100, 100, 500);
    expect(delay).toBeLessThanOrEqual(500);
  });
});

describe("isErrorRetryable", () => {
  test("returns true when retryable is true and not overloaded", () => {
    const error = { retryable: true } as any;
    expect(isErrorRetryable(error)).toBe(true);
  });

  test("returns false when overloaded is true", () => {
    const error = { retryable: true, overloaded: true } as any;
    expect(isErrorRetryable(error)).toBe(false);
  });

  test("returns false when retryable is false", () => {
    const error = { retryable: false } as any;
    expect(isErrorRetryable(error)).toBe(false);
  });

  test("returns false for message containing 'Durable Object is overloaded'", () => {
    const error = new Error("Durable Object is overloaded") as Error & { retryable: boolean };
    error.retryable = true;
    expect(isErrorRetryable(error)).toBe(false);
  });

  test("returns true for error without retryable property", () => {
    const error = new Error("regular error");
    expect(isErrorRetryable(error)).toBe(false);
  });
});

describe("integration scenarios", () => {
  test("chaining multiple operations", async () => {
    const result = await ok(10)
      .transform((x) => x * 2)
      .andThen((x) => ok(x + 5))
      .transformAsync(async (x) => x - 3);

    expect(result.success).toBe(true);
    expect(result.data).toBe(22);
  });

  test("error handling with recover", () => {
    const result = err("initial")
      .recover(() => ok("recovered"))
      .transform((x) => x.toUpperCase());

    expect(result.success).toBe(true);
    expect(result.data).toBe("RECOVERED");
  });

  test("pattern matching with mixed results", () => {
    const okResult = ok({ tag: "success", value: 100 });
    const errResult = err("fail", "Failed", 400, "FAIL", undefined, {
      tag: "fail",
      reason: "timeout",
    });

    const okMatch = match(okResult as Result<any>, {
      success: (p: any) => `Got: ${p.value}`,
      default: () => "default",
    });

    const errMatch = match(errResult as Result<any>, {
      fail: (p: any) => `Failed: ${p.reason}`,
      error: (e) => e.message,
    });

    expect(okMatch.success).toBe(true);
    expect(okMatch.data).toBe("Got: 100");
    expect(errMatch.success).toBe(true);
    expect(errMatch.data).toBe("Failed: timeout");
  });

  test("collecting multiple results with allSettled", () => {
    const results = [
      ok({ id: 1, name: "Alice" }),
      err("Not found", "User not found", 404, "NOT_FOUND", undefined, { tag: "not_found" }),
      ok({ id: 3, name: "Bob" }),
    ];

    const collected = allSettled(results);

    expect(collected.success).toBe(true);
    expect(collected.data!.data).toHaveLength(2);
    expect(collected.data!.errors).toHaveLength(1);
  });
});
