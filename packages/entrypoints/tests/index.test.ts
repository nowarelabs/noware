import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseEntrypoint } from "../src/index.ts";

describe("BaseEntrypoint", () => {
  class MockRouter {
    async handle(_request: Request, _env: Record<string, unknown>, _ctx: any) {
      return new Response("from router");
    }
  }

  class TestEntrypoint extends BaseEntrypoint {
    router = new MockRouter() as any;
  }

  function createEntrypoint(entrypointClass = TestEntrypoint) {
    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;
    return { entrypoint: new entrypointClass(), request, env, ctx };
  }

  test("constructs without args", () => {
    const entrypoint = new TestEntrypoint();
    expect(entrypoint).toBeDefined();
  });

  test("fetch delegates to router", async () => {
    const { entrypoint, request, env, ctx } = createEntrypoint();
    const response = await entrypoint.fetch(request, env, ctx);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("from router");
  });

  test("handle is an alias for fetch", async () => {
    const { entrypoint, request, env, ctx } = createEntrypoint();
    const response = await entrypoint.handle(request, env, ctx);
    expect(response.status).toBe(200);
  });

  test("static hooks exist", () => {
    expect(BaseEntrypoint.beforeHooks).toBeDefined();
    expect(BaseEntrypoint.afterHooks).toBeDefined();
    expect(BaseEntrypoint.aroundHooks).toBeDefined();
  });

  test("static before hooks run before routing", async () => {
    const calls: string[] = [];
    class HookedEntrypoint extends TestEntrypoint {
      static override beforeHooks: any[] = [];
    }

    HookedEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const { entrypoint, request, env, ctx } = createEntrypoint(HookedEntrypoint as any);
    await entrypoint.fetch(request, env, ctx);
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after routing", async () => {
    const calls: string[] = [];
    class HookedEntrypoint extends TestEntrypoint {
      static override afterHooks: any[] = [];
    }

    HookedEntrypoint.after(async (_ep: any, result: Response) => {
      calls.push("after");
      return result;
    });

    const { entrypoint, request, env, ctx } = createEntrypoint(HookedEntrypoint as any);
    await entrypoint.fetch(request, env, ctx);
    expect(calls).toEqual(["after"]);
  });

  test("before hook can short-circuit before routing", async () => {
    class ProtectedEntrypoint extends TestEntrypoint {
      static override beforeHooks: any[] = [];
    }

    ProtectedEntrypoint.before(async (_ep: any) => {
      return new Response("Blocked", { status: 403 });
    });

    const { entrypoint, request, env, ctx } = createEntrypoint(ProtectedEntrypoint as any);
    const response = await entrypoint.fetch(request, env, ctx);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toBe("Blocked");
  });

  test("around hook wraps the routing", async () => {
    const calls: string[] = [];
    class AroundEntrypoint extends TestEntrypoint {
      static override aroundHooks: any[] = [];
    }

    AroundEntrypoint.around(async (_ep: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const result = await next();
      calls.push("after-around");
      return result;
    });

    const { entrypoint, request, env, ctx } = createEntrypoint(AroundEntrypoint as any);
    await entrypoint.fetch(request, env, ctx);
    expect(calls).toEqual(["before-around", "after-around"]);
  });
});
