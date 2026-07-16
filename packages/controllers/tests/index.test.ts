import { describe, expect, test } from "vite-plus/test";
import { BaseController } from "../src/index.ts";

describe("BaseController", () => {
  class TestController extends BaseController {
    protected service = {};

    getService() {
      return this.service;
    }

    async index(): Promise<Response> {
      return this.json({ ok: true });
    }

    async show(id: string): Promise<Response> {
      return this.text(`item ${id}`);
    }

    async redirectMe(): Promise<Response> {
      return this.redirect("/login");
    }

    async showHtml(): Promise<Response> {
      return this.html("<h1>Hello</h1>");
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

    async serverErrorAction(): Promise<Response> {
      return this.serverError("boom");
    }
  }

  class AuthController extends TestController {
    protected override async beforeAction(): Promise<Response | void> {
      if (!(this.request as any).headers?.get?.("Authorization")) {
        return this.unauthorized();
      }
    }
  }

  function createController(controllerClass = TestController) {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer token" },
    });
    const env = {} as Record<string, unknown>;
    const ctx = {} as any;
    return new controllerClass(request, env, ctx);
  }

  test("constructor accepts request, env, ctx", () => {
    const controller = createController();
    expect(controller).toBeDefined();
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

  test("run with args passes them to the action", async () => {
    const controller = createController();
    const response = await controller.run("show", "42");
    const body = await response.text();
    expect(body).toBe("item 42");
  });

  test("run returns 404 for unknown action", async () => {
    const controller = createController();
    const response = await controller.run("nonexistent");
    expect(response.status).toBe(404);
  });

  test("json helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("index");
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  test("text helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("show", "1");
    expect(response.headers.get("content-type")).toBe("text/plain");
  });

  test("html helper sets content-type", async () => {
    const controller = createController();
    const response = await controller.run("showHtml");
    expect(response.headers.get("content-type")).toBe("text/html");
  });

  test("redirect helper returns 302", async () => {
    const controller = createController();
    const response = await controller.run("redirectMe");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  test("notFound helper returns 404", async () => {
    const controller = createController();
    const response = await controller.run("notFoundAction");
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe("Not Found");
  });

  test("badRequest helper returns 400", async () => {
    const controller = createController();
    const response = await controller.run("badRequestAction");
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe("invalid");
  });

  test("unauthorized helper returns 401", async () => {
    const controller = createController();
    const response = await controller.run("unauthorizedAction");
    expect(response.status).toBe(401);
  });

  test("serverError helper returns 500", async () => {
    const controller = createController();
    const response = await controller.run("serverErrorAction");
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toBe("boom");
  });

  test("beforeAction convention intercepts requests", async () => {
    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = {} as any;
    const controller = new AuthController(request, env, ctx);

    const response = await controller.run("index");
    expect(response.status).toBe(401);
  });

  test("beforeAction convention passes through when condition met", async () => {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer token" },
    });
    const env = {} as Record<string, unknown>;
    const ctx = {} as any;
    const controller = new AuthController(request, env, ctx);

    const response = await controller.run("index");
    expect(response.status).toBe(200);
  });

  test("static before hooks run before the action", async () => {
    const calls: string[] = [];
    class HookedController extends TestController {
      static override beforeHooks: any[] = [];
    }

    HookedController.before(async (_ctrl: any) => {
      calls.push("before");
    });

    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = {} as any;
    const controller = new HookedController(request, env, ctx);

    await controller.run("index");
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after the action", async () => {
    const calls: string[] = [];
    class HookedController extends TestController {
      static override afterHooks: any[] = [];
    }

    HookedController.after(async (ctrl: any, result: any) => {
      calls.push("after");
      return result;
    });

    const controller = createController(HookedController as any);
    await controller.run("index");
    expect(calls).toEqual(["after"]);
  });

  test("before hook can short-circuit with a response", async () => {
    class ProtectedController extends TestController {
      static override beforeHooks: any[] = [];
    }

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
    class TransformController extends TestController {
      static override afterHooks: any[] = [];
    }

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
    class AroundController extends TestController {
      static override aroundHooks: any[] = [];
    }

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
      static override beforeHooks: any[] = [];
      static override afterHooks: any[] = [];

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

    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = {} as any;
    const ctrl = new Child(request, env, ctx);

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

    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = {} as any;
    const parentCtrl = new Parent(request, env, ctx);
    const childCtrl = new Child(request, env, ctx);

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

    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = {} as any;
    const ctrl = new Child(request, env, ctx);

    await ctrl.run("index");
    expect(calls).toEqual(["parent-before", "child-before"]);
  });
});
