import { describe, expect, test, vi, beforeEach } from "vite-plus/test";
import type { PluginContext } from "@nowarelabs/shared";
import { Plugin, BasePlugin } from "../src/index.ts";

describe("Plugin", () => {
  test("Plugin interface requires name and install", () => {
    const plugin: Plugin = {
      name: "test-plugin",
      install: () => {},
    };

    expect(plugin.name).toBe("test-plugin");
    const installFn = plugin.install;
    expect(installFn).toBeDefined();
  });
});

describe("BasePlugin", () => {
  test("constructor accepts request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as PluginContext;

    const plugin = new BasePlugin(mockRequest, mockEnv, mockCtx);
    expect(plugin).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BasePlugin.beforeHooks).toBeDefined();
    expect(BasePlugin.afterHooks).toBeDefined();
  });
});
