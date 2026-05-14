import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";
import { BaseJob } from "../src/index.ts";

describe("BaseJob", () => {
  class TestJob extends BaseJob {
    protected async dispatch(_jobName: string, _payload: unknown) {}
  }

  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = { QUEUE: {} } as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const job = new TestJob(mockRequest, mockEnv, mockCtx);

    expect(job).toBeDefined();
    expect((job as unknown as { request: Request }).request).toBe(mockRequest);
  });

  test("static hooks exist", () => {
    expect(BaseJob.beforeHooks).toBeDefined();
    expect(BaseJob.afterHooks).toBeDefined();
  });
});
