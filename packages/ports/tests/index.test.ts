import { describe, expect, test, vi } from "vite-plus/test";
import { BasePort } from "../src/index.ts";
import type { UseCaseResult } from "@nowarelabs/shared";

describe("BasePort Specification Tests", () => {
  interface Input {
    email: string;
  }
  interface Output {
    id: string;
  }

  class TestPort extends BasePort<Input, Output> {
    public handleCalls: Input[] = [];
    public setMeta(key: string, value: unknown) {
      this.setMetadata(key, value);
    }
    public getMeta(key: string) {
      return this.getMetadata(key);
    }
    protected async handleExecute(input: Input): Promise<UseCaseResult<Output>> {
      this.handleCalls.push(input);
      if (input.email === "fail@example.com") {
        throw new Error("Domain Error");
      }
      return { success: true, data: { id: "123" }, status: "delivered" };
    }
  }

  const mockRequest = {} as any;
  const mockEnv = {};
  const mockCtx = { waitUntil: () => {} } as any;

  describe("1. Basic Execution", () => {
    test("should execute handleExecute within lifecycle", async () => {
      const port = new TestPort(mockRequest, mockEnv, mockCtx);
      const result = await port.execute({ email: "test@example.com" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("123");
      }
      expect(port.handleCalls.length).toBe(1);
    });

    test("should handle implementation errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const port = new TestPort(mockRequest, mockEnv, mockCtx);
      const result = await port.execute({ email: "fail@example.com" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe("abandoned");
        expect(result.error.message).toBe("Domain Error");
      }
      consoleSpy.mockRestore();
    });
  });

  describe("2. Lifecycle Hooks", () => {
    test("should execute instance hooks", async () => {
      let beforeCalled = false;
      let afterResult: any = null;

      class HookPort extends TestPort {
        protected async beforeExecute(): Promise<UseCaseResult<Output> | void> {
          beforeCalled = true;
          if (this.getMeta("short")) {
            return { success: false, error: new Error("Short"), status: "abandoned" };
          }
        }
        protected async afterExecute(result: any) {
          afterResult = result;
        }
      }

      const port = new HookPort(mockRequest, mockEnv, mockCtx);
      port.setMeta("short", true);
      const result = await port.execute({ email: "test@example.com" });

      expect(result.success).toBe(false);
      expect(beforeCalled).toBe(true);
      expect(afterResult).toBe(null);
    });

    test("should execute static hooks and respect order", async () => {
      const trace: string[] = [];

      class StaticHookPort extends TestPort {}

      StaticHookPort.before(() => {
        trace.push("before");
      });
      StaticHookPort.around(async (_port, next) => {
        trace.push("around-start");
        const res = await next();
        trace.push("around-end");
        return res;
      });
      StaticHookPort.after(() => {
        trace.push("after");
      });

      const port = new StaticHookPort(mockRequest, mockEnv, mockCtx);
      await port.execute({ email: "test@example.com" });

      expect(trace).toEqual(["before", "around-start", "around-end", "after"]);

      // Cleanup
      (StaticHookPort as any).beforeHooks = [];
      (StaticHookPort as any).afterHooks = [];
      (StaticHookPort as any).aroundHooks = [];
    });
  });

  describe("3. Metadata Management", () => {
    test("should store and retrieve metadata", () => {
      const port = new TestPort(mockRequest, mockEnv, mockCtx);
      port.setMeta("user_id", "user_1");
      expect(port.getMeta("user_id")).toBe("user_1");
    });
  });
});
