/**
 * @nowarelabs/views - Zero-dependency JSX-to-String Engine
 *
 * Direct JSX rendering to HTML strings for Cloudflare Workers (Edge)
 * - Zero VNodes: JSX renders directly to strings
 * - No DOM diffing or patching
 * - Native performance with zero runtime boilerplate
 * - Full TypeScript/TSX support
 */

import type { EnvLike, ContextLike, RequestLike } from "@nowarelabs/shared";

/**
 * JSX Runtime Types
 */
export namespace JSX {
  export interface IntrinsicElements {
    [elemName: string]: any;
  }

  export interface Element extends String {}

  export interface ElementChildrenAttribute {
    children: {};
  }
}

/**
 * Content registry for content_for/yield_content pattern
 */
const contentRegistry = new Map<string, string>();

/**
 * JSX Factory - Converts JSX to HTML strings
 */
export function h(
  tag: string | Function,
  props: Record<string, any> | null,
  ...children: any[]
): string {
  // Handle function components
  if (typeof tag === "function") {
    const componentProps = { ...props, children: children.length === 1 ? children[0] : children };
    return tag(componentProps);
  }

  // Build HTML string for intrinsic elements
  const attrs = props ? buildAttributes(props) : "";
  const childrenStr = flattenChildren(children).join("");

  // Self-closing tags
  const voidElements = [
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
  ];

  if (voidElements.includes(tag)) {
    return `<${tag}${attrs} />`;
  }

  return `<${tag}${attrs}>${childrenStr}</${tag}>`;
}

/**
 * JSX Fragment support
 */
export function Fragment({ children }: { children?: any }): string {
  return flattenChildren(Array.isArray(children) ? children : [children]).join("");
}

/**
 * Build HTML attributes from props object
 */
function buildAttributes(props: Record<string, any>): string {
  const attrs: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || value == null || value === false) {
      continue;
    }

    // Handle className -> class
    const attrName = key === "className" ? "class" : key;

    // Handle boolean attributes
    if (value === true) {
      attrs.push(attrName);
      continue;
    }

    // Handle style objects
    if (attrName === "style" && typeof value === "object") {
      const styleStr = Object.entries(value)
        .map(([k, v]) => `${kebabCase(k)}: ${v}`)
        .join("; ");
      attrs.push(`style="${escapeHtml(styleStr)}"`);
      continue;
    }

    // Handle event handlers (data attributes for hydration)
    if (attrName.startsWith("on")) {
      const eventName = attrName.slice(2).toLowerCase();
      attrs.push(`data-on-${eventName}="true"`);
      continue;
    }

    // Regular attributes
    attrs.push(`${attrName}="${escapeHtml(String(value))}"`);
  }

  return attrs.length > 0 ? " " + attrs.join(" ") : "";
}

/**
 * Flatten and normalize children
 */
function flattenChildren(children: any[]): string[] {
  const result: string[] = [];

  for (const child of children) {
    if (child == null || child === false || child === true) {
      continue;
    }

    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
      continue;
    }

    result.push(String(child));
  }

  return result;
}

/**
 * Convert camelCase to kebab-case
 */
function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Asset Pipeline Helpers
 */

/**
 * Generate stylesheet link tag
 */
export function stylesheet_link_tag(href: string, options: Record<string, any> = {}): string {
  const attrs = buildAttributes({ rel: "stylesheet", href, ...options });
  return `<link${attrs} />`;
}

/**
 * Generate script tag
 */
export function javascript_include_tag(src: string, options: Record<string, any> = {}): string {
  const attrs = buildAttributes({ src, ...options });
  return `<script${attrs}></script>`;
}

/**
 * Generate image tag
 */
export function image_tag(src: string, options: Record<string, any> = {}): string {
  const attrs = buildAttributes({ src, ...options });
  return `<img${attrs} />`;
}

/**
 * BaseView - Foundation for all view components
 */
export abstract class BaseView<
  Props = {},
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected props: Props;

  constructor(
    props: Props,
    protected request?: Request,
    protected env?: Env,
    protected ctx?: Ctx
  ) {
    this.props = props;
  }

  /**
   * Main render method - must be implemented by subclasses
   */
  abstract render(): string;

  /**
   * Store content for later retrieval in layouts
   */
  protected content_for(name: string, content: string): string {
    const existing = contentRegistry.get(name) || "";
    contentRegistry.set(name, existing + content);
    return ""; // Returns empty string so it doesn't render inline
  }

  /**
   * Render the view to HTML string
   */
  toString(): string {
    return this.render();
  }

  /**
   * Static factory method for creating view instances
   */
  static create<T extends BaseView<any>>(
    this: new (...args: any[]) => T,
    props: any,
    request?: RequestLike,
    env?: EnvLike,
    ctx?: ContextLike
  ): T {
    return new this(props, request, env, ctx);
  }
}

/**
 * BaseLayout - Foundation for layout components
 */
export abstract class BaseLayout<
  Ctx extends ContextLike = ContextLike,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected content: string;

  constructor(
    content: string,
    protected request?: Request,
    protected env?: Env,
    protected ctx?: Ctx
  ) {
    this.content = content;
  }

  /**
   * Main render method - must be implemented by subclasses
   */
  abstract render(): string;

  /**
   * Retrieve content stored via content_for
   */
  protected yield_content(name: string): string {
    return contentRegistry.get(name) || "";
  }

  /**
   * Asset pipeline helper - stylesheet link tag
   */
  protected stylesheet_link_tag(href: string, options: Record<string, any> = {}): string {
    return stylesheet_link_tag(href, options);
  }

  /**
   * Asset pipeline helper - javascript include tag
   */
  protected javascript_include_tag(src: string, options: Record<string, any> = {}): string {
    return javascript_include_tag(src, options);
  }

  /**
   * Asset pipeline helper - image tag
   */
  protected image_tag(src: string, options: Record<string, any> = {}): string {
    return image_tag(src, options);
  }

  /**
   * Render the layout to HTML string
   */
  toString(): string {
    return this.render();
  }

  /**
   * Render a view within a layout
   */
  static withLayout<
    L extends BaseLayout,
    V extends BaseView<any>,
    P = V extends BaseView<infer Props> ? Props : {}
  >(
    LayoutClass: new (content: string, request?: RequestLike, env?: EnvLike, ctx?: ContextLike) => L,
    ViewClass: new (props: P, request?: RequestLike, env?: EnvLike, ctx?: ContextLike) => V,
    props: P,
    request?: RequestLike,
    env?: EnvLike,
    ctx?: ContextLike
  ): string {
    // Clear content registry for fresh render
    contentRegistry.clear();

    // Render the view
    const view = new ViewClass(props, request, env, ctx);
    const viewContent = view.toString();

    // Render the layout with the view content
    const layout = new LayoutClass(viewContent, request, env, ctx);
    return layout.toString();
  }

  /**
   * Static factory method for creating layout instances
   */
  static create<T extends BaseLayout>(
    this: new (...args: any[]) => T,
    content: string,
    request?: RequestLike,
    env?: EnvLike,
    ctx?: ContextLike
  ): T {
    return new this(content, request, env, ctx);
  }
}

/**
 * Render a view without a layout
 */
export function renderView<V extends BaseView<any>, P = V extends BaseView<infer Props> ? Props : {}>(
  ViewClass: new (props: P, request?: RequestLike, env?: EnvLike, ctx?: ContextLike) => V,
  props: P,
  request?: RequestLike,
  env?: EnvLike,
  ctx?: ContextLike
): string {
  contentRegistry.clear();
  const view = new ViewClass(props, request, env, ctx);
  return view.toString();
}

/**
 * Export for JSX pragma configuration
 * Add to tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "jsx": "react",
 *     "jsxFactory": "h",
 *     "jsxFragmentFactory": "Fragment"
 *   }
 * }
 */
export { h as createElement, Fragment as createFragment };
