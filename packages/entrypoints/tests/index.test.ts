import { describe, expect, test } from "vite-plus/test";
import type { EnvLike, EntrypointContext, RouterContext, WorkflowStep } from "@nowarelabs/shared";
import {
  BaseEntrypoint,
  HttpEntrypoint,
  CliEntrypoint,
  RpcEntrypoint,
  IotEntrypoint,
  CronEntrypoint,
  QueueEntrypoint,
  EmailEntrypoint,
  WebSocketEntrypoint,
  TcpEntrypoint,
  UdpEntrypoint,
  DurableObjectEntrypoint,
  GrpcEntrypoint,
  WorkflowEntrypoint,
  MessageEntrypoint,
} from "../src/index.ts";

describe("BaseEntrypoint (protocol-agnostic)", () => {
  test("constructs without args", () => {
    class CliEntrypoint extends BaseEntrypoint<string[], number> {
      protected async run(args: string[]): Promise<number> {
        return args.length;
      }
    }
    const ep = new CliEntrypoint();
    expect(ep).toBeDefined();
  });

  test("handles arbitrary input/output types", async () => {
    class CliEntrypoint extends BaseEntrypoint<string[], number> {
      protected async run(args: string[]): Promise<number> {
        return args.length;
      }
    }
    const ep = new CliEntrypoint();
    const result = await ep.handle(["a", "b", "c"], {} as EnvLike, {} as EntrypointContext);
    expect(result).toBe(3);
  });

  test("static hooks exist", () => {
    expect(BaseEntrypoint.beforeHooks).toBeDefined();
    expect(BaseEntrypoint.afterHooks).toBeDefined();
    expect(BaseEntrypoint.aroundHooks).toBeDefined();
  });

  test("static before hooks run before run()", async () => {
    const calls: string[] = [];
    class CliEntrypoint extends BaseEntrypoint<string[], number> {
      protected async run(args: string[]): Promise<number> {
        calls.push("run");
        return args.length;
      }
    }

    CliEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new CliEntrypoint();
    await ep.handle(["a"], {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before", "run"]);
  });

  test("static after hooks run after run()", async () => {
    const calls: string[] = [];
    class CliEntrypoint extends BaseEntrypoint<string[], number> {
      protected async run(args: string[]): Promise<number> {
        calls.push("run");
        return args.length;
      }
    }

    CliEntrypoint.after(async (_ep: any, result: number) => {
      calls.push("after");
      return result;
    });

    const ep = new CliEntrypoint();
    await ep.handle(["a"], {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["run", "after"]);
  });

  test("before hook can short-circuit before run()", async () => {
    class CliEntrypoint extends BaseEntrypoint<string[], number> {
      protected async run(_args: string[]): Promise<number> {
        return 42;
      }
    }

    CliEntrypoint.before(async (_ep: any) => {
      return 99;
    });

    const ep = new CliEntrypoint();
    const result = await ep.handle(["a"], {} as EnvLike, {} as EntrypointContext);
    expect(result).toBe(99);
  });

  test("around hook wraps run()", async () => {
    const calls: string[] = [];
    class CliEntrypoint extends BaseEntrypoint<string[], number> {
      protected async run(_args: string[]): Promise<number> {
        calls.push("run");
        return 42;
      }
    }

    CliEntrypoint.around(async (_ep: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const result = await next();
      calls.push("after-around");
      return result;
    });

    const ep = new CliEntrypoint();
    await ep.handle(["a"], {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before-around", "run", "after-around"]);
  });

  test("hook inheritance: parent hooks apply to child without own arrays", async () => {
    const calls: string[] = [];
    class Parent extends BaseEntrypoint<string[], number> {
      protected async run(args: string[]): Promise<number> {
        calls.push("run");
        return args.length;
      }
    }

    class Child extends Parent {}

    Parent.before(async (_ep: any) => {
      calls.push("parent-before");
    });

    const ep = new Child();
    await ep.handle(["a"], {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["parent-before", "run"]);
  });

  test("hook inheritance: child hooks don't leak to parent", async () => {
    const calls: string[] = [];
    class Parent extends BaseEntrypoint<string[], number> {
      protected async run(args: string[]): Promise<number> {
        calls.push("run");
        return args.length;
      }
    }

    class Child extends Parent {}

    Child.before(async (_ep: any) => {
      calls.push("child-before");
    });

    const parentEp = new Parent();
    const childEp = new Child();

    await parentEp.handle(["a"], {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["run"]); // parent has no hooks registered

    await childEp.handle(["b"], {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["run", "child-before", "run"]);
  });

  test("hook inheritance: parent + child hooks run in correct order", async () => {
    const calls: string[] = [];
    class Parent extends BaseEntrypoint<string[], number> {
      protected async run(args: string[]): Promise<number> {
        calls.push("run");
        return args.length;
      }
    }

    class Child extends Parent {}

    Parent.before(async (_ep: any) => {
      calls.push("parent-before");
    });

    Child.before(async (_ep: any) => {
      calls.push("child-before");
    });

    const ep = new Child();
    await ep.handle(["a"], {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["parent-before", "child-before", "run"]);
  });
});

describe("HttpEntrypoint", () => {
  class MockRouter {
    async handle(_request: Request, _env: Record<string, unknown>, _ctx: any) {
      return new Response("from router");
    }
  }

  class TestHttpEntrypoint extends HttpEntrypoint {
    router = new MockRouter() as any;
  }

  function createEntrypoint(entrypointClass = TestHttpEntrypoint) {
    const request = new Request("http://localhost");
    const env = {} as Record<string, unknown>;
    const ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
      params: {},
    } as RouterContext;
    return { entrypoint: new entrypointClass(), request, env, ctx };
  }

  test("constructs without args", () => {
    const entrypoint = new TestHttpEntrypoint();
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
    expect(HttpEntrypoint.beforeHooks).toBeDefined();
    expect(HttpEntrypoint.afterHooks).toBeDefined();
    expect(HttpEntrypoint.aroundHooks).toBeDefined();
  });

  test("static before hooks run before routing", async () => {
    const calls: string[] = [];
    class HookedEntrypoint extends TestHttpEntrypoint {}

    HookedEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const { entrypoint, request, env, ctx } = createEntrypoint(HookedEntrypoint as any);
    await entrypoint.fetch(request, env, ctx);
    expect(calls).toEqual(["before"]);
  });

  test("static after hooks run after routing", async () => {
    const calls: string[] = [];
    class HookedEntrypoint extends TestHttpEntrypoint {}

    HookedEntrypoint.after(async (_ep: any, result: Response) => {
      calls.push("after");
      return result;
    });

    const { entrypoint, request, env, ctx } = createEntrypoint(HookedEntrypoint as any);
    await entrypoint.fetch(request, env, ctx);
    expect(calls).toEqual(["after"]);
  });

  test("before hook can short-circuit before routing", async () => {
    class ProtectedEntrypoint extends TestHttpEntrypoint {}

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
    class AroundEntrypoint extends TestHttpEntrypoint {}

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

describe("CliEntrypoint", () => {
  class MockCliRouter {
    async handle(argv: string[]) {
      return argv.length;
    }
  }

  class TestCliEntrypoint extends CliEntrypoint {
    router = new MockCliRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestCliEntrypoint();
    expect(ep).toBeDefined();
  });

  test("main delegates to router", async () => {
    const ep = new TestCliEntrypoint();
    const exitCode = await ep.main(["a", "b", "c"], {} as EnvLike, {} as EntrypointContext);
    expect(exitCode).toBe(3);
  });

  test("main returns exit code from hooks pipeline", async () => {
    class HookedCliEntrypoint extends TestCliEntrypoint {}

    HookedCliEntrypoint.before(async (_ep: any) => {
      return 99;
    });

    const ep = new HookedCliEntrypoint();
    const exitCode = await ep.main(["x"], {} as EnvLike, {} as EntrypointContext);
    expect(exitCode).toBe(99);
  });
});

describe("RpcEntrypoint", () => {
  class MockRpcRouter {
    async handle(_request: Request) {
      return new Response("rpc ok", { status: 200 });
    }
  }

  class TestRpcEntrypoint extends RpcEntrypoint {
    router = new MockRpcRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestRpcEntrypoint();
    expect(ep).toBeDefined();
  });

  test("fetch delegates to router", async () => {
    const ep = new TestRpcEntrypoint();
    const request = new Request("http://localhost/rpc");
    const response = await ep.fetch(request, {} as EnvLike, { params: {} } as RouterContext);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("rpc ok");
  });

  test("handle is an alias for fetch", async () => {
    const ep = new TestRpcEntrypoint();
    const request = new Request("http://localhost/rpc");
    const response = await ep.handle(request, {} as EnvLike, { params: {} } as RouterContext);
    expect(response.status).toBe(200);
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedRpcEntrypoint extends TestRpcEntrypoint {}

    HookedRpcEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedRpcEntrypoint();
    const request = new Request("http://localhost/rpc");
    await ep.fetch(request, {} as EnvLike, { params: {} } as RouterContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("IotEntrypoint", () => {
  class MockIotRouter {
    async handle(_signal: Uint8Array) {
      // processed
    }
  }

  class TestIotEntrypoint extends IotEntrypoint {
    router = new MockIotRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestIotEntrypoint();
    expect(ep).toBeDefined();
  });

  test("handleSignal delegates to router", async () => {
    const ep = new TestIotEntrypoint();
    const signal = new Uint8Array([0x01, 0x02, 0x03]);
    await ep.handleSignal(signal, {} as EnvLike, {} as EntrypointContext);
  });

  test("handle works for arbitrary input", async () => {
    const ep = new TestIotEntrypoint();
    const signal = new Uint8Array([0x01, 0x02, 0x03]);
    await ep.handle(signal, {} as EnvLike, {} as EntrypointContext);
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedIotEntrypoint extends TestIotEntrypoint {}

    HookedIotEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedIotEntrypoint();
    await ep.handleSignal(new Uint8Array(), {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("CronEntrypoint", () => {
  class MockCronRouter {
    async handle(_cron: string) {
      // executed
    }
  }

  class TestCronEntrypoint extends CronEntrypoint {
    router = new MockCronRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestCronEntrypoint();
    expect(ep).toBeDefined();
  });

  test("handleTrigger delegates to router", async () => {
    const ep = new TestCronEntrypoint();
    await ep.handleTrigger("* * * * *", {} as EnvLike, {} as EntrypointContext);
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedCronEntrypoint extends TestCronEntrypoint {}

    HookedCronEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedCronEntrypoint();
    await ep.handleTrigger("0 */6 * * *", {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("QueueEntrypoint", () => {
  class MockQueueRouter {
    async handle(_body: unknown) {
      // processed
    }
  }

  class TestQueueEntrypoint extends QueueEntrypoint {
    router = new MockQueueRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestQueueEntrypoint();
    expect(ep).toBeDefined();
  });

  test("handleMessage delegates to router", async () => {
    const ep = new TestQueueEntrypoint();
    await ep.handleMessage({ id: 1, data: "test" }, {} as EnvLike, {} as EntrypointContext);
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedQueueEntrypoint extends TestQueueEntrypoint {}

    HookedQueueEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedQueueEntrypoint();
    await ep.handleMessage("msg", {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("EmailEntrypoint", () => {
  class MockEmailRouter {
    async handle(_msg: unknown) {
      // forwarded
    }
  }

  class TestEmailEntrypoint extends EmailEntrypoint {
    router = new MockEmailRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestEmailEntrypoint();
    expect(ep).toBeDefined();
  });

  test("handleEmail delegates to router", async () => {
    const ep = new TestEmailEntrypoint();
    await ep.handleEmail(
      { from: "a@b.com", to: "c@d.com" },
      {} as EnvLike,
      {} as EntrypointContext,
    );
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedEmailEntrypoint extends TestEmailEntrypoint {}

    HookedEmailEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedEmailEntrypoint();
    await ep.handleEmail("email", {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("WebSocketEntrypoint", () => {
  class MockWsRouter {
    async handle(_request: Request) {
      return new Response("connected", { status: 200 });
    }
  }

  class TestWebSocketEntrypoint extends WebSocketEntrypoint {
    router = new MockWsRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestWebSocketEntrypoint();
    expect(ep).toBeDefined();
  });

  test("fetch returns 426 for non-WebSocket requests", async () => {
    const ep = new TestWebSocketEntrypoint();
    const request = new Request("http://localhost", {
      headers: { Upgrade: "h2c" },
    });
    const response = await ep.fetch(request, {} as EnvLike, { params: {} } as RouterContext);
    expect(response.status).toBe(426);
  });

  test("fetch delegates to router for WebSocket upgrade", async () => {
    const ep = new TestWebSocketEntrypoint();
    const request = new Request("http://localhost", {
      headers: { Upgrade: "websocket" },
    });
    const response = await ep.fetch(request, {} as EnvLike, { params: {} } as RouterContext);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("connected");
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedWsEntrypoint extends TestWebSocketEntrypoint {}

    HookedWsEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedWsEntrypoint();
    const request = new Request("http://localhost", {
      headers: { Upgrade: "websocket" },
    });
    await ep.fetch(request, {} as EnvLike, { params: {} } as RouterContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("TcpEntrypoint", () => {
  class MockTcpRouter {
    async handle(_data: Uint8Array) {
      // processed
    }
  }

  class TestTcpEntrypoint extends TcpEntrypoint {
    router = new MockTcpRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestTcpEntrypoint();
    expect(ep).toBeDefined();
  });

  test("onData delegates to router", async () => {
    const ep = new TestTcpEntrypoint();
    await ep.onData(new Uint8Array([0x01]), {} as EnvLike, {} as EntrypointContext);
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedTcpEntrypoint extends TestTcpEntrypoint {}

    HookedTcpEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedTcpEntrypoint();
    await ep.onData(new Uint8Array(), {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("UdpEntrypoint", () => {
  class MockUdpRouter {
    async handle(_data: Uint8Array) {
      // processed
    }
  }

  class TestUdpEntrypoint extends UdpEntrypoint {
    router = new MockUdpRouter() as any;
  }

  test("constructs without args", () => {
    const ep = new TestUdpEntrypoint();
    expect(ep).toBeDefined();
  });

  test("onDatagram delegates to router", async () => {
    const ep = new TestUdpEntrypoint();
    await ep.onDatagram(new Uint8Array([0x01]), {} as EnvLike, {} as EntrypointContext);
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedUdpEntrypoint extends TestUdpEntrypoint {}

    HookedUdpEntrypoint.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedUdpEntrypoint();
    await ep.onDatagram(new Uint8Array(), {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("DurableObjectEntrypoint", () => {
  class TestDurableObjectEntrypoint extends DurableObjectEntrypoint {
    handler = {
      fetch: async (_request: Request, _env: EnvLike, _ctx: EntrypointContext) =>
        new Response("do ok"),
      alarm: async (_env: EnvLike, _ctx: EntrypointContext) => {},
    };
  }

  test("constructs without args", () => {
    const ep = new TestDurableObjectEntrypoint();
    expect(ep).toBeDefined();
  });

  test("fetch delegates to handler", async () => {
    const ep = new TestDurableObjectEntrypoint();
    const response = await ep.fetch(
      new Request("http://localhost"),
      {} as EnvLike,
      {} as EntrypointContext,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("do ok");
  });

  test("alarm delegates to handler", async () => {
    const ep = new TestDurableObjectEntrypoint();
    await ep.alarm({} as EnvLike, {} as EntrypointContext);
  });

  test("static hooks exist", () => {
    expect(DurableObjectEntrypoint.beforeHooks).toBeDefined();
    expect(DurableObjectEntrypoint.afterHooks).toBeDefined();
    expect(DurableObjectEntrypoint.aroundHooks).toBeDefined();
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedDO extends TestDurableObjectEntrypoint {}

    HookedDO.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedDO();
    await ep.fetch(new Request("http://localhost"), {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("GrpcEntrypoint", () => {
  class TestGrpcEntrypoint extends GrpcEntrypoint {
    handler = {
      unary: async (_request: Uint8Array, _env: EnvLike, _ctx: EntrypointContext) =>
        new Uint8Array([0x01]),
      serverStream: async function* (
        _request: Uint8Array,
        _env: EnvLike,
        _ctx: EntrypointContext,
      ): AsyncGenerator<Uint8Array> {
        yield new Uint8Array([0x01]);
      },
      clientStream: async (
        _requests: AsyncIterable<Uint8Array>,
        _env: EnvLike,
        _ctx: EntrypointContext,
      ): Promise<Uint8Array> => {
        return new Uint8Array([0x01]);
      },
      bidiStream: async function* (
        _requests: AsyncIterable<Uint8Array>,
        _env: EnvLike,
        _ctx: EntrypointContext,
      ): AsyncGenerator<Uint8Array> {
        yield new Uint8Array([0x01]);
      },
    };
  }

  test("constructs without args", () => {
    const ep = new TestGrpcEntrypoint();
    expect(ep).toBeDefined();
  });

  test("unary delegates to handler", async () => {
    const ep = new TestGrpcEntrypoint();
    const result = await ep.unary(new Uint8Array([0x00]), {} as EnvLike, {} as EntrypointContext);
    expect(result).toEqual(new Uint8Array([0x01]));
  });

  test("serverStream delegates to handler", async () => {
    const ep = new TestGrpcEntrypoint();
    const result = await ep.serverStream(
      new Uint8Array([0x00]),
      {} as EnvLike,
      {} as EntrypointContext,
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of result) chunks.push(chunk);
    expect(chunks).toEqual([new Uint8Array([0x01])]);
  });

  test("static hooks exist", () => {
    expect(GrpcEntrypoint.beforeHooks).toBeDefined();
    expect(GrpcEntrypoint.afterHooks).toBeDefined();
    expect(GrpcEntrypoint.aroundHooks).toBeDefined();
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedGrpc extends TestGrpcEntrypoint {}

    HookedGrpc.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedGrpc();
    await ep.unary(new Uint8Array([0x00]), {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });
});

describe("WorkflowEntrypoint", () => {
  const mockStep: WorkflowStep = {
    do: async <T>(
      _name: string,
      fn: (ctx: { state: { finished: boolean } }) => Promise<T>,
    ): Promise<T> => fn({ state: { finished: false } }),
    sleep: async (_name: string, _duration: string) => {},
    sleepUntil: async (_name: string, _timestamp: Date | number) => {},
  };

  class TestWorkflowEntrypoint extends WorkflowEntrypoint {
    handler = {
      run: async (_payload: unknown, _step: WorkflowStep, _env: EnvLike, _ctx: EntrypointContext) =>
        "done",
    };
  }

  test("constructs without args", () => {
    const ep = new TestWorkflowEntrypoint();
    expect(ep).toBeDefined();
  });

  test("run delegates to handler", async () => {
    const ep = new TestWorkflowEntrypoint();
    const result = await ep.execute({ id: 1 }, mockStep, {} as EnvLike, {} as EntrypointContext);
    expect(result).toBe("done");
  });

  test("static hooks exist", () => {
    expect(WorkflowEntrypoint.beforeHooks).toBeDefined();
    expect(WorkflowEntrypoint.afterHooks).toBeDefined();
    expect(WorkflowEntrypoint.aroundHooks).toBeDefined();
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedWorkflow extends TestWorkflowEntrypoint {}

    HookedWorkflow.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedWorkflow();
    await ep.execute("payload", mockStep, {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual(["before"]);
  });

  test("before hook can short-circuit", async () => {
    class ShortCircuit extends TestWorkflowEntrypoint {}

    ShortCircuit.before(async (_ep: any) => {
      return "short-circuit";
    });

    const ep = new ShortCircuit();
    const result = await ep.execute("payload", mockStep, {} as EnvLike, {} as EntrypointContext);
    expect(result).toBe("short-circuit");
  });

  test("around hook wraps handler.run", async () => {
    const calls: string[] = [];
    class AroundWorkflow extends TestWorkflowEntrypoint {}

    AroundWorkflow.around(async (_ep: any, next: () => Promise<any>) => {
      calls.push("before-around");
      const r = await next();
      calls.push("after-around");
      return r;
    });

    const ep = new AroundWorkflow();
    const result = await ep.execute("payload", mockStep, {} as EnvLike, {} as EntrypointContext);
    expect(result).toBe("done");
    expect(calls).toEqual(["before-around", "after-around"]);
  });
});

describe("MessageEntrypoint", () => {
  interface KafkaMeta {
    topic: string;
    partition: number;
    offset: string;
  }

  class TestMessageEntrypoint extends MessageEntrypoint<Uint8Array, KafkaMeta> {
    handler = {
      handle: async (
        _body: Uint8Array,
        _metadata: KafkaMeta,
        _env: EnvLike,
        _ctx: EntrypointContext,
      ) => {},
    };
  }

  test("constructs without args", () => {
    const ep = new TestMessageEntrypoint();
    expect(ep).toBeDefined();
  });

  test("handleMessage delegates to handler with body and metadata", async () => {
    const calls: { body: unknown; metadata: unknown }[] = [];

    class TrackingEntrypoint extends MessageEntrypoint<Uint8Array, KafkaMeta> {
      handler = {
        handle: async (
          body: Uint8Array,
          metadata: KafkaMeta,
          _env: EnvLike,
          _ctx: EntrypointContext,
        ) => {
          calls.push({ body, metadata });
        },
      };
    }

    const ep = new TrackingEntrypoint();
    const body = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
    const metadata: KafkaMeta = { topic: "orders", partition: 0, offset: "42" };

    await ep.handleMessage(body, metadata, {} as EnvLike, {} as EntrypointContext);
    expect(calls).toEqual([{ body, metadata }]);
  });

  test("static hooks exist", () => {
    expect(MessageEntrypoint.beforeHooks).toBeDefined();
    expect(MessageEntrypoint.afterHooks).toBeDefined();
    expect(MessageEntrypoint.aroundHooks).toBeDefined();
  });

  test("hooks run through the pipeline", async () => {
    const calls: string[] = [];
    class HookedMsg extends TestMessageEntrypoint {}

    HookedMsg.before(async (_ep: any) => {
      calls.push("before");
    });

    const ep = new HookedMsg();
    await ep.handleMessage(
      new Uint8Array([0x78]),
      { topic: "t", partition: 0, offset: "0" },
      {} as EnvLike,
      {} as EntrypointContext,
    );
    expect(calls).toEqual(["before"]);
  });

  test("before hook can short-circuit", async () => {
    class ProtectiveEntry extends TestMessageEntrypoint {}

    ProtectiveEntry.before(async (_ep: any) => {
      // short-circuit — skips handler.handle
    });

    const ep = new ProtectiveEntry();
    await ep.handleMessage(
      new Uint8Array([0x78]),
      { topic: "t", partition: 0, offset: "0" },
      {} as EnvLike,
      {} as EntrypointContext,
    );
  });
});
