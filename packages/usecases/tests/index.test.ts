import { describe, expect, test } from "vite-plus/test";
import { BaseUseCase } from "../src/index.ts";

describe("BaseUseCase", () => {
  class TestUseCase extends BaseUseCase<any, any> {
    protected async perform(input: any) {
      return input;
    }
  }

  test("can be instantiated", () => {
    const useCase = new TestUseCase();
    expect(useCase).toBeDefined();
  });

  test("execute returns delivered result on success", async () => {
    const useCase = new TestUseCase();
    const result = await useCase.execute("hello");
    expect(result.success).toBe(true);
    expect(result.status).toBe("delivered");
    if (result.success) {
      expect(result.data).toBe("hello");
    }
  });

  test("static hooks exist", () => {
    expect(BaseUseCase.beforeHooks).toBeDefined();
    expect(BaseUseCase.afterHooks).toBeDefined();
    expect(BaseUseCase.aroundHooks).toBeDefined();
  });
});
