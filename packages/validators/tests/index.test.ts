import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { Validator, BaseValidator } from "../src/index.ts";

describe("Validator", () => {
  test("Validator interface requires validate method", () => {
    const validator: Validator<string> = {
      validate: () => "validated",
    };

    const validateFn = validator.validate;
    expect(validateFn).toBeDefined();
  });
});

describe("BaseValidator", () => {
  class TestValidator extends BaseValidator {
    validate(data: unknown) {
      return { ...(data as object), validated: true };
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const validator = new TestValidator(mockRequest, mockEnv, mockCtx);

    expect(validator).toBeDefined();
  });

  test("validate can be overridden", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const validator = new TestValidator(mockRequest, mockEnv, mockCtx);
    const result = validator.validate({ name: "test" });
    expect(result).toEqual({ name: "test", validated: true });
  });
});
