import { describe, expect, test } from "vite-plus/test";
import type { ContextLike } from "@nowarelabs/shared";

import { BaseView, BaseLayout, renderView } from "../src/index.ts";

describe("BaseView", () => {
  class TestView extends BaseView<any, any, any, any> {
    protected component = {} as any;
    protected getComponent() {
      return this.component;
    }
    public render(): string {
      return "";
    }
  }

  test("constructor accepts request, env, ctx", () => {
    const mockProps = {};
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as any;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const view = new TestView(mockProps, mockRequest, mockEnv, mockCtx);
    expect(view).toBeDefined();
  });

  test("getComponent returns the component", () => {
    const mockProps = {};
    const mockRequest = new Request("http://localhost");
    const mockEnv = {} as any;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ContextLike;

    const view = new TestView(mockProps, mockRequest, mockEnv, mockCtx);
    expect((view as unknown as { getComponent: () => object }).getComponent()).toEqual({});
  });

  test("static hooks exist", () => {
    expect(BaseView.beforeHooks).toBeDefined();
    expect(BaseView.afterHooks).toBeDefined();
  });
});

const mockContext = {} as ContextLike;

class SimpleView extends BaseView<{ message: string }> {
  protected component = {} as any;
  protected getComponent() {
    return this.component;
  }
  render() {
    return `<p>${this.props.message}</p>`;
  }
}

class SimpleLayout extends BaseLayout {
  render() {
    // Use content_for within view
    return `<html><head>${this.stylesheet_link_tag("style.css")}</head><body>${this.content}</body></html>`;
  }
}

describe("BaseLayout withLayout integration", () => {
  test("renders view within layout and generates stylesheet link", () => {
    const html = BaseLayout.withLayout(
      SimpleLayout,
      SimpleView,
      { message: "Hello" },
      undefined,
      undefined,
      mockContext,
    );
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain('<link rel="stylesheet" href="style.css" />');
  });
});

describe("renderView utility", () => {
  test("renders a view without layout", () => {
    const output = renderView(SimpleView, { message: "World" }, undefined, undefined, mockContext);
    expect(output).toBe("<p>World</p>");
  });
});
