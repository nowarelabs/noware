import { describe, expect, test } from "vite-plus/test";
import { DrivingAdapter, DrivenAdapter, BaseAdapter } from "../src/index.ts";
import type { Port, UseCaseResult } from "@nowarelabs/shared";

describe("Reference Specification Tests", () => {
  // Mock Port for Driving Adapters
  interface Input {
    email: string;
    name?: string;
  }
  interface Output {
    id: string;
    name: string;
  }

  class MockPort implements Port<Input, Output> {
    public calls: Input[] = [];
    async execute(input: Input): Promise<UseCaseResult<Output>> {
      this.calls.push(input);
      if (!input) return { success: false, error: new Error("Missing input"), status: "abandoned" };
      if (input.email === "fail@example.com") {
        return { success: false, error: new Error("Domain Failure"), status: "abandoned" };
      }
      return {
        success: true,
        data: { id: "123", name: input.name || "Unknown" },
        status: "delivered",
      };
    }
  }

  const mockEnv = {};
  const mockCtx = { waitUntil: (_p: Promise<any>) => {} };

  describe("1. DrivingAdapter - Conventions & Mapping", () => {
    test("should use default mapInput and mapOutput", async () => {
      class DefaultAdapter extends DrivingAdapter<Input, Output, MockPort> {}

      const req = new Request("http://test.com", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com", name: "Alice" }),
        headers: { "content-type": "application/json" },
      });

      const adapter = new DefaultAdapter(new MockPort(), req, mockEnv, mockCtx as any);
      const response = await adapter.execute();
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.id).toBe("123");
      expect(body.name).toBe("Alice");
    });

    test("should use custom mapInput and mapOutput", async () => {
      class CustomAdapter extends DrivingAdapter<Input, Output, MockPort> {
        protected async mapInput() {
          const body = await this.body<any>();
          return { email: body.user_email, name: body.full_name };
        }
        protected mapOutput(output: Output) {
          return this.json({ msg: `Hello ${output.name}` }, 201);
        }
      }

      const req = new Request("http://test.com", {
        method: "POST",
        body: JSON.stringify({ user_email: "test@example.com", full_name: "Bob" }),
        headers: { "content-type": "application/json" },
      });

      const adapter = new CustomAdapter(new MockPort(), req, mockEnv, mockCtx as any);
      const response = await adapter.execute();
      const body = (await response.json()) as any;

      expect(response.status).toBe(201);
      expect(body.msg).toBe("Hello Bob");
    });
  });

  describe("2. DrivenAdapter - Call & Error Translation", () => {
    class DatabaseError extends Error {
      name = "DatabaseError";
    }

    class UserRepository extends DrivenAdapter {
      async findById(id: string) {
        return this.call(async () => {
          if (id === "error") throw new Error("Connection lost");
          return { id, name: "Alice" };
        });
      }
      protected handleExternalError(error: unknown) {
        return new DatabaseError(String(error));
      }
    }

    test("should execute call successfully", async () => {
      const repo = new UserRepository(mockEnv, mockCtx as any);
      const user = await repo.findById("1");
      expect(user.name).toBe("Alice");
    });

    test("should translate external errors", async () => {
      const repo = new UserRepository(mockEnv, mockCtx as any);
      try {
        await repo.findById("error");
        expect(true).toBe(false);
      } catch (e: any) {
        expect(e.name).toBe("DatabaseError");
      }
    });
  });

  describe("3. Lifecycle Hooks", () => {
    test("should execute instance hooks (before/afterExecute)", async () => {
      let beforeCalled = false;
      let afterResult: any = null;

      class HookAdapter extends DrivingAdapter<Input, Output, MockPort> {
        protected async beforeExecute() {
          beforeCalled = true;
          if (this.headers["x-fail"]) return this.badRequest("Manual Fail");
        }
        protected async afterExecute(result: any) {
          afterResult = result;
        }
      }

      const req = new Request("http://test.com", { headers: { "x-fail": "true" } });
      const adapter = new HookAdapter(new MockPort(), req, mockEnv, mockCtx as any);
      const response = await adapter.execute();

      expect(response.status).toBe(400);
      expect(beforeCalled).toBe(true);
      expect(afterResult).toBe(null);
    });

    test("should execute static hooks and respect order", async () => {
      const trace: string[] = [];

      class StaticHookAdapter extends DrivingAdapter<Input, Output, MockPort> {}

      StaticHookAdapter.before(() => {
        trace.push("before");
      });
      StaticHookAdapter.around(async (_adapter, next) => {
        trace.push("around-start");
        const res = await next();
        trace.push("around-end");
        return res;
      });
      StaticHookAdapter.after(() => {
        trace.push("after");
      });

      const req = new Request("http://test.com");
      const adapter = new StaticHookAdapter(new MockPort(), req, mockEnv, mockCtx as any);
      await adapter.execute();

      expect(trace).toEqual(["before", "around-start", "around-end", "after"]);

      (StaticHookAdapter as any).beforeHooks = [];
      (StaticHookAdapter as any).afterHooks = [];
      (StaticHookAdapter as any).aroundHooks = [];
    });

    test("should support skipping hooks", async () => {
      let callCount = 0;
      const hookFn = () => {
        callCount++;
      };

      class SkipHookAdapter extends DrivingAdapter<Input, Output, MockPort> {}

      SkipHookAdapter.before(hookFn);
      SkipHookAdapter.skipBefore(hookFn);

      const req = new Request("http://test.com");
      const adapter = new SkipHookAdapter(new MockPort(), req, mockEnv, mockCtx as any);
      await adapter.execute();

      expect(callCount).toBe(0);
    });
  });

  describe("4. Convention-based Error Mapping", () => {
    test("should map domain errors with status property", async () => {
      class ErrorPort implements Port<Input, Output> {
        async execute(): Promise<UseCaseResult<Output>> {
          return {
            success: false,
            error: { message: "Not Found Item", status: 404 } as any,
            status: "abandoned",
          };
        }
      }

      class ErrorAdapter extends DrivingAdapter<Input, Output, ErrorPort> {}

      const req = new Request("http://test.com");
      const adapter = new ErrorAdapter(new ErrorPort(), req, mockEnv, mockCtx as any);
      const response = await adapter.execute();
      const body = (await response.json()) as any;

      expect(response.status).toBe(404);
      expect(body.error).toBe("Not Found Item");
    });
  });

  describe("5. Metadata Management", () => {
    test("should store and retrieve metadata", () => {
      class MetaAdapter extends DrivingAdapter<Input, Output, MockPort> {
        testMeta() {
          this.setMetadata("foo", "bar");
          return this.getMetadata("foo");
        }
        public getMeta(key: string) {
          return this.getMetadata(key);
        }
      }
      const req = new Request("http://test.com");
      const adapter = new MetaAdapter(new MockPort(), req, mockEnv, mockCtx as any);
      expect(adapter.testMeta()).toBe("bar");
      expect(adapter.getMeta("method")).toBe("GET");
    });
  });

  describe("6. BaseAdapter - Custom Extensions", () => {
    test("should support custom adapter types", async () => {
      let workData: any = null;

      class WorkerAdapter extends BaseAdapter {
        async process(data: any) {
          return this.runAroundHooks(async () => {
            workData = data;
            return "done";
          });
        }
      }

      const adapter = new WorkerAdapter(mockEnv, mockCtx as any);
      const result = await adapter.process("task-1");

      expect(result).toBe("done");
      expect(workData).toBe("task-1");
    });
  });
});
