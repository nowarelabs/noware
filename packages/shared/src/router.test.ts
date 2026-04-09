import { describe, it, expect, vi } from "vitest";
import { Router } from "./router";
import type { ExecutionContext } from "@cloudflare/workers-types";

// Mock ExecutionContext for Cloudflare Workers
const mockCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe("Router", () => {
  it("should match simple routes", async () => {
    const router = new Router();
    router.get("/hello", async (req: any, env: any, ctx: any) => ctx.text("world"));

    const req = new Request("http://localhost/hello");
    const res = await router.handle(req, {}, mockCtx);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("world");
  });

  it("should extract parameters", async () => {
    const router = new Router();
    router.get("/user/:id", async (req: any, env: any, ctx: any) =>
      ctx.json({ id: ctx.params.id }),
    );

    const req = new Request("http://localhost/user/123");
    const res = await router.handle(req, {}, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.id).toBe("123");
  });

  it("should handle query parameters", async () => {
    const router = new Router();
    router.get("/search", async (req: any, env: any, ctx: any) => ctx.json(ctx.query));

    const req = new Request("http://localhost/search?q=test&page=1");
    const res = await router.handle(req, {}, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.q).toBe("test");
    expect(data.page).toBe("1");
  });

  it("should execute middleware in onion model", async () => {
    const router = new Router();
    const logs: string[] = [];

    router.use(async (req, env, ctx, next) => {
      logs.push("mid1-start");
      const res = await next();
      logs.push("mid1-end");
      return res;
    });

    router.get("/test", async (req: any, env: any, ctx: any) => {
      logs.push("handler");
      return ctx.text("ok");
    });

    const req = new Request("http://localhost/test");
    await router.handle(req, {}, mockCtx);

    expect(logs).toEqual(["mid1-start", "handler", "mid1-end"]);
  });

  it("should handle 404", async () => {
    const router = new Router();
    const req = new Request("http://localhost/not-found");
    const res = await router.handle(req, {}, mockCtx);

    expect(res.status).toBe(404);
  });

  it("should handle errors with onError", async () => {
    const router = new Router();
    router.get("/error", async () => {
      throw new Error("Boom");
    });

    router.onError((err, req, env, ctx) => {
      return ctx.text("Caught: " + (err as Error).message, { status: 500 });
    });

    const req = new Request("http://localhost/error");
    const res = await router.handle(req, {}, mockCtx);

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Caught: Boom");
  });

  it("should reject malformed paths", async () => {
    const router = new Router();
    const req = new Request("http://localhost/bad-path-<script>");
    const res = await router.handle(req, {}, mockCtx);

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Malformed Path");
  });

  it("should throw on invalid route definition", () => {
    const router = new Router();
    expect(() => {
      router.get("/path-with-`", async () => new Response("ok"));
    }).toThrow("Invalid route path");
  });

  describe("Security Stress Tests", () => {
    it("should handle double slashes as empty segments (matching Hono behavior)", async () => {
      const router = new Router();
      router.get("/foo//bar", async () => new Response("double slash"));
      router.get("/foo/bar", async () => new Response("single slash"));

      const req1 = new Request("http://localhost/foo//bar");
      const res1 = await router.handle(req1, {}, mockCtx);
      expect(await res1.text()).toBe("double slash");

      const req2 = new Request("http://localhost/foo/bar");
      const res2 = await router.handle(req2, {}, mockCtx);
      expect(await res2.text()).toBe("single slash");
    });

    it("should handle runtime path normalization (.. segments)", async () => {
      const router = new Router();
      // Note: Cloudflare's URL object/Request normalizes /a/../b to /b automatically
      router.get("/b", async () => new Response("normalized"));

      const req = new Request("http://localhost/a/../b");
      const res = await router.handle(req, {}, mockCtx);
      expect(await res.text()).toBe("normalized");
    });

    it("should handle encoded characters correctly and safely", async () => {
      const router = new Router();
      router.get("/hello/:name", async (req: any, env: any, ctx: any) => ctx.text(ctx.params.name));

      // %20 is space
      const req = new Request("http://localhost/hello/John%20Doe");
      const res = await router.handle(req, {}, mockCtx);
      expect(await res.text()).toBe("John Doe");
    });

    it("should reject paths with null bytes after decoding", async () => {
      const router = new Router();
      router.get("/safe", async () => new Response("ok"));

      const req = new Request("http://localhost/safe%00malicious");
      const res = await router.handle(req, {}, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("Malformed Path");
    });

    it("should handle unicode normalization (NFC)", async () => {
      const router = new Router();
      // e + combining acute accent (UTF-8: 65 CC 81)
      const nfd = "/test/\u0065\u0301";
      // e with acute accent (UTF-8: C3 A9)
      const nfc = "/test/\u00e9";

      router.get(nfc, async () => new Response("unicode ok"));

      const req = new Request(`http://localhost${nfd}`);
      const res = await router.handle(req, {}, mockCtx);
      expect(await res.text()).toBe("unicode ok");
    });

    it("should handle recursive wildcards (*)", async () => {
      const router = new Router();
      router.get("/static/*", async (req: any, env: any, ctx: any) => ctx.text(ctx.params["*"]));

      const req = new Request("http://localhost/static/css/main.css");
      const res = await router.handle(req, {}, mockCtx);
      expect(await res.text()).toBe("css/main.css");
    });

    it("should handle strict trailing slash mode", async () => {
      const router = new Router({ strict: true });
      router.get("/foo", async () => new Response("no-slash"));
      router.get("/foo/", async () => new Response("slash"));

      const res1 = await router.handle(new Request("http://localhost/foo"), {}, mockCtx);
      expect(await res1.text()).toBe("no-slash");

      const res2 = await router.handle(new Request("http://localhost/foo/"), {}, mockCtx);
      expect(await res2.text()).toBe("slash");
    });

    it("should support Basic Auth middleware", async () => {
      const { basicAuth } = await import("./middlewares/basicAuth");
      const router = new Router();
      router.use(basicAuth({ username: "admin", password: "password" }));
      router.get("/secret", async () => new Response("data"));

      const req1 = new Request("http://localhost/secret");
      const res1 = await router.handle(req1, {}, mockCtx);
      expect(res1.status).toBe(401);

      const auth = btoa("admin:password");
      const req2 = new Request("http://localhost/secret", {
        headers: { Authorization: `Basic ${auth}` },
      });
      const res2 = await router.handle(req2, {}, mockCtx);
      expect(res2.status).toBe(200);
      expect(await res2.text()).toBe("data");
    });

    it("should support ctx.cache() helper", async () => {
      const router = new Router();
      router.get("/cached", async (req: any, env: any, ctx: any) => {
        ctx.cache(60);
        return ctx.text("ok");
      });

      const req = new Request("http://localhost/cached");
      const res = await router.handle(req, {}, mockCtx);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    });

    it("should use elite hardening (Object.create(null)) for params", async () => {
      const router = new Router();
      router.get("/:id", async (req: any, env: any, ctx: any) => {
        return ctx.json({
          id: ctx.params.id,
          hasProto: "toString" in ctx.params,
        });
      });

      const req = new Request("http://localhost/123");
      const res = await router.handle(req, {}, mockCtx);
      const data = (await res.json()) as any;
      expect(data.id).toBe("123");
      expect(data.hasProto).toBe(false); // Elite hardening check
    });

    it("should enforce path depth limits to prevent DoS", async () => {
      const router = new Router();
      const longPath = "/" + "a/".repeat(33);

      // Registration check
      expect(() => {
        router.get(longPath, async () => new Response("ok"));
      }).toThrow("Path depth exceeded limit");

      // Handle check
      const req = new Request(`http://localhost${longPath}`);
      const res = await router.handle(req, {}, mockCtx);
      expect(res.status).toBe(414);
      expect(await res.text()).toBe("Path depth exceeded limit (32).");
    });
  });
});
