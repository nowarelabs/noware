import { describe, expect, test } from "vite-plus/test";
import { createServiceContext } from "@nowarelabs/shared";
import type { ServiceContext } from "@nowarelabs/shared";
import { BaseService } from "../src/index.ts";

describe("BaseService", () => {
  class TestService extends BaseService {
    protected model = {};

    protected getModel() {
      return this.model;
    }

    async greet(name: string): Promise<string> {
      return `hello ${name}`;
    }

    async add(a: number, b: number): Promise<number> {
      return a + b;
    }
  }

  function createService(serviceClass = TestService) {
    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = createServiceContext();
    return new serviceClass(request, env, ctx);
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = createServiceContext();

    const service = new TestService(mockRequest, mockEnv, mockCtx);

    expect(service).toBeDefined();
    expect((service as unknown as { request: Request }).request).toBe(mockRequest);
    expect((service as unknown as { env: Record<string, unknown> }).env).toBe(mockEnv);
    expect((service as unknown as { ctx: ServiceContext }).ctx).toBe(mockCtx);
  });

  test("getModel returns the model", () => {
    const service = createService();

    expect((service as unknown as { getModel: () => object }).getModel()).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseService.beforeHooks).toBeDefined();
    expect(BaseService.afterHooks).toBeDefined();
    expect(BaseService.aroundHooks).toBeDefined();
  });

  test("execute calls the named action method", async () => {
    const service = createService();
    const result = await service.execute("greet", "world");
    expect(result).toBe("hello world");
  });

  test("execute passes multiple args", async () => {
    const service = createService();
    const result = await service.execute("add", 2, 3);
    expect(result).toBe(5);
  });

  test("execute throws for unknown action", async () => {
    const service = createService();
    await expect(service.execute("nonexistent")).rejects.toThrow(
      "Service action 'nonexistent' not found",
    );
  });

  test("static before hooks run before the action", async () => {
    const calls: string[] = [];
    class HookedService extends TestService {
      static override beforeHooks: any[] = [];
    }

    HookedService.before(async (_svc: any) => {
      calls.push("before");
    });

    const service = createService(HookedService as any);
    await service.execute("greet", "world");
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after the action", async () => {
    const calls: string[] = [];
    class HookedService extends TestService {
      static override afterHooks: any[] = [];
    }

    HookedService.after(async (svc: any, result: any) => {
      calls.push("after");
      return result;
    });

    const service = createService(HookedService as any);
    await service.execute("greet", "world");
    expect(calls).toEqual(["after"]);
  });

  test("around hook wraps the action call", async () => {
    const calls: string[] = [];
    class AroundService extends TestService {
      static override aroundHooks: any[] = [];
    }

    AroundService.around(async (svc: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const result = await next();
      calls.push("after-around");
      return result;
    });

    const service = createService(AroundService as any);
    await service.execute("greet", "world");
    expect(calls).toEqual(["before-around", "after-around"]);
  });

  test("full pipeline: before hook -> action -> after hook", async () => {
    const calls: string[] = [];

    class PipelineService extends TestService {
      static override beforeHooks: any[] = [];
      static override afterHooks: any[] = [];
    }

    PipelineService.before(async (_svc: any) => {
      calls.push("before");
    });

    PipelineService.after(async (svc: any, result: any) => {
      calls.push("after");
      return result;
    });

    const service = createService(PipelineService as any);
    const result = await service.execute("greet", "world");
    expect(result).toBe("hello world");
    expect(calls).toEqual(["before", "after"]);
  });
});
