import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "../src/index.ts";
import {
  BaseContext,
  createContext,
  createContextWith,
  createRouterContext,
  createControllerContext,
  createServiceContext,
  createModelContext,
  createViewContext,
  enhanceRouterContext,
  enhanceControllerContext,
  enhanceServiceContext,
  enhanceModelContext,
  enhanceViewContext,
} from "../src/index.ts";

describe("BaseContext", () => {
  class TestContext extends BaseContext {
    protected module = {} as any;

    protected getModule() {
      return this.module;
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx: ContextLike = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    };

    const context = new TestContext(mockRequest, mockEnv, mockCtx);

    expect(context).toBeDefined();
    expect((context as unknown as { request: Request }).request).toBe(mockRequest);
    expect((context as unknown as { env: Record<string, unknown> }).env).toBe(mockEnv);
    expect((context as unknown as { ctx: ContextLike }).ctx).toBe(mockCtx);
  });

  test("getModule returns the module", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx: ContextLike = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    };

    const context = new TestContext(mockRequest, mockEnv, mockCtx);

    expect((context as unknown as { getModule: () => object }).getModule()).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseContext.beforeHooks).toBeDefined();
    expect(BaseContext.afterHooks).toBeDefined();
  });
});

describe("ContextLike", () => {
  test("createContext returns a ContextLike with noop methods", () => {
    const ctx = createContext();
    const { waitUntil, passThroughOnException } = ctx;
    expect(waitUntil).toBeDefined();
    expect(passThroughOnException).toBeDefined();
    expect(() => ctx.waitUntil(Promise.resolve())).not.toThrow();
    expect(() => ctx.passThroughOnException()).not.toThrow();
  });

  test("createContextWith attaches props", () => {
    const ctx = createContext();
    const enhanced = createContextWith(ctx, { db: "postgres" });
    expect(enhanced.props.db).toBe("postgres");
  });
});

describe("Layer Contexts", () => {
  test("createRouterContext returns RouterContext", () => {
    const ctx = createRouterContext();
    expect(ctx.params).toEqual({});
  });

  test("enhanceRouterContext adds params to existing context", () => {
    const base = createContext();
    const ctx = enhanceRouterContext(base, { params: { id: "1" } });
    expect(ctx.params).toEqual({ id: "1" });
  });

  test("createControllerContext returns ControllerContext", () => {
    const ctx = createControllerContext();
    expect(ctx.params).toEqual({});
    expect(ctx.currentUser).toBeUndefined();
    expect(ctx.session).toEqual({});
  });

  test("enhanceControllerContext overrides properties", () => {
    const base = createContext();
    const ctx = enhanceControllerContext(base, {
      params: { id: "1" },
      currentUser: { name: "Alice" },
    });
    expect(ctx.params).toEqual({ id: "1" });
    expect(ctx.currentUser).toEqual({ name: "Alice" });
  });

  test("createServiceContext returns ServiceContext with transactionId", () => {
    const ctx = createServiceContext();
    expect(typeof ctx.transactionId).toBe("string");
    expect(ctx.transactionId.length).toBeGreaterThan(0);
  });

  test("enhanceServiceContext preserves transactionId", () => {
    const base = createContext();
    const ctx = enhanceServiceContext(base);
    expect(typeof ctx.transactionId).toBe("string");
  });

  test("createModelContext returns ModelContext", () => {
    const ctx = createModelContext();
    expect(ctx.logger).toBeUndefined();
    expect(ctx.transaction).toBeUndefined();
  });

  test("enhanceModelContext overrides properties", () => {
    const base = createContext();
    const tx = { id: "tx-1" };
    const ctx = enhanceModelContext(base, { transaction: tx });
    expect(ctx.transaction).toBe(tx);
  });

  test("createViewContext returns ViewContext", () => {
    const ctx = createViewContext();
    expect(ctx.currentUser).toBeUndefined();
    expect(ctx.flash).toEqual({});
  });

  test("enhanceViewContext overrides flash", () => {
    const base = createContext();
    const ctx = enhanceViewContext(base, { flash: { notice: "Saved" } });
    expect(ctx.flash).toEqual({ notice: "Saved" });
  });
});
