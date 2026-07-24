import { describe, expect, test, vi } from "vite-plus/test";
import { BaseController, BaseResourceController } from "../src/index.ts";
import { HttpError, NotFoundError } from "@nowarelabs/shared";

function mockCtx(params: Record<string, string> = {}) {
  return { params, waitUntil: () => {} } as any;
}

describe("BaseController", () => {
  class TestController extends BaseController {
    protected service = {};

    getService() {
      return this.service;
    }

    async index(): Promise<Response> {
      return this.json({ ok: true });
    }

    async show(): Promise<Response> {
      return this.text(`item ${this.params.id}`);
    }

    async redirectMe(): Promise<Response> {
      return this.redirect("/login");
    }

    async showHtml(): Promise<Response> {
      return this.html("<h1>Hello</h1>");
    }

    async showXml(): Promise<Response> {
      return this.xml("<root/>");
    }

    async showCsv(): Promise<Response> {
      return this.csv("a,b,c");
    }

    async notFoundAction(): Promise<Response> {
      return this.notFound();
    }

    async badRequestAction(): Promise<Response> {
      return this.badRequest("invalid");
    }

    async unauthorizedAction(): Promise<Response> {
      return this.unauthorized();
    }

    async forbiddenAction(): Promise<Response> {
      return this.forbidden();
    }

    async serverErrorAction(): Promise<Response> {
      return this.serverError("boom");
    }

    async respondWithErrorAction(): Promise<Response> {
      return this.respondWithError(new NotFoundError("custom not found", { resource: "user" }));
    }

    async respondWithGenericError(): Promise<Response> {
      return this.respondWithError(new HttpError("Something failed", 503));
    }

    async readCookies(): Promise<Response> {
      return this.json(this.cookies);
    }

    async setCookies(): Promise<Response> {
      this.setCookie("token", "abc", { httpOnly: true, path: "/" });
      this.setCookie("lang", "en");
      return this.json({ ok: true });
    }

    async deleteCookies(): Promise<Response> {
      this.deleteCookie("token");
      return this.json({ ok: true });
    }

    async requestInfo(): Promise<Response> {
      return this.json({
        method: this.method,
        path: this.path,
        ip: this.ip,
        hasUrl: this.url instanceof URL,
      });
    }
  }

  class AuthController extends TestController {
    protected override async beforeAction(): Promise<Response | void> {
      if (!this.request.headers.get("Authorization")) {
        return this.unauthorized();
      }
    }
  }

  function createController(
    controllerClass = TestController,
    overrides?: {
      path?: string;
      method?: string;
      headers?: Record<string, string>;
    },
  ) {
    const path = overrides?.path || "http://localhost";
    const method = overrides?.method || "GET";
    const headers = overrides?.headers || { Authorization: "Bearer token" };
    const request = new Request(path, { method, headers });
    const env = {} as Record<string, unknown>;
    return new controllerClass(request, env, mockCtx());
  }

  function createControllerWithParams(
    params: Record<string, string>,
    controllerClass = TestController,
  ) {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer token" },
    });
    const env = {} as Record<string, unknown>;
    return new controllerClass(request, env, mockCtx(params));
  }

  test("constructor accepts request, env, ctx", () => {
    const controller = createController();
    expect(controller).toBeDefined();
  });

  test("logger is available after construction", () => {
    const controller = createController();
    expect((controller as any).logger).toBeDefined();
    expect(typeof (controller as any).logger.info).toBe("function");
  });

  test("run logs error on failure", async () => {
    class FailingController extends TestController {
      async explode(): Promise<Response> {
        throw new Error("boom");
      }
    }
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const controller = new FailingController(request, env, mockCtx());
    await expect(controller.run("explode")).rejects.toThrow("boom");

    const errorCall = spy.mock.calls.find((call) => {
      const output = JSON.parse(call[0] as string);
      return output.level === "ERROR" && output.message === "explode failed";
    });
    expect(errorCall).toBeDefined();
    spy.mockRestore();
  });

  test("getService returns the service", () => {
    const controller = createController();
    expect(controller.getService()).toEqual({});
  });

  test("static plugin points exist", () => {
    expect(BaseController.beforeHooks).toBeDefined();
    expect(BaseController.afterHooks).toBeDefined();
    expect(BaseController.aroundHooks).toBeDefined();
  });

  test("run calls the named action method", async () => {
    const controller = createController();
    const response = await controller.run("index");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  test("run returns 404 for unknown action", async () => {
    const controller = createController();
    const response = await controller.run("nonexistent");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("nonexistent");
  });

  test("json helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("index");
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  test("text helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("show");
    expect(response.headers.get("content-type")).toBe("text/plain");
  });

  test("html helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("showHtml");
    expect(response.headers.get("content-type")).toBe("text/html");
  });

  test("xml helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("showXml");
    expect(response.headers.get("content-type")).toBe("application/xml");
  });

  test("csv helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("showCsv");
    expect(response.headers.get("content-type")).toBe("text/csv");
  });

  test("redirect helper returns 302", async () => {
    const controller = createController();
    const response = await controller.run("redirectMe");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  test("notFound helper returns 404 with JSON", async () => {
    const controller = createController();
    const response = await controller.run("notFoundAction");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Not Found");
  });

  test("badRequest helper returns 400 with JSON", async () => {
    const controller = createController();
    const response = await controller.run("badRequestAction");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid");
  });

  test("unauthorized helper returns 401 with JSON", async () => {
    const controller = createController();
    const response = await controller.run("unauthorizedAction");
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("forbidden helper returns 403 with JSON", async () => {
    const controller = createController();
    const response = await controller.run("forbiddenAction");
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  test("serverError helper returns 500 with JSON", async () => {
    const controller = createController();
    const response = await controller.run("serverErrorAction");
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("boom");
  });

  test("respondWithError returns correct status and message", async () => {
    const controller = createController();
    const response = await controller.run("respondWithErrorAction");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("custom not found");
  });

  test("respondWithError includes details when present", async () => {
    const controller = createController();
    const response = await controller.run("respondWithErrorAction");
    const body = await response.json();
    expect(body.details).toEqual({ resource: "user" });
  });

  test("respondWithError omits details when not present", async () => {
    const controller = createController();
    const response = await controller.run("respondWithGenericError");
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("Something failed");
    expect(body.details).toBeUndefined();
  });

  test("params returns route params from ctx", async () => {
    const controller = createControllerWithParams({ id: "42" });
    const response = await controller.run("show");
    const body = await response.text();
    expect(body).toBe("item 42");
  });

  test("queryParams parses URL search params", () => {
    const request = new Request("http://localhost?q=test&page=2", {
      headers: { Authorization: "Bearer token" },
    });
    const env = {} as Record<string, unknown>;
    const controller = new TestController(request, env, mockCtx());
    expect((controller as any).queryParams).toEqual({ q: "test", page: "2" });
  });

  test("requestInfo returns method, path, ip, url", async () => {
    const controller = createController();
    const response = await controller.run("requestInfo");
    const body = await response.json();
    expect(body.method).toBe("GET");
    expect(body.path).toBe("/");
    expect(body.hasUrl).toBe(true);
  });

  test("cookies parses request cookies", async () => {
    const request = new Request("http://localhost", {
      headers: {
        Authorization: "Bearer token",
        Cookie: "token=abc; lang=en",
      },
    });
    const env = {} as Record<string, unknown>;
    const controller = new TestController(request, env, mockCtx());
    const response = await controller.run("readCookies");
    const body = await response.json();
    expect(body.token).toBe("abc");
    expect(body.lang).toBe("en");
  });

  test("setCookie accumulates cookies on response", async () => {
    const controller = createController();
    const response = await controller.run("setCookies");
    expect(response.status).toBe(200);
    const cookieHeader = response.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain("token=abc");
    expect(cookieHeader).toContain("lang=en");
  });

  test("deleteCookie sets max-age=0", async () => {
    const controller = createController();
    const response = await controller.run("deleteCookies");
    expect(response.status).toBe(200);
    const cookieHeader = response.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain("token=");
    expect(cookieHeader).toContain("Max-Age=0");
  });

  test("beforeAction convention intercepts requests", async () => {
    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const controller = new AuthController(request, env, mockCtx());

    const response = await controller.run("index");
    expect(response.status).toBe(401);
  });

  test("beforeAction convention passes through when condition met", async () => {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer token" },
    });
    const env = {} as Record<string, unknown>;
    const controller = new AuthController(request, env, mockCtx());

    const response = await controller.run("index");
    expect(response.status).toBe(200);
  });

  test("static before hooks run before the action", async () => {
    const calls: string[] = [];
    class HookedController extends TestController {}

    HookedController.before(async (_ctrl: any) => {
      calls.push("before");
    });

    const controller = createController(HookedController as any);
    await controller.run("index");
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after the action", async () => {
    const calls: string[] = [];
    class HookedController extends TestController {}

    HookedController.after(async (ctrl: any, result: any) => {
      calls.push("after");
      return result;
    });

    const controller = createController(HookedController as any);
    await controller.run("index");
    expect(calls).toEqual(["after"]);
  });

  test("before hook can short-circuit with a response", async () => {
    class ProtectedController extends TestController {}

    ProtectedController.before(async (_ctrl: any) => {
      return new Response("Blocked", { status: 403 });
    });

    const controller = createController(ProtectedController as any);
    const response = await controller.run("index");
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toBe("Blocked");
  });

  test("after hook can transform the response", async () => {
    class TransformController extends TestController {}

    TransformController.after(async (_ctrl: any, _result: Response) => {
      return new Response("Transformed", { status: 201 });
    });

    const controller = createController(TransformController as any);
    const response = await controller.run("index");
    expect(response.status).toBe(201);
    const body = await response.text();
    expect(body).toBe("Transformed");
  });

  test("around hook wraps the action call", async () => {
    const calls: string[] = [];
    class AroundController extends TestController {}

    AroundController.around(async (ctrl: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const result = await next();
      calls.push("after-around");
      return result;
    });

    const controller = createController(AroundController as any);
    await controller.run("index");
    expect(calls).toEqual(["before-around", "after-around"]);
  });

  test("full pipeline: beforeAction -> before hook -> action -> after hook -> afterAction", async () => {
    const calls: string[] = [];

    class FullPipelineController extends TestController {
      protected override async beforeAction(): Promise<Response | void> {
        calls.push("instance-before");
      }

      protected override async afterAction(_result: Response): Promise<Response | void> {
        calls.push("instance-after");
      }
    }

    FullPipelineController.before(async (_ctrl: any) => {
      calls.push("static-before");
    });

    FullPipelineController.after(async (ctrl: any, result: Response) => {
      calls.push("static-after");
      return result;
    });

    const controller = createController(FullPipelineController as any);
    await controller.run("index");
    expect(calls).toEqual(["instance-before", "static-before", "static-after", "instance-after"]);
  });

  test("hook inheritance: parent hooks apply to child without own arrays", async () => {
    const calls: string[] = [];
    class Parent extends TestController {}
    class Child extends Parent {}

    Parent.before(async (_c: any) => {
      calls.push("parent-before");
    });

    const ctrl = createController(Child as any);
    await ctrl.run("index");
    expect(calls).toEqual(["parent-before"]);
  });

  test("hook inheritance: child hooks don't leak to parent", async () => {
    const calls: string[] = [];
    class Parent extends TestController {}
    class Child extends Parent {}

    Child.before(async (_c: any) => {
      calls.push("child-before");
    });

    const parentCtrl = createController(Parent as any);
    const childCtrl = createController(Child as any);

    await parentCtrl.run("index");
    expect(calls).toEqual([]);

    await childCtrl.run("index");
    expect(calls).toEqual(["child-before"]);
  });

  test("hook inheritance: parent + child hooks run in correct order", async () => {
    const calls: string[] = [];
    class Parent extends TestController {}
    class Child extends Parent {}

    Parent.before(async (_c: any) => {
      calls.push("parent-before");
    });

    Child.before(async (_c: any) => {
      calls.push("child-before");
    });

    const ctrl = createController(Child as any);
    await ctrl.run("index");
    expect(calls).toEqual(["parent-before", "child-before"]);
  });

  test("before hook with only option runs only for specified actions", async () => {
    const calls: string[] = [];
    class FilteredController extends TestController {}

    FilteredController.before(
      async (_ctrl: any) => {
        calls.push("filtered-before");
      },
      { only: ["show"] },
    );

    const controller = createController(FilteredController as any);
    await controller.run("index");
    expect(calls).toEqual([]);

    await controller.run("show");
    expect(calls).toEqual(["filtered-before"]);
  });

  test("before hook with except option skips specified actions", async () => {
    const calls: string[] = [];
    class FilteredController extends TestController {}

    FilteredController.before(
      async (_ctrl: any) => {
        calls.push("filtered-before");
      },
      { except: ["index"] },
    );

    const controller = createController(FilteredController as any);
    await controller.run("index");
    expect(calls).toEqual([]);

    await controller.run("show");
    expect(calls).toEqual(["filtered-before"]);
  });
});

describe("BaseResourceController", () => {
  function createDataAccessor() {
    const items = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    return {
      columnNames: ["id", "name"],
      query() {
        let _where: Record<string, any> = {};
        return {
          where(conditions: Record<string, any>) {
            _where = conditions;
            return this;
          },
          all() {
            if (Object.keys(_where).length > 0) {
              return items.filter((item) =>
                Object.entries(_where).every(([k, v]) => item[k as keyof typeof item] === v),
              );
            }
            return [...items];
          },
        };
      },
      findBy(conditions: Record<string, any>) {
        return (
          items.find((item) =>
            Object.entries(conditions).every(([k, v]) => item[k as keyof typeof item] === v),
          ) || null
        );
      },
      create(data: any) {
        const item = { id: "3", ...data };
        items.push(item);
        return item;
      },
      update(id: string, data: any) {
        const item = items.find((i) => i.id === id);
        if (item) Object.assign(item, data);
        return item;
      },
      delete(id: string) {
        const idx = items.findIndex((i) => i.id === id);
        if (idx >= 0) items.splice(idx, 1);
      },
      listChildIds(_relation: string, _id: string) {
        return ["10", "11"];
      },
      listParentIds(_relation: string, _id: string) {
        return ["20"];
      },
      listSiblingIds(_relation: string, _id: string) {
        return ["30"];
      },
      listCousinIds(_relation: string, _id: string) {
        return ["40"];
      },
      listAncestorIds(_relation: string, _id: string) {
        return ["50", "51"];
      },
      listDescendantIds(_relation: string, _id: string) {
        return ["60"];
      },
      listRelatedIds(_relation: string, _id: string) {
        return ["70"];
      },
      listAssociatedThroughIds(_relation: string, _through: string, _id: string) {
        return ["80"];
      },
      findAllWith(_conditions: any, _includes: any, _options?: any) {
        return [...items];
      },
      findWith(_conditions: any, _includes: any) {
        return items[0] || null;
      },
    };
  }

  describe("service pattern (recommended)", () => {
    class UsersController extends BaseResourceController {
      protected service = createDataAccessor();

      getService() {
        return this.service;
      }
    }

    function createController(overrides?: {
      path?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    }) {
      const path = overrides?.path || "http://localhost";
      const method = overrides?.method || "GET";
      const headers = overrides?.headers || {};
      const body = overrides?.body;

      const init: RequestInit = { method, headers };
      if (body) init.body = JSON.stringify(body);

      const request = new Request(path, init);
      const env = {} as Record<string, unknown>;
      return new UsersController(request, env, mockCtx());
    }

    function createControllerWithParams(params: Record<string, string>) {
      const request = new Request("http://localhost", {
        headers: { "Content-Type": "application/json" },
      });
      const env = {} as Record<string, unknown>;
      return new UsersController(request, env, mockCtx(params));
    }

    test("index returns all items", async () => {
      const controller = createController();
      const response = await controller.run("index");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(2);
      expect(body[0].name).toBe("Alice");
    });

    test("show returns a single item", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("show");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe("Alice");
    });

    test("show returns 404 for missing item", async () => {
      const controller = createControllerWithParams({ id: "999" });
      const response = await controller.run("show");
      expect(response.status).toBe(404);
    });

    test("create returns 201 with new item", async () => {
      const controller = createController({
        method: "POST",
        body: { name: "Charlie" },
      });
      const response = await controller.run("create");
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe("Charlie");
    });

    test("create returns 400 for empty body", async () => {
      const controller = createController({ method: "POST" });
      const response = await controller.run("create");
      expect(response.status).toBe(400);
    });

    test("update modifies existing item", async () => {
      const controller = createControllerWithParams({ id: "1" });
      (controller as any).request = new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alice Updated" }),
      });
      const response = await controller.run("update");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe("Alice Updated");
    });

    test("update returns 404 for missing item", async () => {
      const controller = createControllerWithParams({ id: "999" });
      (controller as any).request = new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No One" }),
      });
      const response = await controller.run("update");
      expect(response.status).toBe(404);
    });

    test("destroy deletes item and returns message", async () => {
      const controller = createControllerWithParams({ id: "2" });
      const response = await controller.run("destroy");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe("Deleted");
    });

    test("destroy returns 404 for missing item", async () => {
      const controller = createControllerWithParams({ id: "999" });
      const response = await controller.run("destroy");
      expect(response.status).toBe(404);
    });

    test("new returns empty object", async () => {
      const controller = createController();
      const response = await controller.run("new");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({});
    });

    test("edit returns item for form", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("edit");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe("Alice");
    });

    test("before hook runs on resource actions", async () => {
      const calls: string[] = [];
      class AuditedController extends UsersController {}

      AuditedController.before(async (_ctrl: any) => {
        calls.push("audit");
      });

      const request = new Request("http://localhost");
      const env = {} as Record<string, unknown>;
      const controller = new AuditedController(request, env, mockCtx());

      await controller.run("index");
      expect(calls).toEqual(["audit"]);
    });
  });

  describe("model-direct pattern", () => {
    class UsersController extends BaseResourceController {
      protected model = createDataAccessor();

      getModel() {
        return this.model;
      }
    }

    function createControllerWithParams(params: Record<string, string>) {
      const request = new Request("http://localhost", {
        headers: { "Content-Type": "application/json" },
      });
      const env = {} as Record<string, unknown>;
      return new UsersController(request, env, mockCtx(params));
    }

    test("index returns all items via model", async () => {
      const request = new Request("http://localhost");
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx());
      const response = await controller.run("index");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(2);
    });

    test("show returns a single item via model", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("show");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe("Alice");
    });

    test("create returns 201 via model", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dave" }),
      });
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx());
      const response = await controller.run("create");
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe("Dave");
    });

    test("trash works via model", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("trash");
      expect(response.status).toBe(200);
    });

    test("listChildIds works via model", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relation: "posts" }),
      });
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx({ id: "1" }));
      const response = await controller.run("listChildIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["10", "11"]);
    });
  });

  describe("content negotiation", () => {
    class UsersController extends BaseResourceController {
      protected service = createDataAccessor();

      getService() {
        return this.service;
      }
    }

    test("respondWith returns JSON by default", async () => {
      const request = new Request("http://localhost");
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx());
      const response = await controller.run("index");
      expect(response.headers.get("content-type")).toBe("application/json");
    });

    test("respondWith returns XML when Accept header requests it", async () => {
      const request = new Request("http://localhost", {
        headers: { Accept: "application/xml" },
      });
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx());
      const response = await controller.run("index");
      expect(response.headers.get("content-type")).toBe("application/xml");
    });

    test("respondWith returns CSV when Accept header requests it", async () => {
      const request = new Request("http://localhost", {
        headers: { Accept: "text/csv" },
      });
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx());
      const response = await controller.run("index");
      expect(response.headers.get("content-type")).toBe("text/csv");
    });

    test("respondWith falls back to JSON for unhandled content types like HTML", async () => {
      const request = new Request("http://localhost", {
        headers: { Accept: "text/html" },
      });
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx());
      const response = await controller.run("index");
      expect(response.headers.get("content-type")).toBe("application/json");
    });
  });

  describe("lifecycle actions", () => {
    class UsersController extends BaseResourceController {
      protected service = createDataAccessor();

      getService() {
        return this.service;
      }
    }

    function createControllerWithParams(params: Record<string, string>) {
      const request = new Request("http://localhost", {
        headers: { "Content-Type": "application/json" },
      });
      const env = {} as Record<string, unknown>;
      return new UsersController(request, env, mockCtx(params));
    }

    test("trash marks item as trashed", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("trash");
      expect(response.status).toBe(200);
    });

    test("trash returns 404 for missing item", async () => {
      const controller = createControllerWithParams({ id: "999" });
      const response = await controller.run("trash");
      expect(response.status).toBe(404);
    });

    test("restore untrashes item", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("restore");
      expect(response.status).toBe(200);
    });

    test("hide marks item as hidden", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("hide");
      expect(response.status).toBe(200);
    });

    test("hide returns 404 for missing item", async () => {
      const controller = createControllerWithParams({ id: "999" });
      const response = await controller.run("hide");
      expect(response.status).toBe(404);
    });

    test("unhide unhides item", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("unhide");
      expect(response.status).toBe(200);
    });

    test("flag marks item as flagged", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("flag");
      expect(response.status).toBe(200);
    });

    test("flag returns 404 for missing item", async () => {
      const controller = createControllerWithParams({ id: "999" });
      const response = await controller.run("flag");
      expect(response.status).toBe(404);
    });

    test("unflag unflags item", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("unflag");
      expect(response.status).toBe(200);
    });

    test("purge permanently deletes item", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("purge");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe("Purged");
    });

    test("retire marks item as retired", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("retire");
      expect(response.status).toBe(200);
    });

    test("retire returns 404 for missing item", async () => {
      const controller = createControllerWithParams({ id: "999" });
      const response = await controller.run("retire");
      expect(response.status).toBe(404);
    });

    test("unretire unretires item", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("unretire");
      expect(response.status).toBe(200);
    });
  });

  describe("relationship traversal", () => {
    class UsersController extends BaseResourceController {
      protected service = createDataAccessor();

      getService() {
        return this.service;
      }
    }

    function createControllerWithParams(params: Record<string, string>, body?: any) {
      const init: RequestInit = {
        headers: { "Content-Type": "application/json" },
      };
      if (body) {
        init.method = "POST";
        init.body = JSON.stringify(body);
      }
      const request = new Request("http://localhost", init);
      const env = {} as Record<string, unknown>;
      return new UsersController(request, env, mockCtx(params));
    }

    test("listChildIds returns child IDs", async () => {
      const controller = createControllerWithParams({ id: "1" }, { relation: "posts" });
      const response = await controller.run("listChildIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["10", "11"]);
    });

    test("listChildIds returns 400 without relation", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("listChildIds");
      expect(response.status).toBe(400);
    });

    test("listParentIds returns parent IDs", async () => {
      const controller = createControllerWithParams({ id: "1" }, { relation: "user" });
      const response = await controller.run("listParentIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["20"]);
    });

    test("listSiblingIds returns sibling IDs", async () => {
      const controller = createControllerWithParams({ id: "1" }, { relation: "posts" });
      const response = await controller.run("listSiblingIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["30"]);
    });

    test("listCousinIds returns cousin IDs", async () => {
      const controller = createControllerWithParams({ id: "1" }, { relation: "posts" });
      const response = await controller.run("listCousinIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["40"]);
    });

    test("listAncestorIds returns ancestor IDs", async () => {
      const controller = createControllerWithParams({ id: "1" }, { relation: "categories" });
      const response = await controller.run("listAncestorIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["50", "51"]);
    });

    test("listDescendantIds returns descendant IDs", async () => {
      const controller = createControllerWithParams({ id: "1" }, { relation: "categories" });
      const response = await controller.run("listDescendantIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["60"]);
    });

    test("listRelatedIds returns related IDs", async () => {
      const controller = createControllerWithParams({ id: "1" }, { relation: "tags" });
      const response = await controller.run("listRelatedIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["70"]);
    });

    test("listAssociatedThroughIds returns associated IDs", async () => {
      const controller = createControllerWithParams(
        { id: "1" },
        { relation: "permissions", through: "role" },
      );
      const response = await controller.run("listAssociatedThroughIds");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ids).toEqual(["80"]);
    });

    test("listAssociatedThroughIds returns 400 without relation and through", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("listAssociatedThroughIds");
      expect(response.status).toBe(400);
    });
  });

  describe("eager loading", () => {
    class UsersController extends BaseResourceController {
      protected service = createDataAccessor();

      getService() {
        return this.service;
      }
    }

    function createControllerWithParams(params: Record<string, string>, body?: any) {
      const init: RequestInit = {
        headers: { "Content-Type": "application/json" },
      };
      if (body) {
        init.method = "POST";
        init.body = JSON.stringify(body);
      }
      const request = new Request("http://localhost", init);
      const env = {} as Record<string, unknown>;
      return new UsersController(request, env, mockCtx(params));
    }

    test("findAllWith returns items with includes", async () => {
      const controller = createControllerWithParams(
        { id: "1" },
        { includes: { posts: { model: "Post", foreignKey: "userId" } } },
      );
      const response = await controller.run("findAllWith");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test("findAllWith returns 400 without includes", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("findAllWith");
      expect(response.status).toBe(400);
    });

    test("findWith returns single item with includes", async () => {
      const controller = createControllerWithParams(
        { id: "1" },
        { includes: { posts: { model: "Post", foreignKey: "userId" } } },
      );
      const response = await controller.run("findWith");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe("Alice");
    });

    test("findWith returns 400 without includes", async () => {
      const controller = createControllerWithParams({ id: "1" });
      const response = await controller.run("findWith");
      expect(response.status).toBe(400);
    });
  });

  describe("scoping and identification", () => {
    class UsersController extends BaseResourceController {
      protected service = createDataAccessor();

      getService() {
        return this.service;
      }
    }

    test("getIdentifier returns id from path params", () => {
      const request = new Request("http://localhost");
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx({ id: "42" }));
      expect((controller as any).getIdentifier()).toBe("42");
    });

    test("getIdentifier falls back to last param value", () => {
      const request = new Request("http://localhost");
      const env = {} as Record<string, unknown>;
      const controller = new UsersController(request, env, mockCtx({ slug: "my-post" }));
      expect((controller as any).getIdentifier()).toBe("my-post");
    });
  });
});
