/**
 * nomo/worker
 *
 * JSX-based HTML rendering for Cloudflare Workers.
 *
 * Fixes:
 * - Per-request ContentRegistry (no cross-request data leaks)
 * - content_for / yield_content with script deduplication
 * - custom_element_tag with type-safe attribute coercion
 * - Asset path resolution via AssetPipeline
 * - CSP nonce threading
 * - Full TypeScript types throughout
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import type { AssetPipeline } from 'nomo/runtime';

// ─── Per-Request Registry ─────────────────────────────────────────────────────

/**
 * A per-render registry for content_for/yield_content blocks.
 *
 * CRITICAL: This must be instantiated fresh for every request.
 * Never store this as a module-level singleton — Cloudflare Worker
 * isolates are reused across requests, so a static registry would
 * leak content between users.
 *
 * The registry is created by withLayout() and threaded through
 * the render pipeline automatically. You don't instantiate this directly.
 */
export class ContentRegistry {
  private blocks = new Map<string, React.ReactNode[]>();
  private seen = new Set<string>(); // for deduplication by key

  push(name: string, content: React.ReactNode, dedupeKey?: string): void {
    // Deduplication: if two views both register the same script, only include it once.
    // e.g. content_for('scripts', <script src="...">, 'capnweb-loader')
    if (dedupeKey) {
      const fullKey = `${name}:${dedupeKey}`;
      if (this.seen.has(fullKey)) return;
      this.seen.add(fullKey);
    }

    const block = this.blocks.get(name) ?? [];
    block.push(content);
    this.blocks.set(name, block);
  }

  yield(name: string): React.ReactNode[] {
    // NOTE: We intentionally do NOT delete after yield.
    // In the original implementation, yield was destructive, which caused
    // silent failures if yield_content was called twice (e.g. in debug renders).
    // Read-only is safer. The registry is per-request so it's GC'd anyway.
    return this.blocks.get(name) ?? [];
  }

  has(name: string): boolean {
    return (this.blocks.get(name) ?? []).length > 0;
  }
}

// ─── Render Context ───────────────────────────────────────────────────────────

/**
 * Passed through the entire render pipeline.
 * Views and layouts receive this instead of needing globals.
 */
export interface RenderContext {
  registry: ContentRegistry;
  assets: AssetPipeline;
  /** CSP nonce for this request. Thread into all <script> and <style> tags. */
  nonce: string | undefined;
  /** The incoming request, for views that need URL, headers, etc. */
  request?: Request;
}

// ─── Base Classes ─────────────────────────────────────────────────────────────

export abstract class BaseView<P = Record<string, unknown>> {
  protected ctx!: RenderContext;

  constructor(protected props: P) {}

  abstract render(): React.ReactElement;

  /**
   * Register content to be rendered in a named block (e.g. 'head', 'scripts').
   *
   * @param name    The block name (matches yield_content in layout)
   * @param content The React element(s) to inject
   * @param dedupeKey Optional: if set, prevents duplicate registrations with
   *                  the same key. Use for script tags that multiple views
   *                  might register (e.g. a shared vendor script).
   *
   * @example
   * this.content_for('head', <title>{this.props.title}</title>);
   * this.content_for('scripts', <script src={...} />, 'my-component-loader');
   */
  protected content_for(
    name: string,
    content: React.ReactNode,
    dedupeKey?: string
  ): null {
    this.ctx.registry.push(name, content, dedupeKey);
    return null;
  }

  /**
   * Resolves a component's content-hashed asset URL.
   * Throws at render time if the component isn't in the manifest —
   * catches deploy mismatches before they ship broken HTML.
   */
  protected component_url(tag: string): string {
    return this.ctx.assets.component(tag);
  }

  /**
   * Resolves a vendor package's content-hashed asset URL.
   */
  protected vendor_url(pkg: string): string {
    return this.ctx.assets.vendor(pkg);
  }

  /**
   * Renders a <script type="module"> tag for a component, with nonce.
   * Handles cache-busting and deduplication automatically.
   */
  protected component_script(tag: string): null {
    const src = this.component_url(tag);
    return this.content_for(
      'scripts',
      <script key={src} src={src} type="module" nonce={this.ctx.nonce} />,
      `component:${tag}` // dedupe key
    );
  }

  static _render<P>(
    this: new (props: P) => BaseView<P>,
    props: P,
    ctx: RenderContext
  ): React.ReactElement {
    const instance = new this(props);
    instance.ctx = ctx;
    return instance.render();
  }
}

export abstract class BaseLayout<P = Record<string, unknown>> {
  protected ctx!: RenderContext;

  constructor(
    protected content: React.ReactElement,
    protected props: P
  ) {}

  abstract render(): React.ReactElement;

  /**
   * Renders all content registered for a named block.
   * Call this in your layout to inject head tags, scripts, etc.
   *
   * @example
   * <head>
   *   <meta charSet="utf-8" />
   *   {this.yield_content('head')}
   * </head>
   * <body>
   *   {this.content}
   *   {this.yield_content('scripts')}
   * </body>
   */
  protected yield_content(name: string): React.ReactNode {
    const items = this.ctx.registry.yield(name);
    if (items.length === 0) return null;
    return React.createElement(
      React.Fragment,
      null,
      ...items.map((item, i) =>
        React.isValidElement(item)
          ? React.cloneElement(item as React.ReactElement, {
              key: (item as React.ReactElement).key ?? `${name}-${i}`,
            })
          : item
      )
    );
  }

  /**
   * Returns the import map script tag for all vendored packages.
   * Place this as the FIRST thing in <head>, before any module scripts.
   *
   * @example
   * <head>
   *   {this.import_map()}
   *   {this.yield_content('head')}
   * </head>
   */
  protected import_map(): React.ReactElement {
    return (
      <script
        type="importmap"
        dangerouslySetInnerHTML={{ __html: this.ctx.assets.importMap() }}
      />
    );
  }

  static withLayout<
    L extends typeof BaseLayout,
    V extends typeof BaseView,
    P = Record<string, unknown>
  >(
    LayoutClass: L,
    ViewClass: V,
    props: P,
    assets: AssetPipeline,
    request?: Request
  ): string {
    // Fresh registry per render — the critical fix for CF Workers
    const ctx: RenderContext = {
      registry: new ContentRegistry(),
      assets,
      nonce: assets.nonce,
      request,
    };

    // Render the view first (populates the registry via content_for calls)
    const content = (ViewClass as any)._render(props, ctx);

    // Then render the layout (reads from registry via yield_content)
    const layout = new (LayoutClass as any)(content, props);
    layout.ctx = ctx;
    const element = layout.render();

    return '<!DOCTYPE html>' + renderToStaticMarkup(element);
  }
}

// ─── Custom Element Helper ────────────────────────────────────────────────────

/**
 * Renders a custom element tag for SSR.
 *
 * Why this exists:
 * - React serializes non-string props on unknown elements incorrectly.
 * - All HTML attributes must be strings; this helper enforces that.
 * - Handles Declarative Shadow DOM (DSD) for SSR'd shadow roots.
 *
 * @param tag       The custom element tag name, e.g. 'status-badge'
 * @param attrs     String attributes to set on the element.
 *                  All values are coerced to strings.
 *                  DO NOT put sensitive data here — it's visible in the DOM.
 * @param children  Light DOM children (e.g. a PropsIsland for complex data,
 *                  or a loading state for DSD)
 * @param shadow    If true, wraps children in a <template shadowrootmode="open">
 *                  for Declarative Shadow DOM. The browser will upgrade this
 *                  before JS loads, preventing flash of unstyled content.
 *
 * @example
 * // Simple:
 * custom_element('status-badge', { status: 'loading' }, 'Checking...')
 *
 * // With complex props via data island:
 * custom_element('user-dashboard', { 'initial-status': 'loading' }, (
 *   <PropsIsland props={{ user, config, permissions }} />
 * ))
 *
 * // With DSD loading state:
 * custom_element('status-badge', { status: 'loading' }, (
 *   <span class="badge">Loading...</span>
 * ), { shadow: true })
 */
export function custom_element(
  tag: string,
  attrs: Record<string, string | number | boolean | null | undefined> = {},
  children: React.ReactNode = null,
  options: { shadow?: boolean } = {}
): React.ReactElement {
  // Coerce all attribute values to strings (or omit if null/undefined)
  const safeAttrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    safeAttrs[key] = String(value);
  }

  const innerContent = options.shadow
    ? React.createElement(
        'template',
        // @ts-ignore — shadowrootmode is valid HTML but not in React's types
        { shadowrootmode: 'open' },
        children
      )
    : children;

  return React.createElement(tag, safeAttrs, innerContent);
}
