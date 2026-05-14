import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseView } from "../src/index.ts";

describe("BaseView", () => {
  class TestView extends BaseView {
    protected component = {} as any;

    protected getComponent() {
      return this.component;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const view = new TestView(mockRequest, mockEnv, mockCtx);

    expect(view).toBeDefined();
  });

  test("getComponent returns the component", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const view = new TestView(mockRequest, mockEnv, mockCtx);

    expect(
      (view as unknown as { getComponent: () => object }).getComponent(),
    ).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseView.beforeHooks).toBeDefined();
    expect(BaseView.afterHooks).toBeDefined();
  });
});
