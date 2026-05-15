import { describe, expect, test } from "vite-plus/test";
import { BaseFeature } from "../src/index.ts";

describe("BaseFeature", () => {
  class TestFeature extends BaseFeature<any, any> {
    protected async execute(input: any) {
      return { success: true as const, data: input, status: "delivered" as const };
    }
    protected toResponse(result: any) {
      return new Response(JSON.stringify(result));
    }
    protected handleError(error: any) {
      return new Response(String(error), { status: 500 });
    }
  }

  test("can be instantiated", () => {
    const feature = new TestFeature();
    expect(feature).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseFeature.beforeHooks).toBeDefined();
    expect(BaseFeature.afterHooks).toBeDefined();
  });
});
