import { describe, expect, test } from "vite-plus/test";
import { createRouterContext } from "@nowarelabs/shared";
import type { RouterContext } from "@nowarelabs/shared";
import { BaseRouter, HttpRouter, type RouteResult } from "../src/index.ts";

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

  test("hook inheritance: parent hooks apply to child without own arrays", async () => {
    const calls: string[] = [];
    class Parent extends TestRouter {}
    class Child extends Parent {}

    Parent.before(async (_r: any) => {
      calls.push("parent-before");
    });

    const router = new Child();
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    await router.handle(request, env, ctx);
    expect(calls).toEqual(["parent-before"]);
  });

  test("hook inheritance: child hooks don't leak to parent", async () => {
    const calls: string[] = [];
    class Parent extends TestRouter {}
    class Child extends Parent {}

    Child.before(async (_r: any) => {
      calls.push("child-before");
    });

    const parentRouter = new Parent();
    const childRouter = new Child();
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    await parentRouter.handle(request, env, ctx);
    expect(calls).toEqual([]);

    await childRouter.handle(request, env, ctx);
    expect(calls).toEqual(["child-before"]);
  });

  test("hook inheritance: parent + child hooks run in correct order", async () => {
    const calls: string[] = [];
    class Parent extends TestRouter {}
    class Child extends Parent {}

    Parent.before(async (_r: any) => {
      calls.push("parent-before");
    });

    Child.before(async (_r: any) => {
      calls.push("child-before");
    });

    const router = new Child();
    const request = new Request("http://localhost/");
    const env = {} as Record<string, unknown>;
    const ctx = createRouterContext();

    await router.handle(request, env, ctx);
    expect(calls).toEqual(["parent-before", "child-before"]);
  });
});

describe("HttpRouter", () => {
  class TestController {
    constructor(
      private _request: Request,
      private _env: Record<string, unknown>,
      private _ctx: RouterContext,
    ) {}

    async run(action: string): Promise<Response> {
      if (action === "home") return new Response("home page");
      if (action === "show") return new Response(`show ${this._ctx.params?.id ?? "none"}`);
      if (action === "nested") return new Response(`nested ${this._ctx.params?.id ?? "none"}`);
      return new Response("Not Found", { status: 404 });
    }
  }

  function createRouter() {
    const router = new HttpRouter();
    router.route("GET", "/", TestController as any, "home");
    router.route("GET", "/users/:id", TestController as any, "show");
    router.route("GET", "/users/:id/posts/:postId", TestController as any, "nested");
    return router;
  }

  test("route registration and resolveRoute match", () => {
    const router = createRouter();
    const request = new Request("http://localhost/");
    const result = router.resolveRoute(request);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("home");
  });

  test("resolveRoute extracts path params", () => {
    const router = createRouter();
    const request = new Request("http://localhost/users/42");
    const result = router.resolveRoute(request);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("show");
    expect(result!.params).toEqual({ id: "42" });
  });

  test("resolveRoute returns null for unknown path", () => {
    const router = createRouter();
    const request = new Request("http://localhost/unknown");
    const result = router.resolveRoute(request);
    expect(result).toBeNull();
  });

  test("resolveRoute returns null for wrong method", () => {
    const router = createRouter();
    const request = new Request("http://localhost/", { method: "POST" });
    const result = router.resolveRoute(request);
    expect(result).toBeNull();
  });

  test("handle dispatches matched route to controller", async () => {
    const router = createRouter();
    const response = await router.handle(
      new Request("http://localhost/users/99"),
      {},
      createRouterContext(),
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("show 99");
  });

  test("handle returns 404 when no route matches", async () => {
    const router = createRouter();
    const response = await router.handle(
      new Request("http://localhost/unknown"),
      {},
      createRouterContext(),
    );
    expect(response.status).toBe(404);
  });

  test("multiple path params extracted correctly", () => {
    const router = createRouter();
    const request = new Request("http://localhost/users/7/posts/abc");
    const result = router.resolveRoute(request);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: "7", postId: "abc" });
  });

  test("chained route registration", () => {
    const router = new HttpRouter();
    router
      .route("GET", "/", TestController as any, "home")
      .route("GET", "/about", TestController as any, "about");

    expect(router.resolveRoute(new Request("http://localhost/"))).not.toBeNull();
    expect(router.resolveRoute(new Request("http://localhost/about"))).not.toBeNull();
  });
});
