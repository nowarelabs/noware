import { describe, expect, test, vi } from "vite-plus/test";
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

    async failing(): Promise<void> {
      throw new Error("action failed");
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

  test("logger is available after construction", () => {
    const service = createService();
    expect((service as any).logger).toBeDefined();
    expect(typeof (service as any).logger.info).toBe("function");
  });

  test("logger service name matches constructor name", () => {
    const service = createService();
    expect((service as any).logger.withContext).toBeDefined();
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

  test("run calls the named action method", async () => {
    const service = createService();
    const result = await service.run("greet", "world");
    expect(result).toBe("hello world");
  });

  test("run passes multiple args", async () => {
    const service = createService();
    const result = await service.run("add", 2, 3);
    expect(result).toBe(5);
  });

  test("run throws for unknown action", async () => {
    const service = createService();
    await expect(service.run("nonexistent")).rejects.toThrow(
      "Service action 'nonexistent' not found",
    );
  });

  test("run logs error on failure", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const service = createService();
    await expect(service.run("failing")).rejects.toThrow("action failed");

    const errorCall = spy.mock.calls.find((call) => {
      const output = JSON.parse(call[0] as string);
      return output.level === "ERROR" && output.message === "failing failed";
    });
    expect(errorCall).toBeDefined();
    spy.mockRestore();
  });

  test("static before hooks run before the action", async () => {
    const calls: string[] = [];
    class HookedService extends TestService {}

    HookedService.before(async (_svc: any) => {
      calls.push("before");
    });

    const service = createService(HookedService as any);
    await service.run("greet", "world");
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after the action", async () => {
    const calls: string[] = [];
    class HookedService extends TestService {}

    HookedService.after(async (svc: any, result: any) => {
      calls.push("after");
      return result;
    });

    const service = createService(HookedService as any);
    await service.run("greet", "world");
    expect(calls).toEqual(["after"]);
  });

  test("around hook wraps the action call", async () => {
    const calls: string[] = [];
    class AroundService extends TestService {}

    AroundService.around(async (svc: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const result = await next();
      calls.push("after-around");
      return result;
    });

    const service = createService(AroundService as any);
    await service.run("greet", "world");
    expect(calls).toEqual(["before-around", "after-around"]);
  });

  test("full pipeline: before hook -> action -> after hook", async () => {
    const calls: string[] = [];

    class PipelineService extends TestService {}

    PipelineService.before(async (_svc: any) => {
      calls.push("before");
    });

    PipelineService.after(async (svc: any, result: any) => {
      calls.push("after");
      return result;
    });

    const service = createService(PipelineService as any);
    const result = await service.run("greet", "world");
    expect(result).toBe("hello world");
    expect(calls).toEqual(["before", "after"]);
  });
});

describe("withinTransaction", () => {
  function makeMockDb(captured: string[]) {
    return {
      prepare: (sql: string) => ({
        bind: () => ({
          all: async () => {
            captured.push(sql);
            return { results: [] };
          },
        }),
      }),
    };
  }

  class TxService extends BaseService {
    protected model: any;

    protected getModel() {
      return this.model;
    }

    public async callWithinTransaction<T>(fn: (ctx: any) => Promise<T>): Promise<T> {
      return this.withinTransaction(fn as any);
    }
  }

  function createService(captured: string[]) {
    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = createServiceContext();
    const service = new TxService(request, env, ctx);
    (service as any).model = {
      db: makeMockDb(captured),
      ctx: { ...ctx },
    };
    return service;
  }

  test("executes callback and returns result", async () => {
    const captured: string[] = [];
    const service = createService(captured);
    const result = await service.callWithinTransaction(async () => "done");
    expect(result).toBe("done");
  });

  test("swaps model context during transaction and restores after", async () => {
    const captured: string[] = [];
    const service = createService(captured);
    const model: any = (service as any).getModel();
    const origCtx = model.ctx;
    let txCtxDuring: any = null;

    await service.callWithinTransaction(async (txCtx) => {
      txCtxDuring = txCtx;
      expect(model.ctx).toBe(txCtx);
    });

    expect(model.ctx).toBe(origCtx);
    expect(txCtxDuring).not.toBe(origCtx);
    expect(txCtxDuring.transaction).toBeDefined();
  });

  test("restores original context on error", async () => {
    const captured: string[] = [];
    const service = createService(captured);
    const model: any = (service as any).getModel();
    const origCtx = model.ctx;

    try {
      await service.callWithinTransaction(async () => {
        throw new Error("boom");
      });
    } catch {
      // expected
    }

    expect(model.ctx).toBe(origCtx);
  });

  test("issues BEGIN and COMMIT", async () => {
    const captured: string[] = [];
    const service = createService(captured);

    await service.callWithinTransaction(async () => "ok");

    expect(captured.filter((s) => s.includes("BEGIN"))).toHaveLength(1);
    expect(captured.filter((s) => s.includes("COMMIT"))).toHaveLength(1);
    expect(captured.filter((s) => s.includes("ROLLBACK"))).toHaveLength(0);
  });

  test("issues ROLLBACK on error", async () => {
    const captured: string[] = [];
    const service = createService(captured);

    try {
      await service.callWithinTransaction(async () => {
        throw new Error("boom");
      });
    } catch {
      // expected
    }

    expect(captured.filter((s) => s.includes("ROLLBACK"))).toHaveLength(1);
    expect(captured.filter((s) => s.includes("COMMIT"))).toHaveLength(0);
  });
});
