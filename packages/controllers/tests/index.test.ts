import { describe, expect, test } from "vite-plus/test";
import { BaseController } from "../src/index.ts";

describe("BaseController", () => {
  class TestController extends BaseController {
    protected service = {};

    protected getService() {
      return this.service;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {} as any;

    const controller = new TestController(mockRequest, mockEnv, mockCtx);

    expect(controller).toBeDefined();
  });

  test("getService returns the service", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {} as any;

    const controller = new TestController(mockRequest, mockEnv, mockCtx);

    expect(controller.getService()).toEqual({});
  });

  test("static plugin points exist", () => {
    expect(BaseController.beforeHooks).toBeDefined();
    expect(BaseController.afterHooks).toBeDefined();
  });
});
