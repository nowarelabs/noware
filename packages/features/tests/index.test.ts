import { describe, expect, test, vi } from "vite-plus/test";
import { BaseFeature } from "../src/index.ts";
import { createContext } from "@nowarelabs/shared";

describe("BaseFeature", () => {
  class TestFeature extends BaseFeature<any, any> {
    protected async execute(input: any, _context: any) {
      return { success: true as const, data: input, status: "delivered" as const };
    }
    protected toResponse(result: any, _context: any) {
      return new Response(JSON.stringify(result));
    }
    protected handleError(error: any, _context: any) {
      return new Response(String(error), { status: 500 });
    }
  }

  class FailingFeature extends BaseFeature<any, any> {
    protected async execute(_input: any, _context: any): Promise<any> {
      throw new Error("execute failed");
    }
    protected toResponse(result: any, _context: any) {
      return new Response(JSON.stringify(result));
    }
    protected handleError(error: any, _context: any) {
      return new Response(String(error), { status: 500 });
    }
  }

  function createFeatureContext() {
    return {
      request: new Request("http://localhost"),
      env: {} as Record<string, unknown>,
      ctx: createContext(),
    };
  }

  test("can be instantiated", () => {
    const feature = new TestFeature();
    expect(feature).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseFeature.beforeHooks).toBeDefined();
    expect(BaseFeature.afterHooks).toBeDefined();
  });

  test("handle creates logger", async () => {
    const feature = new TestFeature();
    const context = createFeatureContext();
    await feature.handle({}, context as any);
    expect((feature as any).logger).toBeDefined();
  });

  test("handle calls execute and returns response", async () => {
    const feature = new TestFeature();
    const context = createFeatureContext();
    const response = await feature.handle({ name: "test" }, context as any);
    expect(response).toBeInstanceOf(Response);
    const body = await response.json();
    expect(body.data.name).toBe("test");
  });

  test("handle logs error on failure", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const feature = new FailingFeature();
    const context = createFeatureContext();
    const response = await feature.handle({}, context as any);
    expect(response.status).toBe(500);

    const errorCall = spy.mock.calls.find((call) => {
      const output = JSON.parse(call[0] as string);
      return output.level === "ERROR" && output.message === "handle failed";
    });
    expect(errorCall).toBeDefined();
    spy.mockRestore();
  });
});
