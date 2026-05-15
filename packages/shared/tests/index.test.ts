import { describe, expect, test, vi } from "vite-plus/test";
import { FlattenedRequest, Context, EnvLike } from "../src/index.ts";

describe("FlattenedRequest", () => {
  test("RequestLike type is compatible with global Request", () => {
    const request: FlattenedRequest = new Request("http://localhost");
    expect(request).toBeDefined();
    expect(request.url).toBe("http://localhost/");
    expect(request.method).toBe("GET");
  });

  test("FlattenedRequest accepts optional cf property", () => {
    const mockCf = { country: "US", colo: "SFO" };
    const request = new Request("http://localhost") as FlattenedRequest<typeof mockCf>;
    expect(request).toBeDefined();
  });

  test("RequestLike can be used as type for request parameter", () => {
    function handleRequest(req: FlattenedRequest): string {
      return req.method;
    }

    const request = new Request("http://localhost", { method: "POST" });
    expect(handleRequest(request)).toBe("POST");
  });
});

describe("Context", () => {
  test("Context type requires waitUntil method", () => {
    const ctx: Context = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    };

    expect(ctx.waitUntil).toBeDefined();
    expect(ctx.passThroughOnException).toBeDefined();
  });

  test("ContextLike can be used as type for context parameter", () => {
    function handleContext(ctx: Context): void {
      ctx.waitUntil(Promise.resolve());
    }

    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    };

    handleContext(mockCtx);
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });
});

describe("EnvLike", () => {
  test("EnvLike type is a record of unknown values", () => {
    const env: EnvLike = {
      DB: {},
      KV: {},
      API_KEY: "secret",
    };

    expect(env.DB).toBeDefined();
    expect(env.KV).toBeDefined();
    expect(env.API_KEY).toBe("secret");
  });

  test("EnvLike can be used as type for env parameter", () => {
    function handleEnvLike(env: EnvLike): string[] {
      return Object.keys(env);
    }

    const env = { DATABASE_URL: "postgres://..." };
    expect(handleEnvLike(env)).toContain("DATABASE_URL");
  });
});

describe("Runtime Compatibility", () => {
  test("Cloudflare Request implements FlattenedRequest", () => {
    const cfRequest = new Request("http://localhost", {
      headers: { "Content-Type": "application/json" },
    });

    const typedRequest: FlattenedRequest = cfRequest;
    expect(typedRequest.headers.get("content-type")).toBe("application/json");
  });

  test("Node.js/Bun Request (when available) implements FlattenedRequest", () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });

    const typedRequest: FlattenedRequest = request;
    expect(typedRequest.url).toContain("/api");
    expect(typedRequest.method).toBe("POST");
  });

  test("Compatible context can be used with Standard Gauge", () => {
    const mockEnvLike = { DB: "database" };
    const mockCtx: Context = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    };

    function worker(request: FlattenedRequest, env: EnvLike, ctx: Context) {
      return new Response("OK");
    }

    const request = new Request("http://localhost");
    const response = worker(request, mockEnvLike, mockCtx);

    expect(response.status).toBe(200);
  });
});
