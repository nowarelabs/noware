import { describe, expect, test } from "vite-plus/test";
import type { DomainContext } from "@nowarelabs/shared";
import { Entity, ValueObject, BaseDomain } from "../src/index.ts";

describe("Entity", () => {
  test("Entity type requires id", () => {
    const entity: Entity<{ name: string }> = {
      id: "entity-1",
      name: "Test",
    };

    expect(entity.id).toBe("entity-1");
    expect(entity.name).toBe("Test");
  });
});

describe("ValueObject", () => {
  test("ValueObject is just the type", () => {
    const vo: ValueObject<{ amount: number }> = { amount: 100 };
    expect(vo.amount).toBe(100);
  });
});

describe("BaseDomain", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as DomainContext;

    const domain = new BaseDomain(mockRequest, mockEnv, mockCtx);
    expect(domain).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseDomain.beforeHooks).toBeDefined();
    expect(BaseDomain.afterHooks).toBeDefined();
  });
});
