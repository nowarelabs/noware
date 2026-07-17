import { describe, expect, test, vi } from "vite-plus/test";
import { createRouterContext } from "@nowarelabs/shared";
import type { RouterContext } from "@nowarelabs/shared";
import {
  BaseRouter,
  HttpRouter,
  RouteDrawer,
  type RouteResult,
  type RouterPlugin,
} from "../src/index.ts";

// ── Helpers ──────────────────────────────────────────────────────

class StubController {
  constructor(
    private request: Request,
    private env: Record<string, unknown>,
    private ctx: RouterContext,
  ) {}

  async run(action: string): Promise<Response> {
    const params = this.ctx?.params ?? {};
    if (action === "index") return new Response(JSON.stringify({ items: [] }));
    if (action === "show") return new Response(`show ${params.id ?? "none"}`);
    if (action === "create") return new Response("created", { status: 201 });
    if (action === "update") return new Response("updated");
    if (action === "destroy") return new Response("deleted");
    if (action === "new") return new Response("new form");
    if (action === "edit") return new Response(`edit form ${params.id}`);
    return new Response(`${action} OK`);
  }
}

function req(method: string, path: string): Request {
  return new Request(`http://localhost${path}`, { method });
}

function env(): Record<string, unknown> {
  return {};
}

// ── BaseRouter ───────────────────────────────────────────────────

describe("BaseRouter", () => {
  class TestRouter extends BaseRouter {
    resolveRoute(request: Request): RouteResult | null {
      const url = new URL(request.url);
      if (url.pathname === "/") {
        return { Controller: StubController as any, action: "home", params: {} };
      }
      return null;
    }
  }

  test("constructor works", () => {
    expect(new TestRouter()).toBeDefined();
  });

  test("resolveRoute returns a route for /", () => {
    const router = new TestRouter();
    const route = router.resolveRoute(req("GET", "/"));
    expect(route).not.toBeNull();
    expect(route!.action).toBe("home");
  });

  test("resolveRoute returns null for unknown path", () => {
    const router = new TestRouter();
    expect(router.resolveRoute(req("GET", "/unknown"))).toBeNull();
  });

  test("handle dispatches to the controller", async () => {
    const router = new TestRouter();
    const response = await router.handle(req("GET", "/"), env(), createRouterContext());
    expect(response.status).toBe(200);
  });

  test("handle returns 404 when no route matches", async () => {
    const router = new TestRouter();
    const response = await router.handle(req("GET", "/unknown"), env(), createRouterContext());
    expect(response.status).toBe(404);
  });

  test("static before hooks run before routing", async () => {
    const calls: string[] = [];
    class HookedRouter extends TestRouter {
    }
    HookedRouter.before(async () => {
      calls.push("before");
    });

    const router = new HookedRouter();
    await router.handle(req("GET", "/"), env(), createRouterContext());
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after routing", async () => {
    const calls: string[] = [];
    class HookedRouter extends TestRouter {
    }
    HookedRouter.after(async (_r: any, result: Response) => {
      calls.push("after");
      return result;
    });

    const router = new HookedRouter();
    await router.handle(req("GET", "/"), env(), createRouterContext());
    expect(calls).toEqual(["after"]);
  });

  test("before hook can short-circuit", async () => {
    class ProtectedRouter extends TestRouter {
    }
    ProtectedRouter.before(async () => new Response("Blocked", { status: 403 }));

    const response = await new ProtectedRouter().handle(
      req("GET", "/"),
      env(),
      createRouterContext(),
    );
    expect(response.status).toBe(403);
  });

  test("around hook wraps the routing", async () => {
    const calls: string[] = [];
    class AroundRouter extends TestRouter {
    }
    AroundRouter.around(async (_r: any, next: () => Promise<any>) => {
      calls.push("before");
      const result = await next();
      calls.push("after");
      return result;
    });

    await new AroundRouter().handle(req("GET", "/"), env(), createRouterContext());
    expect(calls).toEqual(["before", "after"]);
  });

  test("static hooks are isolated per subclass", () => {
    class RouterA extends TestRouter {
    }
    class RouterB extends TestRouter {
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

  test("hook inheritance: parent hooks apply to child", async () => {
    const calls: string[] = [];
    class Parent extends TestRouter {}
    class Child extends Parent {}
    Parent.before(async () => {
      calls.push("parent");
    });

    await new Child().handle(req("GET", "/"), env(), createRouterContext());
    expect(calls).toEqual(["parent"]);
  });
});

// ── HttpRouter ───────────────────────────────────────────────────

describe("HttpRouter", () => {
  function createRouter() {
    const router = new HttpRouter();
    router.route("GET", "/", StubController as any, "index");
    router.route("GET", "/users/:id", StubController as any, "show");
    router.route("GET", "/users/:id/posts/:postId", StubController as any, "show");
    return router;
  }

  test("route registration and resolveRoute match", () => {
    const router = createRouter();
    const result = router.resolveRoute(req("GET", "/"));
    expect(result).not.toBeNull();
    expect(result!.action).toBe("index");
  });

  test("resolveRoute extracts path params", () => {
    const router = createRouter();
    const result = router.resolveRoute(req("GET", "/users/42"));
    expect(result).not.toBeNull();
    expect(result!.action).toBe("show");
    expect(result!.params).toEqual({ id: "42" });
  });

  test("resolveRoute returns null for unknown path", () => {
    const router = createRouter();
    expect(router.resolveRoute(req("GET", "/unknown"))).toBeNull();
  });

  test("resolveRoute returns null for wrong method", () => {
    const router = createRouter();
    expect(router.resolveRoute(req("POST", "/"))).toBeNull();
  });

  test("handle dispatches matched route", async () => {
    const router = createRouter();
    const response = await router.handle(req("GET", "/users/99"), env(), createRouterContext());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("show 99");
  });

  test("handle returns 404 when no route matches", async () => {
    const router = createRouter();
    const response = await router.handle(req("GET", "/unknown"), env(), createRouterContext());
    expect(response.status).toBe(404);
  });

  test("multiple path params extracted correctly", () => {
    const router = createRouter();
    const result = router.resolveRoute(req("GET", "/users/7/posts/abc"));
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: "7", postId: "abc" });
  });

  test("chained route registration", () => {
    const router = new HttpRouter();
    router
      .route("GET", "/", StubController as any, "index")
      .route("GET", "/about", StubController as any, "show");
    expect(router.resolveRoute(req("GET", "/"))).not.toBeNull();
    expect(router.resolveRoute(req("GET", "/about"))).not.toBeNull();
  });

  // ── HTTP verb helpers ──────────────────────────────────────

  test(".get() registers GET route", async () => {
    const router = new HttpRouter();
    router.get("/hello", StubController as any, "show");
    const result = router.resolveRoute(req("GET", "/hello"));
    expect(result).not.toBeNull();
    expect(result!.action).toBe("show");
  });

  test(".post() registers POST route", async () => {
    const router = new HttpRouter();
    router.post("/items", StubController as any, "create");
    const result = router.resolveRoute(req("POST", "/items"));
    expect(result).not.toBeNull();
    expect(result!.action).toBe("create");
  });

  test(".put() registers PUT route", async () => {
    const router = new HttpRouter();
    router.put("/items/:id", StubController as any, "update");
    const result = router.resolveRoute(req("PUT", "/items/5"));
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: "5" });
  });

  test(".patch() registers PATCH route", async () => {
    const router = new HttpRouter();
    router.patch("/items/:id", StubController as any, "update");
    const result = router.resolveRoute(req("PATCH", "/items/5"));
    expect(result).not.toBeNull();
    expect(result!.action).toBe("update");
  });

  test(".delete() registers DELETE route", async () => {
    const router = new HttpRouter();
    router.delete("/items/:id", StubController as any, "destroy");
    const result = router.resolveRoute(req("DELETE", "/items/5"));
    expect(result).not.toBeNull();
    expect(result!.action).toBe("destroy");
  });

  // ── resources() ────────────────────────────────────────────

  test("resources() registers standard REST routes", () => {
    const router = new HttpRouter();
    router.resources("/users", StubController as any);

    expect(router.resolveRoute(req("GET", "/users"))?.action).toBe("index");
    expect(router.resolveRoute(req("POST", "/users"))?.action).toBe("create");
    expect(router.resolveRoute(req("GET", "/users/new"))?.action).toBe("new");
    expect(router.resolveRoute(req("GET", "/users/1"))?.action).toBe("show");
    expect(router.resolveRoute(req("GET", "/users/1/edit"))?.action).toBe("edit");
    expect(router.resolveRoute(req("PUT", "/users/1"))?.action).toBe("update");
    expect(router.resolveRoute(req("PATCH", "/users/1"))?.action).toBe("update");
    expect(router.resolveRoute(req("DELETE", "/users/1"))?.action).toBe("destroy");
  });

  test("resources() with only option", () => {
    const router = new HttpRouter();
    router.resources("/users", StubController as any, { only: ["index", "show"] });

    expect(router.resolveRoute(req("GET", "/users"))?.action).toBe("index");
    expect(router.resolveRoute(req("GET", "/users/1"))?.action).toBe("show");
    expect(router.resolveRoute(req("POST", "/users"))).toBeNull();
    expect(router.resolveRoute(req("DELETE", "/users/1"))).toBeNull();
  });

  test("resources() with except option", () => {
    const router = new HttpRouter();
    router.resources("/users", StubController as any, { except: ["destroy", "new"] });

    expect(router.resolveRoute(req("GET", "/users"))?.action).toBe("index");
    expect(router.resolveRoute(req("DELETE", "/users/1"))).toBeNull();
    // /users/new is not registered as "new", but matches /users/:id param route
    expect(router.resolveRoute(req("GET", "/users/new"))?.params).toEqual({ id: "new" });
  });

  // ── resourceActions() ──────────────────────────────────────

  test("resourceActions() registers custom actions", () => {
    const router = new HttpRouter();
    router.resourceActions("/users", StubController as any, {
      archive: "POST",
      publish: "PATCH",
    });

    expect(router.resolveRoute(req("POST", "/users/archive"))?.action).toBe("archive");
    expect(router.resolveRoute(req("PATCH", "/users/publish"))?.action).toBe("publish");
    expect(router.resolveRoute(req("GET", "/users/archive"))).toBeNull();
  });

  test("resourceActions() handles index action at root", () => {
    const router = new HttpRouter();
    router.resourceActions("/users", StubController as any, {
      index: "GET",
      export: "POST",
    });

    expect(router.resolveRoute(req("GET", "/users"))?.action).toBe("index");
    expect(router.resolveRoute(req("POST", "/users/export"))?.action).toBe("export");
  });

  // ── Resources param extraction ─────────────────────────────

  test("resources() extracts params correctly", async () => {
    const router = new HttpRouter();
    router.resources("/users", StubController as any);

    const result = router.resolveRoute(req("GET", "/users/42"));
    expect(result).not.toBeNull();
    expect(result!.params.id).toBe("42");

    const editResult = router.resolveRoute(req("GET", "/users/42/edit"));
    expect(editResult).not.toBeNull();
    expect(editResult!.params.id).toBe("42");
  });
});

// ── Middleware ───────────────────────────────────────────────────

describe("Middleware", () => {
  function createControllerReturning(text: string) {
    return class {
      async run() {
        return new Response(text);
      }
    } as any;
  }

  test("use() adds middleware that runs before action", async () => {
    const order: string[] = [];
    const router = new HttpRouter();
    router.get("/", createControllerReturning("ok"), "run");

    router.use(async (_req, _env, _ctx, next) => {
      order.push("mw");
      return await next();
    });

    await router.handle(req("GET", "/"), env(), createRouterContext());
    expect(order).toEqual(["mw"]);
  });

  test("middleware chain runs in order", async () => {
    const order: string[] = [];
    const router = new HttpRouter();
    router.get("/", createControllerReturning("ok"), "run");

    router.use(async (_req, _env, _ctx, next) => {
      order.push("first");
      return await next();
    });
    router.use(async (_req, _env, _ctx, next) => {
      order.push("second");
      return await next();
    });

    await router.handle(req("GET", "/"), env(), createRouterContext());
    expect(order).toEqual(["first", "second"]);
  });

  test("middleware can short-circuit", async () => {
    const router = new HttpRouter();
    router.get("/", createControllerReturning("ok"), "run");

    router.use(async () => new Response("blocked", { status: 403 }));

    const response = await router.handle(req("GET", "/"), env(), createRouterContext());
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("blocked");
  });

  test("applyMiddleware() adds middleware at the front", async () => {
    const order: string[] = [];
    const router = new HttpRouter();
    router.get("/", createControllerReturning("ok"), "run");

    router.use(async (_req, _env, _ctx, next) => {
      order.push("last");
      return await next();
    });
    router.applyMiddleware(async (_req, _env, _ctx, next) => {
      order.push("first");
      return await next();
    });

    await router.handle(req("GET", "/"), env(), createRouterContext());
    expect(order).toEqual(["first", "last"]);
  });

  test("middleware is not called for 404 routes", async () => {
    const mw = vi.fn(async (_req: any, _env: any, _ctx: any, next: any) => next());
    const router = new HttpRouter();
    router.get("/", createControllerReturning("ok"), "run");
    router.use(mw);

    const response = await router.handle(req("GET", "/missing"), env(), createRouterContext());
    expect(response.status).toBe(404);
    expect(mw).not.toHaveBeenCalled();
  });
});

// ── Plugins ─────────────────────────────────────────────────────

describe("Plugins", () => {
  test("plugin() calls install on the plugin", () => {
    const installed = vi.fn();
    const myPlugin: RouterPlugin = { name: "test", install: installed };

    const router = new HttpRouter();
    router.plugin(myPlugin);

    expect(installed).toHaveBeenCalledWith(router);
  });

  test("multiple plugins are installed", () => {
    const calls: string[] = [];
    const pluginA: RouterPlugin = {
      name: "a",
      install: () => {
        calls.push("a");
      },
    };
    const pluginB: RouterPlugin = {
      name: "b",
      install: () => {
        calls.push("b");
      },
    };

    const router = new HttpRouter();
    router.plugin(pluginA, pluginB);

    expect(calls).toEqual(["a", "b"]);
  });
});

// ── RouteDrawer ──────────────────────────────────────────────────

describe("RouteDrawer", () => {
  test("add() and getEntries() works", () => {
    const drawer = new RouteDrawer();
    drawer.add("GET", "/users", "UserController", "index");
    drawer.add("POST", "/users", "UserController", "create");

    const entries = drawer.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].method).toBe("GET");
    expect(entries[0].path).toBe("/users");
  });

  test("toString() returns a formatted table", () => {
    const drawer = new RouteDrawer();
    drawer.add("GET", "/users", "UserController", "index");
    drawer.add("POST", "/users", "UserController", "create");
    drawer.add("GET", "/users/:id", "UserController", "show");

    const output = drawer.toString();
    expect(output).toContain("GET");
    expect(output).toContain("POST");
    expect(output).toContain("/users");
    expect(output).toContain("UserController");
    expect(output).toContain("index");
  });

  test("HttpRouter.drawer is populated", () => {
    const router = new HttpRouter();
    router.get("/", StubController as any, "index");
    router.post("/users", StubController as any, "create");

    const entries = router.drawer.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.method === "GET" && e.action === "index")).toBe(true);
    expect(entries.some((e) => e.method === "POST" && e.action === "create")).toBe(true);
  });

  test("resources() populates drawer with all routes", () => {
    const router = new HttpRouter();
    router.resources("/posts", StubController as any);

    const entries = router.drawer.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(8);
    const actions = entries.map((e) => e.action);
    expect(actions).toContain("index");
    expect(actions).toContain("create");
    expect(actions).toContain("show");
    expect(actions).toContain("new");
    expect(actions).toContain("edit");
    expect(actions).toContain("update");
    expect(actions).toContain("destroy");
  });
});

// ── Logger Integration ──────────────────────────────────────────

describe("Logger Integration", () => {
  test("withLogger() sets logger on router", () => {
    const router = new HttpRouter();
    expect(router.logger).toBeUndefined();

    const mockLogger = { withContext: vi.fn().mockReturnThis() } as any;
    router.withLogger(mockLogger);
    expect(router.logger).toBe(mockLogger);
  });
});
