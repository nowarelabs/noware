import { describe, expect, test } from "vite-plus/test";
import type { RpcContext } from "@nowarelabs/shared";
import { BaseRpc, BaseRpcServer } from "../src/index.ts";

describe("BaseRpcServer", () => {
  class TestRpcServer extends BaseRpcServer {
    protected feature: unknown;
    protected getFeature() {
      return this.feature;
    }
    async handle(_request: globalThis.Request) {
      return new Response("OK");
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { DB: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as RpcContext;

    const server = new TestRpcServer(mockRequest, mockEnv, mockCtx);

    expect(server).toBeDefined();
    expect((server as unknown as { request: Request }).request).toBe(mockRequest);
  });

  test("logger is available after construction", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as RpcContext;

    const server = new TestRpcServer(mockRequest, mockEnv, mockCtx);
    expect((server as any).logger).toBeDefined();
  });

  test("handle can be overridden", async () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as RpcContext;

    const server = new TestRpcServer(mockRequest, mockEnv, mockCtx);

    const response = await server.handle(mockRequest);
    expect(response.status).toBe(200);
  });

  test("static handlers map exists", () => {
    expect(BaseRpcServer.handlers).toBeDefined();
  });
});

describe("BaseRpc", () => {
  class TestRpc extends BaseRpc {
    protected feature = {} as any;

    protected getFeature() {
      return this.feature;
    }
  }

  test("static hooks exist", () => {
    expect(BaseRpc.beforeHooks).toBeDefined();
    expect(BaseRpc.afterHooks).toBeDefined();
  });

  test("logger is available after construction", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as RpcContext;

    const rpc = new TestRpc(mockRequest, mockEnv, mockCtx);
    expect((rpc as any).logger).toBeDefined();
  });
});
