import { describe, expect, test } from "vite-plus/test";
import { DrivingAdapter } from "../src/index.ts";
import type { Port } from "@nowarelabs/shared";

describe("DrivingAdapter", () => {
  interface TestInput {
    foo: string;
  }
  interface TestOutput {
    bar: string;
  }

  class MockPort implements Port<TestInput, TestOutput> {
    async execute(input: TestInput) {
      return { success: true as const, data: { bar: input.foo }, status: "delivered" as const };
    }
  }

  class TestAdapter extends DrivingAdapter<TestInput, TestOutput, MockPort> {
    protected async mapInput(req: any): Promise<TestInput> {
      return { foo: "bar" };
    }
    protected mapOutput(output: TestOutput) {
      return this.json(output);
    }
  }

  test("can be instantiated with port, request, env, ctx", () => {
    const mockPort = new MockPort();
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as any;
    const mockCtx = { waitUntil: () => {} } as any;

    const adapter = new TestAdapter(mockPort, mockRequest, mockEnv, mockCtx);

    expect(adapter).toBeDefined();
  });

  test("execute runs the full lifecycle", async () => {
    const mockPort = new MockPort();
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as any;
    const mockCtx = { waitUntil: () => {} } as any;

    const adapter = new TestAdapter(mockPort, mockRequest, mockEnv, mockCtx);
    const response = await adapter.execute();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ bar: "bar" });
  });
});
