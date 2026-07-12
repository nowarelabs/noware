import { describe, expect, test } from "vite-plus/test";
import { createRouterContext } from "@nowarelabs/shared";
import type { RouterContext } from "@nowarelabs/shared";
import { BaseRouter, type RouteResult } from "../src/index.ts";

describe("BaseRouter", () => {
  class TestController {
    constructor(
      private request: Request,
      private env: Record<string, unknown>,
      private ctx: RouterContext,
    ) {}

    async run(action: string): Promise<Response> {
      if (action === "home") return new Response("home page");
      if (action === "show") return new Response(`show ${this.ctx.params?.id || "none"}`);
      return new Response("Not Found", { status: 404 });
    }
  }

  class TestRouter extends BaseRouter {
    resolveRoute(request: Request): RouteResult | null {
      const url = new URL(request.url);
      if (url.pathname === "/") {
        return {
          Controller: TestController as any,
          action: "home",
          params: {},
        };
      }
      return null;
    }
  }

  function createRouter(routerClass = TestRouter) {
    const router = new routerClass();
    return router;
  }

  test("constructor works", () => {
    const router = createRouter();
    expect(router).toBeDefined();
  });

  test("resolveRoute returns a route for /", () => {
    const router = createRouter();
    const request = new Request("http://localhost/");
    const route = router.resolveRoute(request);
    expect(route).not.toBeNull();
    expect(route!.action).toBe("home");
  });

  test("resolveRoute returns null for unknown path", () => {
    const router = createRouter();
    const request = new Request("http://localhost/unknown");
    const route = router.resolveRoute(request);
    expect(route).toBeNull();
  });

  test("handle dispatches to the controller", async () => {
    const router = createRouter();
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    const response = await router.handle(request, env, ctx);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("home page");
  });

  test("handle returns 404 when no route matches", async () => {
    const router = createRouter();
    const request = new Request("http://localhost/unknown");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    const response = await router.handle(request, env, ctx);
    expect(response.status).toBe(404);
  });

  test("static before hooks run before routing", async () => {
    const calls: string[] = [];
    class HookedRouter extends TestRouter {
      static override beforeHooks: any[] = [];
    }

    HookedRouter.before(async (_r: any) => {
      calls.push("before");
    });

    const router = createRouter(HookedRouter as any);
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    await router.handle(request, env, ctx);
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after routing", async () => {
    const calls: string[] = [];
    class HookedRouter extends TestRouter {
      static override afterHooks: any[] = [];
    }

    HookedRouter.after(async (r: any, result: Response) => {
      calls.push("after");
      return result;
    });

    const router = createRouter(HookedRouter as any);
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    await router.handle(request, env, ctx);
    expect(calls).toEqual(["after"]);
  });

  test("before hook can short-circuit before routing", async () => {
    class ProtectedRouter extends TestRouter {
      static override beforeHooks: any[] = [];
    }

    ProtectedRouter.before(async (_r: any) => {
      return new Response("Blocked before route", { status: 403 });
    });

    const router = createRouter(ProtectedRouter as any);
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    const response = await router.handle(request, env, ctx);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toBe("Blocked before route");
  });

  test("around hook wraps the routing and controller dispatch", async () => {
    const calls: string[] = [];
    class AroundRouter extends TestRouter {
      static override aroundHooks: any[] = [];
    }

    AroundRouter.around(async (r: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const result = await next();
      calls.push("after-around");
      return result;
    });

    const router = createRouter(AroundRouter as any);
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    await router.handle(request, env, ctx);
    expect(calls).toEqual(["before-around", "after-around"]);
  });

  test("static hooks are isolated per subclass", () => {
    class RouterA extends TestRouter {
      static override beforeHooks: any[] = [];
    }
    class RouterB extends TestRouter {
      static override beforeHooks: any[] = [];
    }

    const fnA = async () => {};
    const fnB = async () => {};

    RouterA.before(fnA as any);
    RouterB.before(fnB as any);

    expect(RouterA.beforeHooks).toHaveLength(1);
    expect(RouterB.beforeHooks).toHaveLength(1);
    expect(RouterA.beforeHooks[0].fn).toBe(fnA);
    expect(RouterB.beforeHooks[0].fn).toBe(fnB);
  });
});
