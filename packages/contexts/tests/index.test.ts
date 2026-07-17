import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "../src/index.ts";
import {
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

describe("Layer Contexts (Linear Chain)", () => {
  test("createRouterContext returns RouterContext", () => {
    const ctx = createRouterContext();
    expect(ctx.params).toEqual({});
  });

  test("enhanceRouterContext adds params to existing context", () => {
    const base = createContext();
    const ctx = enhanceRouterContext(base, { params: { id: "1" } });
    expect(ctx.params).toEqual({ id: "1" });
  });

  test("createControllerContext returns ControllerContext extending RouterContext", () => {
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

  test("createServiceContext returns ServiceContext extending ControllerContext", () => {
    const ctx = createServiceContext();
    expect(typeof ctx.transactionId).toBe("string");
    expect(ctx.transactionId.length).toBeGreaterThan(0);
    expect(ctx.params).toEqual({});
    expect(ctx.currentUser).toBeUndefined();
    expect(ctx.session).toEqual({});
  });

  test("enhanceServiceContext preserves parent fields", () => {
    const base = createControllerContext();
    const ctx = enhanceServiceContext(base);
    expect(typeof ctx.transactionId).toBe("string");
    expect(ctx.params).toEqual({});
    expect(ctx.currentUser).toBeUndefined();
  });

  test("createModelContext returns ModelContext extending ServiceContext", () => {
    const ctx = createModelContext();
    expect(typeof ctx.transactionId).toBe("string");
    expect(ctx.logger).toBeUndefined();
    expect(ctx.transaction).toBeUndefined();
    expect(ctx.params).toEqual({});
  });

  test("enhanceModelContext overrides transaction", () => {
    const base = createServiceContext();
    const tx = { id: "tx-1" };
    const ctx = enhanceModelContext(base, { transaction: tx });
    expect(ctx.transaction).toBe(tx);
    expect(typeof ctx.transactionId).toBe("string");
  });

  test("createViewContext returns ViewContext extending ControllerContext", () => {
    const ctx = createViewContext();
    expect(ctx.currentUser).toBeUndefined();
    expect(ctx.flash).toEqual({});
    expect(ctx.params).toEqual({});
    expect(ctx.session).toEqual({});
  });

  test("enhanceViewContext overrides flash", () => {
    const base = createControllerContext();
    const ctx = enhanceViewContext(base, { flash: { notice: "Saved" } });
    expect(ctx.flash).toEqual({ notice: "Saved" });
  });
});

describe("Context Chain Inheritance", () => {
  test("ServiceContext inherits ControllerContext fields", () => {
    const ctx = createServiceContext();
    expect("params" in ctx).toBe(true);
    expect("currentUser" in ctx).toBe(true);
    expect("session" in ctx).toBe(true);
    expect("transactionId" in ctx).toBe(true);
  });

  test("ModelContext inherits ServiceContext and ControllerContext fields", () => {
    const ctx = createModelContext();
    expect("params" in ctx).toBe(true);
    expect("currentUser" in ctx).toBe(true);
    expect("session" in ctx).toBe(true);
    expect("transactionId" in ctx).toBe(true);
    expect("transaction" in ctx).toBe(true);
  });

  test("ViewContext inherits ControllerContext fields", () => {
    const ctx = createViewContext();
    expect("params" in ctx).toBe(true);
    expect("currentUser" in ctx).toBe(true);
    expect("session" in ctx).toBe(true);
    expect("flash" in ctx).toBe(true);
  });
});
