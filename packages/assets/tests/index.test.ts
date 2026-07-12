import { describe, expect, test } from "vite-plus/test";
import type { AssetContext } from "@nowarelabs/shared";
import { BaseAsset } from "../src/index.ts";

describe("BaseAsset", () => {
  test("constructor accepts config, request, env, ctx", () => {
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as AssetContext;

    const asset = new BaseAsset(mockRequest, mockEnv, mockCtx);
    expect(asset).toBeDefined();
  });

  test("static hooks exist", () => {
    expect(BaseAsset.beforeHooks).toBeDefined();
    expect(BaseAsset.afterHooks).toBeDefined();
  });

  // Test the protected methods by creating a subclass
  test("can extend BaseAsset and access protected members", () => {
    class TestAsset extends BaseAsset<AssetContext, any, Request> {
      public getOptions() {
        return this.options;
      }

      public testResolveAssetPath(name: string) {
        return this.resolveAssetPath(name);
      }

      public testGenerateInjectionString() {
        return this["generateInjectionString"]();
      }
    }

    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as Record<string, unknown>;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as AssetContext;

    const asset = new TestAsset(mockRequest, mockEnv, mockCtx, {
      styles: ["test.css"],
      scripts: ["app.js"],
      publicPrefix: "/static/",
      vendorPrefix: "/vendors/",
      manifest: { "test.css": "test.a1b2c3.css" },
    });

    // Test options
    const options = asset.getOptions();
    expect(options.styles).toEqual(["test.css"]);
    expect(options.scripts).toEqual(["app.js"]);
    expect(options.publicPrefix).toBe("/static/");
    expect(options.vendorPrefix).toBe("/vendors/");
    expect(options.manifest).toEqual({ "test.css": "test.a1b2c3.css" });

    // Test resolveAssetPath
    expect(asset.testResolveAssetPath("test.css")).toBe("/test.a1b2c3.css");
    expect(asset.testResolveAssetPath("nonexistent.css")).toBe("/nonexistent.css");

    // Test generateInjectionString
    const injectionString = asset.testGenerateInjectionString();
    expect(injectionString).toContain('<link rel="stylesheet" href="/test.a1b2c3.css">');
    expect(injectionString).toContain('<script type="importmap">');
    expect(injectionString).toContain('<script src="/app.js" type="module"></script>');
  });
});
