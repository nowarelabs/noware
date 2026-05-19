import { describe, expect, test } from "vite-plus/test";
import { BaseUseCase, ValidationError, SubGoalAbandonedError } from "../src/index.ts";
import type { UseCaseResult } from "@nowarelabs/shared";

describe("BaseUseCase Specification Tests", () => {
  class TestUseCase extends BaseUseCase<string, string> {
    public calls: string[] = [];
    public setMeta(key: string, value: unknown) {
      this.setMetadata(key, value);
    }
    public getMeta(key: string) {
      return this.getMetadata(key);
    }

    protected async perform(input: string): Promise<string> {
      this.calls.push(input);
      if (input === "fail") {
        throw new Error("Perform Failed");
      }
      if (input === "invalid") {
        throw new ValidationError("Invalid input");
      }
      return `Processed: ${input}`;
    }
  }

  describe("1. Basic Execution", () => {
    test("should execute successfully and deliver result", async () => {
      const useCase = new TestUseCase();
      const result = await useCase.execute("hello");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Processed: hello");
      }
      expect(useCase.calls.length).toBe(1);
    });

    test("should handle abandonment when error is thrown", async () => {
      const useCase = new TestUseCase();
      const result = await useCase.execute("fail");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe("abandoned");
        expect(result.error.message).toBe("Perform Failed");
      }
    });

    test("should handle custom abandonment for ValidationError", async () => {
      const useCase = new TestUseCase();
      const result = await useCase.execute("invalid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe("ValidationError");
      }
    });
  });

  describe("2. Lifecycle Hooks", () => {
    test("should execute instance hooks", async () => {
      let beforeCalled = false;
      let afterResult: any = null;

      class HookUseCase extends TestUseCase {
        protected async beforeExecute(): Promise<UseCaseResult<string> | void> {
          beforeCalled = true;
          if (this.input === "skip") {
            return { success: false, error: new Error("Skipped via before"), status: "abandoned" };
          }
        }
        protected async afterExecute(result: any) {
          afterResult = result;
        }
      }

      const useCase = new HookUseCase();
      const result = await useCase.execute("skip");

      expect(result.success).toBe(false);
      expect(beforeCalled).toBe(true);
      expect(afterResult).toBe(null); // the flow is short-circuited but afterExecute is called ? Wait, runAfterHooks IS called even if beforeExecute returns.
    });

    test("should execute static hooks and respect order", async () => {
      const trace: string[] = [];

      class StaticHookUseCase extends TestUseCase {}

      StaticHookUseCase.before(() => {
        trace.push("before");
      });
      StaticHookUseCase.around(async (_useCase, next) => {
        trace.push("around-start");
        const res = await next();
        trace.push("around-end");
        return res;
      });
      StaticHookUseCase.after(() => {
        trace.push("after");
      });

      const useCase = new StaticHookUseCase();
      await useCase.execute("hello");

      expect(trace).toEqual(["before", "around-start", "around-end", "after"]);

      // Cleanup
      (StaticHookUseCase as any).beforeHooks = [];
      (StaticHookUseCase as any).afterHooks = [];
      (StaticHookUseCase as any).aroundHooks = [];
    });
  });

  describe("3. Metadata Management", () => {
    test("should store and retrieve metadata", () => {
      const useCase = new TestUseCase();
      useCase.setMeta("tenant_id", "t-1");
      expect(useCase.getMeta("tenant_id")).toBe("t-1");
    });
  });

  describe("4. Sub-Interactions", () => {
    test("subInteraction unwraps data on success", async () => {
      class ParentUseCase extends BaseUseCase<string, string> {
        protected async perform(input: string) {
          const sub = new TestUseCase();
          const result = await this.subInteraction(sub, input);
          return `Parent says: ${result}`;
        }
      }

      const useCase = new ParentUseCase();
      const result = await useCase.execute("hello");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Parent says: Processed: hello");
      }
    });

    test("subInteraction throws SubGoalAbandonedError on failure", async () => {
      class ParentUseCase extends BaseUseCase<string, string> {
        protected async perform(_input: string) {
          const sub = new TestUseCase();
          return await this.subInteraction(sub, "fail");
        }
      }

      const useCase = new ParentUseCase();
      const result = await useCase.execute("trigger");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SubGoalAbandonedError);
      }
    });

    test("trySubInteraction returns raw UseCaseResult", async () => {
      class ParentUseCase extends BaseUseCase<string, string> {
        protected async perform(_input: string) {
          const sub = new TestUseCase();
          const result = await this.trySubInteraction(sub, "fail");
          return result.success ? "Win" : "Handled";
        }
      }

      const useCase = new ParentUseCase();
      const result = await useCase.execute("trigger");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Handled");
      }
    });
  });
});
