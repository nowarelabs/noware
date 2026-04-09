/**
 * nomo/runtime
 *
 * Reads the asset manifest at request time and provides:
 * - Content-hashed path resolution (no stale cache bugs)
 * - Import map generation for vendored packages
 * - CSP nonce threading
 * - Type-safe asset access
 *
 * This runs inside the Cloudflare Worker on every request.
 */

import type { AssetManifest, AssetManifestEntry, VendorManifestEntry } from "nomo/build";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetPipelineOptions {
  /**
   * The manifest JSON. In a Worker, load this at module init time:
   *
   *   import manifest from '../dist/assets/manifest.json';
   *   const assets = new AssetPipeline(manifest);
   *
   * Do NOT load this per-request — it's static and won't change between
   * deploys. The Worker module is re-instantiated on deploy.
   */
  manifest: AssetManifest;

  /**
   * CSP nonce for this request. Generate one per request with generateNonce().
   * Thread it into your layout and all script/style tags.
   */
  nonce?: string;
}

// ─── Asset Pipeline ───────────────────────────────────────────────────────────

export class AssetPipeline {
  readonly nonce: string | undefined;
  private readonly manifest: AssetManifest;

  constructor(options: AssetPipelineOptions) {
    this.manifest = options.manifest;
    this.nonce = options.nonce;
  }

  /**
   * Resolves a component tag to its content-hashed public URL.
   *
   * @throws if the tag is not in the manifest (catches deploy mismatches early)
   *
   * @example
   * assets.component('status-badge')
   * // → '/assets/status-badge.a3f9c2.js'
   */
  component(tag: string): string {
    const entry = this.manifest.entries[tag];
    if (!entry) {
      throw new Error(
        `[nomo] Unknown component "${tag}". ` +
          `Available: ${Object.keys(this.manifest.entries).join(", ")}. ` +
          `Did you forget to add it to nomo({ components: [...] })?`,
      );
    }
    return entry.src;
  }

  /**
   * Resolves a vendor package to its content-hashed public URL.
   *
   * @example
   * assets.vendor('capnweb')
   * // → '/assets/vendor/capnweb/index.a3f9c2.js'
   */
  vendor(pkg: string): string {
    const entry = this.manifest.vendors[pkg];
    if (!entry) {
      throw new Error(
        `[nomo] Unknown vendor "${pkg}". ` +
          `Available: ${Object.keys(this.manifest.vendors).join(", ")}. ` +
          `Did you add it to nomo({ vendors: [...] })?`,
      );
    }
    return entry.src;
  }

  /**
   * Returns a complete import map JSON string for all vendored packages.
   * Inject this into your HTML <head> via a <script type="importmap"> tag.
   *
   * This lets your web components do:
   *   import { newHttpBatchRpcSession } from 'capnweb';
   * ...and the browser resolves it to the hashed vendor URL automatically.
   *
   * @example
   * // In your layout:
   * <script type="importmap" dangerouslySetInnerHTML={{ __html: assets.importMap() }} />
   */
  importMap(): string {
    const imports: Record<string, string> = {};
    for (const [pkg, entry] of Object.entries(this.manifest.vendors)) {
      imports[pkg] = entry.src;
    }
    return JSON.stringify({ imports }, null, 2);
  }

  /**
   * Returns the full manifest entry for a component, for advanced use.
   */
  componentEntry(tag: string): AssetManifestEntry {
    const entry = this.manifest.entries[tag];
    if (!entry) throw new Error(`[nomo] Unknown component "${tag}"`);
    return entry;
  }

  /**
   * Returns the full manifest entry for a vendor, for advanced use.
   */
  vendorEntry(pkg: string): VendorManifestEntry {
    const entry = this.manifest.vendors[pkg];
    if (!entry) throw new Error(`[nomo] Unknown vendor "${pkg}"`);
    return entry;
  }
}

// ─── CSP ──────────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random CSP nonce for a single request.
 * Use the Web Crypto API (available in CF Workers and all modern runtimes).
 *
 * @example
 * const nonce = generateNonce();
 * const assets = new AssetPipeline({ manifest, nonce });
 * // Then in your layout: <script nonce={assets.nonce} ...>
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Builds a Content-Security-Policy header value.
 * Call this after all your content_for('scripts', ...) are registered,
 * or just use the nonce pattern and let the browser enforce it.
 *
 * @example
 * const cspHeader = buildCSP({
 *   nonce,
 *   scriptSrc: ["'self'"],
 *   styleSrc: ["'self'", "'unsafe-inline'"],
 * });
 * // Add to response headers: 'Content-Security-Policy': cspHeader
 */
export function buildCSP(options: {
  nonce: string;
  scriptSrc?: string[];
  styleSrc?: string[];
  connectSrc?: string[];
  imgSrc?: string[];
  defaultSrc?: string[];
}): string {
  const {
    nonce,
    scriptSrc = ["'self'"],
    styleSrc = ["'self'", "'unsafe-inline'"],
    connectSrc = ["'self'"],
    imgSrc = ["'self'", "data:"],
    defaultSrc = ["'self'"],
  } = options;

  const directives = [
    `default-src ${defaultSrc.join(" ")}`,
    `script-src ${[...scriptSrc, `'nonce-${nonce}'`].join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
  ];

  return directives.join("; ");
}

// ─── Props Island ─────────────────────────────────────────────────────────────

/**
 * Serializes props for injection as a data island inside a custom element.
 *
 * Why a data island instead of HTML attributes?
 * - HTML attributes are strings only. Objects, arrays, numbers all lose type.
 * - Large data would bloat the attribute string and show in DevTools.
 * - Data islands are standard, SEO-friendly, and invisible to the DOM.
 *
 * Usage in your Worker view:
 *
 *   <status-badge status="loading">
 *     {propsIsland({ user: { id: 1, name: 'Alice' }, config: { ... } })}
 *   </status-badge>
 *
 * The web component reads it in connectedCallback:
 *   const island = this.querySelector('script[type="application/json"]');
 *   const props = JSON.parse(island.textContent);
 *
 * SECURITY: propsIsland escapes </script> sequences to prevent injection.
 */
export function propsIsland(props: Record<string, unknown>): string {
  // Escape </script> to prevent breaking out of the script tag.
  // This is the only XSS vector in a data island.
  const json = JSON.stringify(props).replace(/<\/script>/gi, "<\\/script>");
  return `<script type="application/json">${json}</script>`;
}

/**
 * React-compatible version of propsIsland.
 * Returns a React element, safe to use in JSX.
 *
 * @example
 * import React from 'react';
 * import { PropsIsland } from 'nomo/runtime';
 *
 * <status-badge status="loading">
 *   <PropsIsland props={{ user, config }} />
 * </status-badge>
 */
export function PropsIsland({ props }: { props: Record<string, unknown> }) {
  const json = JSON.stringify(props).replace(/<\/script>/gi, "<\\/script>");
  // dangerouslySetInnerHTML is safe here: we control the serialization
  // and have escaped the only injection vector.
  return <script type="application/json" dangerouslySetInnerHTML={{ __html: json }} />;
}
