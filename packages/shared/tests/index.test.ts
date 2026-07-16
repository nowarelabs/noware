import { describe, expect, test, vi } from "vite-plus/test";
import {
  RequestLike,
  ContextLike,
  EnvLike,
  createContext,
  createControllerContext,
  createServiceContext,
  createModelContext,
  createViewContext,
  createRouterContext,
  runBeforeHooks,
  runAfterHooks,
  runAroundHooks,
  fromCloudflareRequest,
  fromCloudflareContext,
  fromCloudflareEnv,
  fromWebRequest,
  fromNodeIncomingMessage,
} from "../src/index.ts";

describe("RequestLike", () => {
  test("RequestLike is compatible with global Request", () => {
    const request: RequestLike = new Request("http://localhost");
    expect(request).toBeDefined();
    expect(request.url).toBe("http://localhost/");
    expect(request.method).toBe("GET");
  });

  test("RequestLike works as parameter type", () => {
    function handleRequest(req: RequestLike): string {
      return req.method;
    }

    const request = new Request("http://localhost", { method: "POST" });
    expect(handleRequest(request)).toBe("POST");
  });
});

describe("ContextLike", () => {
  test("ContextLike type requires waitUntil and passThroughOnException", () => {
    const waitUntil = vi.fn();
    const passThroughOnException = vi.fn();
    const _ctx: ContextLike = { waitUntil, passThroughOnException };

    expect(waitUntil).toBeDefined();
    expect(passThroughOnException).toBeDefined();
  });

  test("ContextLike can be used as type for context parameter", () => {
    const waitUntil = vi.fn();

    function handleContext(ctx: ContextLike): void {
      ctx.waitUntil(Promise.resolve());
    }

    const mockCtx: ContextLike = {
      waitUntil,
      passThroughOnException: vi.fn(),
    };

    handleContext(mockCtx);
    expect(waitUntil).toHaveBeenCalled();
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
  test("RequestLike carries standard Request properties", () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(request.url).toContain("/api");
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/json");
  });

  test("Compatible context can be used with worker pattern", () => {
    const mockEnvLike = { DB: "database" };
    const mockCtx: ContextLike = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    };

    function worker(_request: RequestLike, _env: EnvLike, _ctx: ContextLike) {
      return new Response("OK");
    }

    const request = new Request("http://localhost");
    const response = worker(request, mockEnvLike, mockCtx);

    expect(response.status).toBe(200);
  });
});

describe("createContext", () => {
  test("returns a ContextLike with noop waitUntil and passThroughOnException", () => {
    const ctx = createContext();
    const { waitUntil, passThroughOnException } = ctx;
    expect(waitUntil).toBeDefined();
    expect(passThroughOnException).toBeDefined();
    expect(() => ctx.waitUntil(Promise.resolve())).not.toThrow();
    expect(() => ctx.passThroughOnException()).not.toThrow();
  });
});

describe("fromCloudflareRequest", () => {
  test("converts a Cloudflare RequestLike to RequestLike", () => {
    const cfRequest = new Request("http://localhost/api", {
      method: "POST",
      headers: { "x-test": "value" },
    });
    const req = fromCloudflareRequest(cfRequest);
    expect(req.url).toContain("/api");
    expect(req.method).toBe("POST");
    expect(req.headers.get("x-test")).toBe("value");
  });
});

describe("fromCloudflareContext", () => {
  test("converts a Cloudflare ExecutionContext-like object to ContextLike", () => {
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    };
    const ctx = fromCloudflareContext(mockCtx);
    const { waitUntil, passThroughOnException } = ctx;
    expect(waitUntil).toBe(mockCtx.waitUntil);
    expect(passThroughOnException).toBe(mockCtx.passThroughOnException);
  });
});

describe("fromCloudflareEnv", () => {
  test("converts a Cloudflare env object to EnvLike", () => {
    const env = { DB: "database", KV: "namespace" };
    const result = fromCloudflareEnv(env);
    expect(result.DB).toBe("database");
    expect(result.KV).toBe("namespace");
  });
});

describe("fromWebRequest", () => {
  test("converts a standard Request to RequestLike", () => {
    const request = new Request("http://localhost/test", {
      method: "PUT",
      headers: { "content-type": "application/json" },
    });
    const req = fromWebRequest(request);
    expect(req.url).toContain("/test");
    expect(req.method).toBe("PUT");
    expect(req.headers.get("content-type")).toBe("application/json");
  });
});

describe("fromNodeIncomingMessage", () => {
  test("converts a Node IncomingMessage-like object to RequestLike", () => {
    const nodeReq = {
      method: "POST",
      url: "/api/data?q=1",
      headers: {
        host: "example.com",
        "content-type": "application/json",
        "x-custom": ["a", "b"],
      },
      socket: { encrypted: true },
    };

    const req = fromNodeIncomingMessage(nodeReq, new TextEncoder().encode('{"key":"value"}'));
    expect(req.url).toBe("https://example.com/api/data?q=1");
    expect(req.method).toBe("POST");
    expect(req.headers.get("host")).toBe("example.com");
    expect(req.headers.get("x-custom")).toBe("a, b");
  });

  test("handles missing optional fields", () => {
    const nodeReq = { headers: {} };
    const req = fromNodeIncomingMessage(nodeReq);
    expect(req.url).toBe("http://localhost/");
    expect(req.method).toBe("GET");
  });
});

describe("Layer Context Factories", () => {
  test("createControllerContext returns a ControllerContext", () => {
    const ctx = createControllerContext();
    const { waitUntil, passThroughOnException } = ctx;
    expect(waitUntil).toBeDefined();
    expect(passThroughOnException).toBeDefined();
    expect(ctx.params).toEqual({});
    expect(ctx.currentUser).toBeUndefined();
    expect(ctx.session).toEqual({});
  });

  test("createServiceContext returns a ServiceContext with transactionId", () => {
    const ctx = createServiceContext();
    const { waitUntil } = ctx;
    expect(waitUntil).toBeDefined();
    expect(typeof ctx.transactionId).toBe("string");
    expect(ctx.transactionId.length).toBeGreaterThan(0);
  });

  test("createModelContext returns a ModelContext", () => {
    const ctx = createModelContext();
    const { waitUntil } = ctx;
    expect(waitUntil).toBeDefined();
    expect(ctx.logger).toBeUndefined();
    expect(ctx.transaction).toBeUndefined();
  });

  test("createViewContext returns a ViewContext", () => {
    const ctx = createViewContext();
    const { waitUntil } = ctx;
    expect(waitUntil).toBeDefined();
    expect(ctx.currentUser).toBeUndefined();
    expect(ctx.flash).toEqual({});
  });

  test("createRouterContext returns a RouterContext", () => {
    const ctx = createRouterContext();
    const { waitUntil } = ctx;
    expect(waitUntil).toBeDefined();
    expect(ctx.params).toEqual({});
  });
});

describe("HookEngine", () => {
  test("runBeforeHooks returns null when no hooks short-circuit", async () => {
    const hooks = [{ fn: (_i: {}) => undefined }, { fn: (_i: {}) => {} }];
    const result = await runBeforeHooks({}, hooks);
    expect(result).toBeNull();
  });

  test("runBeforeHooks short-circuits on first non-null return", async () => {
    const order: number[] = [];
    const hooks = [
      {
        fn: () => {
          order.push(1);
        },
      },
      {
        fn: () => {
          order.push(2);
          return "short";
        },
      },
      {
        fn: () => {
          order.push(3);
        },
      },
    ];
    const result = await runBeforeHooks({}, hooks);
    expect(result).toBe("short");
    expect(order).toEqual([1, 2]);
  });

  test("runBeforeHooks respects shouldRun filter", async () => {
    const fn = vi.fn();
    const hooks = [
      { fn, options: { only: ["create"] } },
      { fn, options: { only: ["update"] } },
    ];
    await runBeforeHooks({}, hooks, (o) => o?.only?.includes("create") ?? true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("runAfterHooks transforms result through pipeline", async () => {
    const hooks = [{ fn: (_i: {}, r: number) => r + 1 }, { fn: (_i: {}, r: number) => r * 2 }];
    const result = await runAfterHooks({}, hooks, 5);
    expect(result).toBe(12); // (5 + 1) * 2
  });

  test("runAroundHooks nests in onion order", async () => {
    const order: string[] = [];
    const hooks = [
      {
        fn: async (_i: {}, next: () => Promise<string>) => {
          order.push("before1");
          const r = await next();
          order.push("after1");
          return r;
        },
      },
      {
        fn: async (_i: {}, next: () => Promise<string>) => {
          order.push("before2");
          const r = await next();
          order.push("after2");
          return r;
        },
      },
    ];
    const result = await runAroundHooks({}, hooks, async () => {
      order.push("action");
      return "done";
    });
    expect(result).toBe("done");
    expect(order).toEqual(["before1", "before2", "action", "after2", "after1"]);
  });
});
