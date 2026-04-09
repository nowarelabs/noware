import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  isOk,
  isErr,
  isSuccess,
  isError,
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
  isResult,
  isTagged,
  all,
  allSettled,
  combine,
  tryValue,
  tryAsync,
  type Result,
} from "./index";

describe("Result", () => {
  describe("ok and err factories", () => {
    it("should create an ok result", () => {
      const result = ok("success");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("success");
      }
    });

    it("should create an err result with string", () => {
      const result = err("failure");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("failure");
        expect(result.message).toBe("Error");
        expect(result.status).toBe(500);
      }
    });

    it("should create an err result with tagged data", () => {
      const result = err(
        { tag: "NOT_FOUND", id: 123 },
        "Resource not found",
        404,
        "NOT_FOUND_ERROR",
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Resource not found");
        expect(result.message).toBe("Resource not found");
        expect(result.status).toBe(404);
        expect(result.details).toEqual({ tag: "NOT_FOUND", id: 123 });
      }
    });
  });

  describe("safe and safeAsync", () => {
    it("safe should wrap a successful value", () => {
      const result = safe(() => "success");
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("success");
    });

    it("safe should wrap a thrown error", () => {
      const result = safe(() => {
        throw new Error("thrown");
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("thrown");
    });

    it("safe should return Result if already a Result", () => {
      const r = ok("inner");
      const result = safe(() => r);
      expect(result).toBe(r);
    });

    it("safeAsync should wrap a resolved value", async () => {
      const result = await safeAsync(async () => "async success");
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("async success");
    });

    it("safeAsync should wrap a rejected promise", async () => {
      const result = await safeAsync(async () => {
        throw new Error("async thrown");
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("async thrown");
    });
  });

  describe("when and whenResult", () => {
    it("when should return value or undefined/default", () => {
      expect(when(true, "yes")).toBe("yes");
      expect(when(false, "yes")).toBeUndefined();
      expect(when(false, "yes", "no")).toBe("no");

      // Practical examples
      const req = { user: { id: "123" } } as any;
      expect(when(!!req.user?.id, req.user.id, "anonymous")).toBe("123");
      expect(when(false, "prod", "dev")).toBe("dev");
    });

    it("whenResult should return ok or err", () => {
      const resultOk = whenResult(true, "success");
      expect(resultOk.success).toBe(true);

      const resultErr = whenResult(false, "success", "failed condition");
      expect(resultErr.success).toBe(false);
      if (!resultErr.success) expect(resultErr.error).toBe("failed condition");

      // Validation chains pattern
      const email = "test@example.com";
      const validation = whenResult(
        email.includes("@"),
        email,
        "Invalid email format",
        "INVALID_EMAIL",
        400,
      );
      expect(validation.success).toBe(true);
      if (validation.success) expect(validation.data).toBe(email);

      const invalid = whenResult(false, "data", "Required", "MISSING", 400);
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.message).toBe("Required");
        expect(invalid.code).toBe("MISSING");
        expect(invalid.status).toBe(400);
      }
    });
  });

  describe("matchCode and matchStatus", () => {
    it("matchCode should match strings and wildcards", () => {
      // Basic matching
      const overrides = { OK: 1, "ERR_*": 2 };
      expect(matchCode("OK", overrides)).toBe(1);
      expect(matchCode("ERR_VALIDATION", overrides)).toBe(2);
      expect(matchCode("MISSING", overrides)).toBeUndefined();
      expect(matchCode("MISSING", overrides, 0)).toBe(0);

      // Wildcard patterns with handlers
      const handlerMatch = matchCode("USER_NOT_FOUND", {
        "USER_*": (): string => "handled_user_error",
        NOT_FOUND: (): string => "handled_not_found",
        VALIDATION_ERROR: (): string => "handled_validation",
      });
      expect(typeof handlerMatch).toBe("function");
      if (typeof handlerMatch === "function") expect(handlerMatch()).toBe("handled_user_error");

      // Card/Payment patterns
      const errorType = matchCode(
        "PAYMENT_CARD_DECLINED",
        {
          "PAYMENT_*": "payment_error",
          "CARD_*": "card_error",
          "NETWORK_*": "network_error",
        },
        "unknown_error",
      );
      expect(errorType).toBe("payment_error");

      // Practical example - error code mapping
      const mapping = {
        NOT_FOUND: 404,
        "VALIDATION_*": 400,
        "AUTH_*": 401,
        "PERMISSION_*": 403,
        "SERVER_*": 500,
      };
      expect(matchCode("VALIDATION_INVALID_EMAIL", mapping, 500)).toBe(400);
      expect(matchCode("AUTH_EXPIRED", mapping, 500)).toBe(401);
      expect(matchCode("OTHER", mapping, 500)).toBe(500);

      // Default value handling
      const messageMapping = {
        SUCCESS: "Operation completed",
        PENDING: "Operation in progress",
      };
      expect(matchCode("UNKNOWN", messageMapping, "Unknown status")).toBe("Unknown status");
    });

    it("matchCodeResult should return ok or err", () => {
      // Basic usage
      const result = matchCodeResult("USER_NOT_FOUND", {
        "USER_*": () => ok("handled"),
        NOT_FOUND: () => err("Not found"),
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("handled");

      // With custom error for no match
      const result2 = matchCodeResult(
        "UNKNOWN_CODE",
        {
          SUCCESS: () => ok("success"),
          ERROR: () => err("error occurred"),
        },
        "Unknown code",
        "UNKNOWN_CODE",
        500,
      );
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.status).toBe(500);
        expect(result2.code).toBe("UNKNOWN_CODE");
      }

      // Practical example - API error handling
      const response = { code: "VALIDATION_FAILED", data: null };
      const apiResult = matchCodeResult(
        response.code,
        {
          SUCCESS: () => ok(response.data),
          "VALIDATION_*": () => err("Validation failed", "Validation failed", 400, response.code),
          "AUTH_*": () => err("Authentication failed", "Auth failed", 401, response.code),
          NOT_FOUND: () => err("Resource not found", "Not found", 404, "NOT_FOUND"),
        },
        "Unknown error",
        "UNKNOWN_ERROR",
        500,
      );

      expect(apiResult.success).toBe(false);
      if (!apiResult.success) {
        expect(apiResult.status).toBe(400);
        expect(apiResult.code).toBe("VALIDATION_FAILED");
      }
    });

    it("matchStatus should match numbers", () => {
      const overrides = { 200: "ok", 404: "not found" };
      expect(matchStatus(200, overrides)).toBe("ok");
      expect(matchStatus(500, overrides)).toBeUndefined();
      expect(matchStatus(500, overrides, "default")).toBe("default");
    });

    it("matchStatusResult should return ok or err", () => {
      const overrides = { 200: "ok" };
      expect(matchStatusResult(200, overrides).success).toBe(true);
      expect(matchStatusResult(404, overrides).success).toBe(false);

      // Basic usage pattern
      const result = matchStatusResult(404, {
        200: () => ok("success"),
        404: () => err("Not found", "Not found", 404, "NOT_FOUND"),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }

      // HTTP response handling pattern
      const httpResponse = { status: 201, data: { id: 1 } };
      const responseResult = matchStatusResult(
        httpResponse.status,
        {
          200: () => ok(httpResponse.data),
          201: () => ok(httpResponse.data),
          400: () => err("Bad request", "Invalid input", 400, "BAD_REQUEST"),
          401: () => err("Unauthorized", "Auth required", 401, "UNAUTHORIZED"),
          404: () => err("Not found", "Resource not found", 404, "NOT_FOUND"),
          500: () => err("Server error", "Internal error", 500, "SERVER_ERROR"),
        },
        "Unknown status",
        "UNKNOWN_STATUS",
        500,
      );

      expect(responseResult.success).toBe(true);
      if (responseResult.success) {
        expect(responseResult.data).toEqual({ id: 1 });
      }

      // Status code to Result conversion
      const status = 400;
      const statusResult = matchStatusResult(status, {
        200: () => ok({ success: true }),
        400: () => err("Client error", "Bad request", 400, "CLIENT_ERROR"),
        500: () => err("Server error", "Internal error", 500, "SERVER_ERROR"),
      });
      expect(statusResult.success).toBe(false);
      if (!statusResult.success) {
        expect(statusResult.code).toBe("CLIENT_ERROR");
      }
    });
  });

  describe("matching and tagging", () => {
    it("matchResult should branch on success/error", () => {
      const success = ok("win");
      const sVal = matchResult(success, {
        ok: (d) => d + "!",
        err: (e) => e.message,
      });
      expect(sVal).toBe("win!");

      const failure = err("lose");
      const fVal = matchResult(failure, {
        ok: (d) => d,
        err: (e) => e.error + "...",
      });
      expect(fVal).toBe("lose...");
    });

    it("match should handle tagged results", () => {
      type Shape = { tag: "circle"; radius: number } | { tag: "square"; size: number };
      const circle = ok({ tag: "circle", radius: 5 } as Shape);

      const area = match(circle, {
        circle: (p) => Math.PI * p.radius ** 2,
        square: (p) => p.size ** 2,
      });

      expect(area.success).toBe(true);
      if (area.success) expect(area.data).toBeCloseTo(78.54);
    });

    it("match should handle error tags in details", () => {
      type NotFoundError = { tag: "NOT_FOUND"; id: number };
      type OtherError = { tag: "OTHER"; msg: string };
      type AppError = NotFoundError | OtherError;

      const failure = err({ tag: "NOT_FOUND", id: 404 } as NotFoundError, "Missing", 404);

      const resolved = match(failure as Result<AppError>, {
        NOT_FOUND: (p) => `Object ${p.id} is gone`,
        OTHER: (p) => `Other: ${p.msg}`,
        error: (_e) => "Some other error",
      });

      expect(resolved.success).toBe(true);
      if (resolved.success) expect(resolved.data).toBe("Object 404 is gone");
    });

    it("tagged utility should create tagged data or taggers", () => {
      // Basic usage
      const taggedData = tagged("FOUND", { data: "result", size: 100 });
      expect(taggedData).toEqual({ data: "result", size: 100, tag: "FOUND" });

      // With custom tag name
      const taggedData2 = tagged("LOADING", { progress: 50 }, "status");
      expect(taggedData2).toEqual({ progress: 50, status: "LOADING" });

      // Tagger function pattern
      const userStateTagger = tagged("ACTIVE");
      expect(userStateTagger({ id: "123", name: "John" })).toEqual({
        id: "123",
        name: "John",
        tag: "ACTIVE",
      });

      // With ok()
      const result = ok(tagged("FOUND", { id: 1 }));
      expect(isTagged(result.data)).toBe(true);
      expect((result.data as any).tag).toBe("FOUND");

      // With err()
      const error = err(tagged("VALIDATION_ERROR", { field: "email" }));
      expect(error.success).toBe(false);
      if (!error.success) {
        expect(error.message).toBe("VALIDATION_ERROR");
        expect(isTagged(error.details)).toBe(true);
        expect((error.details as any).tag).toBe("VALIDATION_ERROR");
      }
    });

    it("taggedWith utility should support custom tag names", () => {
      // Basic usage
      const taggedData = taggedWith("status", "loading", { progress: 50 });
      expect(taggedData).toEqual({ progress: 50, status: "loading" });

      // Tagger pattern
      const apiResponseTagger = taggedWith("type", "SUCCESS");
      expect(apiResponseTagger({ data: "ok" })).toEqual({
        data: "ok",
        type: "SUCCESS",
      });

      // Practical example
      const result = ok(taggedWith("resultType", "FOUND", { user: "John" }));
      expect((result.data as any).resultType).toBe("FOUND");
    });

    it("taggedWith should create a tagger for a specific key", () => {
      const tagType = taggedWith("type", "user");
      const data = tagType({ id: 1 });
      expect(data).toEqual({ id: 1, type: "user" });
    });
  });

  describe("chaining methods", () => {
    it("transform should change success value", () => {
      const result = ok(1)
        .transform((x) => x + 1)
        .transform((x) => `value: ${x}`);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("value: 2");
    });

    it("transform should propagate error", () => {
      const result = err("fail").transform((x: any) => x + 1);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("fail");
    });

    it("andThen should chain operations", () => {
      const result = ok(1)
        .andThen((x) => ok(x + 1))
        .andThen((x) => ok(`value: ${x}`));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("value: 2");
    });

    it("andThen should short-circuit on error", () => {
      let callCount = 0;
      const result = ok(1)
        .andThen(() => err("stop"))
        .andThen((x) => {
          callCount++;
          return ok(x);
        });
      expect(result.success).toBe(false);
      expect(callCount).toBe(0);
      if (!result.success) expect(result.error).toBe("stop");
    });

    it("recover should handle errors", () => {
      const result = err("fail").recover((e) => ok(`recovered from ${e.error}`));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("recovered from fail");
    });

    it("recover should be no-op on success", () => {
      const result = ok("win").recover(() => ok("recovered"));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("win");
    });

    it("transformAsync and andThenAsync should handle promises", async () => {
      const result = await ok(1)
        .transformAsync(async (x) => x + 1)
        .then((r) => r.andThenAsync(async (x) => ok(`async: ${x}`)));

      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("async: 2");
    });
  });

  describe("type guards", () => {
    it("isResult should identify Results", () => {
      expect(isResult(ok(1))).toBe(true);
      expect(isResult(err("bad"))).toBe(true);
      expect(isResult({ success: true })).toBe(false);
      expect(isResult(null)).toBe(false);
    });

    it("isOk, isErr, isSuccess, isError should work", () => {
      const o = ok(1);
      const e = err("fail");
      expect(isOk(o)).toBe(true);
      expect(isOk(e)).toBe(false);
      expect(isErr(e)).toBe(true);
      expect(isErr(o)).toBe(false);
      expect(isSuccess(o)).toBe(true);
      expect(isError(e)).toBe(true);
    });

    it("isTagged should identify tagged data", () => {
      const data = { tag: "user", id: 1 };
      expect(isTagged(data, "tag", "user")).toBe(true);
      expect(isTagged(data, "tag", "admin")).toBe(false);
      expect(isTagged(data, "type", "user")).toBe(false);
    });
  });

  describe("collections", () => {
    it("all should combine multiple results", () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = all(results);
      expect(combined.success).toBe(true);
      if (combined.success) expect(combined.data).toEqual([1, 2, 3]);

      const mixed = [ok(1), err("fail"), ok(3)];
      const failed = all(mixed);
      expect(failed.success).toBe(false);
      if (!failed.success) expect(failed.error).toBe("fail");
    });

    it("allSettled should return all data and errors", () => {
      const results = [ok(1), err("fail"), ok(3)];
      const settled = allSettled(results);
      expect(settled.success).toBe(true);
      if (settled.success) {
        expect(settled.data.data).toEqual([1, 3]);
        expect(settled.data.errors).toHaveLength(1);
        expect(settled.data.errors[0].error).toBe("fail");
      }
    });

    it("combine should just wrap the results", () => {
      const results = [ok(1), err("fail")];
      const combined = combine(results);
      expect(combined.success).toBe(true);
      if (combined.success) expect(combined.data).toBe(results);
    });
  });

  describe("aliases", () => {
    it("tryValue and tryAsync should work", async () => {
      expect(tryValue(() => "ok").success).toBe(true);
      expect((await tryAsync(async () => "ok")).success).toBe(true);
    });
  });

  describe("complex patterns", () => {
    interface APIResponse {
      status: number;
      body: any;
      code?: string;
    }

    it("should support the authenticateUser DSL pattern", async () => {
      // Mock DB and encryption
      const db = {
        findUserByEmail: async (email: string) => {
          if (email === "test@example.com") return { id: "1", email, hashedPassword: "hashed" };
          return null;
        },
      };
      const verifyPassword = async (p: string, h: string) => p === "password123" && h === "hashed";
      const generateToken = (u: any) => `token-${u.id}`;

      async function authenticateUser(email: string, password: string): Promise<APIResponse> {
        // Step 1: Validate input
        const validationResult = await safeAsync(async () => {
          if (!email || !email.includes("@")) {
            return err(
              tagged("INVALID_EMAIL", { error: "Invalid email format", email }),
              "Invalid email format",
              400,
            );
          }
          if (!password || password.length < 8) {
            return err(
              tagged("WEAK_PASSWORD", {
                error: "Password too weak",
                passwordLength: password?.length || 0,
              }),
              "Password too weak",
              400,
            );
          }
          return ok(tagged("VALID", { email, password }));
        });

        // Step 2: If validation failed, return early
        if (!validationResult.success) {
          return matchResult(validationResult, {
            ok: (data) => ({ status: 200, body: data }),
            err: (error) => ({
              status: error.status || 400,
              body: { error: error.message },
            }),
          });
        }

        interface User {
          id: string;
          email: string;
          hashedPassword: string;
        }

        // Step 3: Check if user exists
        type UserCheckResult =
          | { tag: "USER_NOT_FOUND"; email: string }
          | { tag: "USER_FOUND"; user: User };
        const userCheckResult = await safeAsync<UserCheckResult>(async () => {
          const user = await db.findUserByEmail(email);
          if (!user) {
            return ok(tagged("USER_NOT_FOUND", { email }));
          }
          return ok(tagged("USER_FOUND", { user }));
        });

        // Step 4: Handle user check result
        return matchResult(userCheckResult, {
          ok: async (taggedData): Promise<APIResponse> => {
            const tagValue = taggedData.tag;

            if (tagValue === "USER_NOT_FOUND") {
              const eResult = err(
                tagged("AUTH_FAILED", {
                  error: "Authentication failed",
                  email,
                  reason: "user_not_found",
                }),
                "Authentication failed",
              );
              return { status: 401, body: { error: eResult.message } };
            }

            const { user } = taggedData as { user: User };

            // Step 5: Verify password
            const passwordValid = await verifyPassword(password, user.hashedPassword);

            if (!passwordValid) {
              const eResult = err(
                tagged("AUTH_FAILED", {
                  error: "Authentication failed",
                  email,
                  reason: "invalid_password",
                }),
                "Authentication failed",
              );
              return { status: 401, body: { error: eResult.message } };
            }

            return { status: 200, body: { user, token: generateToken(user) } };
          },
          err: async (error): Promise<APIResponse> => {
            return {
              status: error.status || 500,
              body: { error: error.message },
            };
          },
        });
      }

      // Usage with comprehensive matching
      const authResult = await authenticateUser("test@example.com", "password123");
      // authResult is already APIResponse now
      expect(authResult.status).toBe(200);
      expect(authResult.body.token).toBe("token-1");

      // Test failing validation
      const invalidResponse = await authenticateUser("bademail", "pass");
      expect(invalidResponse.status).toBe(400);
    });

    it("should support the processPayment DSL pattern (matchCodeResult + tagged)", async () => {
      type PaymentResponse = { id: string; code: string };

      async function processPaymentAPI(amount: number, method: string): Promise<PaymentResponse> {
        if (amount === 100) return { id: "tx_123", code: "PAYMENT_SUCCESS" };
        if (amount === 50) return { id: "", code: "INSUFFICIENT_FUNDS" };
        if (method === "invalid_card") return { id: "", code: "CARD_DECLINED" };
        return { id: "", code: "NETWORK_TIMEOUT" };
      }

      async function processPayment(amount: number, method: string): Promise<APIResponse> {
        const paymentResult = await safeAsync(async () => {
          const apiResponse = await processPaymentAPI(amount, method);

          // Map API error codes to tagged errors
          return matchCodeResult(
            apiResponse.code,
            {
              PAYMENT_SUCCESS: () =>
                ok(
                  tagged("PAID", {
                    amount,
                    method,
                    transactionId: apiResponse.id,
                  }),
                ),
              INSUFFICIENT_FUNDS: () =>
                err(
                  tagged("INSUFFICIENT_FUNDS", {
                    error: "Insufficient funds",
                    amount,
                    method,
                  }),
                  "Insufficient funds",
                ),
              "CARD_*": () =>
                err(
                  tagged("CARD_ERROR", {
                    error: "Card error",
                    amount,
                    method,
                    code: apiResponse.code,
                  }),
                  "Card error",
                ),
              "NETWORK_*": () =>
                err(
                  tagged("NETWORK_ERROR", {
                    error: "Network error",
                    amount,
                    method,
                  }),
                  "Network error",
                ),
            },
            "Unknown payment error",
            "UNKNOWN_ERROR",
            500,
          );
        });

        return match(paymentResult, {
          PAID: (payload: any) => ({
            status: 200,
            body: {
              message: "Payment successful",
              transactionId: payload.transactionId,
            },
          }),
          INSUFFICIENT_FUNDS: (payload: any) => ({
            status: 402,
            body: { error: "Insufficient funds", amount: payload.amount },
          }),
          CARD_ERROR: (payload: any) => ({
            status: 400,
            body: { error: "Card error", code: payload.code },
          }),
          NETWORK_ERROR: () => ({
            status: 503,
            body: { error: "Network error, please try again" },
          }),
          error: (err: any) => ({
            status: err.status || 500,
            body: { error: err.message },
          }),
        }).data as APIResponse;
      }

      // Usage
      const response = await processPayment(100, "credit_card");
      expect(response.status).toBe(200);
      expect(response.body.transactionId).toBe("tx_123");

      // Test Card Error (Wildcard)
      const cardResponse = await processPayment(99, "invalid_card");
      expect(cardResponse.status).toBe(400);
      expect((cardResponse as any).body?.error).toBe("Card error");

      // Test Network Error (Wildcard)
      const networkResponse = await processPayment(99, "other");
      expect(networkResponse.status).toBe(503);
    });

    it("should support the handleGetUser full context pattern", async () => {
      // Mock environment
      const db = {
        findUser: async (id: string) => {
          if (id === "user-1") return { id, name: "Alice", status: "active" };
          if (id === "user-suspended") return { id, name: "Bob", status: "suspended" };
          return null;
        },
      };
      const isValidUUID = (id: string) => id.startsWith("user-");

      async function handleGetUser(req: { params: { id?: string } }): Promise<APIResponse> {
        // Step 1: Safely extract and validate request
        const validationResult = await safeAsync(async () => {
          const userId = req.params.id;

          if (!userId) {
            return err(
              tagged("MISSING_ID", { error: "User ID is required" }),
              "User ID is required",
              400,
              "MISSING_ID",
            );
          }

          if (!isValidUUID(userId)) {
            return err(
              tagged("INVALID_ID", { error: "Invalid user ID format", userId }),
              "Invalid user ID",
              400,
              "INVALID_ID",
            );
          }

          return ok(tagged("VALID", { userId }));
        });

        // Step 2: Process if validation succeeded
        type ProcessResult =
          | { tag: "NOT_FOUND"; userId: string }
          | {
              tag: "SUSPENDED";
              userId: string;
              user: { id: string; name: string; status: string };
            }
          | {
              tag: "FOUND";
              user: { id: string; name: string; status: string };
            };

        const processResult = await matchResult(validationResult, {
          ok: async (taggedData): Promise<Result<ProcessResult>> => {
            const { userId } = taggedData as { userId: string };

            return await safeAsync<ProcessResult>(async () => {
              const user = await db.findUser(userId);

              if (!user) {
                return ok(tagged("NOT_FOUND", { userId }));
              }

              if (user.status === "suspended") {
                return ok(tagged("SUSPENDED", { userId, user }));
              }

              return ok(tagged("FOUND", { user }));
            });
          },
          err: async (error): Promise<Result<ProcessResult>> => {
            // Pass through validation errors
            return err(
              error.error,
              error.message,
              error.status,
              error.code,
              error.stack,
              error.details,
            );
          },
        });

        // Step 3: Match all possible outcomes
        const responseResult = await match<
          ProcessResult,
          "tag",
          Record<string, (p: any) => APIResponse>
        >(processResult, {
          VALID: () => ({ status: 200, body: { message: "Valid request" } }),
          FOUND: (payload) => ({
            status: 200,
            body: (payload as { user: any }).user,
          }),
          NOT_FOUND: (payload) => ({
            status: 404,
            body: {
              error: `User ${(payload as { userId: string }).userId} not found`,
            },
          }),
          SUSPENDED: (payload) => ({
            status: 403,
            body: {
              error: "User account is suspended",
              user: (payload as { user: any }).user,
            },
          }),
          MISSING_ID: () => ({
            status: 400,
            body: { error: "User ID is required" },
          }),
          INVALID_ID: (payload) => ({
            status: 400,
            body: {
              error: `Invalid user ID: ${(payload as { userId: string }).userId}`,
            },
          }),
          error: (err) => ({
            status: err.status || 500,
            body: { error: err.message },
          }),
        });

        // Step 4: Final result handling
        return matchResult(responseResult, {
          ok: (response) => response,
          err: () => ({
            status: 500,
            body: { error: "Internal server error" },
          }),
        });
      }

      // Test FOUND
      const foundResp = await handleGetUser({ params: { id: "user-1" } });
      expect(foundResp.status).toBe(200);
      expect(foundResp.body.name).toBe("Alice");

      // Test NOT_FOUND
      const notFoundResp = await handleGetUser({ params: { id: "user-99" } });
      expect(notFoundResp.status).toBe(404);

      // Test SUSPENDED
      const suspendedResp = await handleGetUser({
        params: { id: "user-suspended" },
      });
      expect(suspendedResp.status).toBe(403);

      // Test INVALID_ID
      const invalidResp = await handleGetUser({ params: { id: "bad-id" } });
      expect(invalidResp.status).toBe(400);

      // Test MISSING_ID
      const missingResp = await handleGetUser({ params: { id: undefined } });
      expect(missingResp.status).toBe(400);
    });

    it("should handle match with extra non-function properties (type robustness)", () => {
      const result = ok(tagged("TEST", { value: 1 }));
      const matched = match(result, {
        TEST: (p: any) => p.value + 1,
        metadata: "important info", // This should not break type inference
        version: 1.0,
      });

      expect(matched.success).toBe(true);
      if (matched.success) {
        expect(matched.data).toBe(2);
      }
    });
  });
});
