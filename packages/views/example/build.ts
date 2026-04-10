/* eslint-disable no-unused-vars */
/**
 * nomo/build
 *
 * Vite plugin that handles:
 * 1. Building React apps into self-contained web component wrappers
 * 2. Copying vendor npm packages (capnweb, etc.) to /assets/vendor/[pkg]/
 * 3. Generating an asset manifest with content-hashed filenames
 * 4. Ensuring DSD (Declarative Shadow DOM) compatibility for SSR'd custom elements
 */

import type { Plugin, ResolvedConfig } from "vite";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebComponentEntry {
  /**
   * The custom element tag name. Must contain a hyphen (spec requirement).
   * e.g. 'status-badge', 'user-dashboard'
   */
  tag: string;

  /**
   * Path to the web component source file.
   * e.g. './src/components/StatusBadge.ts'
   */
  src: string;

  /**
   * If true, the web component wraps a React app.
   * The build will inject the React wrapper scaffold automatically.
   */
  react?: boolean;

  /**
   * Shadow DOM mode. Defaults to 'open'.
   * Use 'none' for light DOM components (rare).
   */
  shadow?: "open" | "closed" | "none";
}

export interface VendorEntry {
  /**
   * The npm package name. e.g. 'capnweb'
   * Will be served at /assets/vendor/capnweb/index.js
   */
  package: string;

  /**
   * Optional: specific entry point within the package.
   * Defaults to the package's main/module field.
   */
  entry?: string;
}

export interface nomoOptions {
  /**
   * Web component entries to build.
   */
  components: WebComponentEntry[];

  /**
   * Vendor packages to copy to /assets/vendor/
   */
  vendors?: VendorEntry[];

  /**
   * Output directory for assets. Defaults to 'dist/assets'
   */
  assetsDir?: string;

  /**
   * Whether to emit a manifest.json for the worker to read.
   * Defaults to true. You almost certainly want this.
   */
  manifest?: boolean;

  /**
   * Base public path. Defaults to '/assets/'
   */
  base?: string;
}

export interface AssetManifest {
  version: string;
  generatedAt: string;
  base: string;
  entries: Record<string, AssetManifestEntry>;
  vendors: Record<string, VendorManifestEntry>;
}

export interface AssetManifestEntry {
  /** The hashed output filename, e.g. 'status-badge.a3f9c2.js' */
  file: string;
  /** The public URL path */
  src: string;
  /** Whether this is a React-wrapped component */
  isReact: boolean;
  /** The custom element tag name */
  tag: string;
  /** Source map path if available */
  map?: string;
}

export interface VendorManifestEntry {
  /** The hashed output filename */
  file: string;
  /** The public URL path */
  src: string;
  /** The original package name */
  package: string;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function nomo(options: nomoOptions): Plugin[] {
  const {
    components,
    vendors = [],
    assetsDir = "dist/assets",
    manifest: emitManifest = true,
    base = "/assets/",
  } = options;

  let resolvedConfig: ResolvedConfig;
  const manifest: AssetManifest = {
    version: "1",
    generatedAt: new Date().toISOString(),
    base,
    entries: {},
    vendors: {},
  };

  // ── Validation plugin ───────────────────────────────────────────────────────
  const validatePlugin: Plugin = {
    name: "nomo:validate",
    enforce: "pre",
    configResolved(config) {
      resolvedConfig = config;
    },
    buildStart() {
      // Validate all custom element tag names
      for (const component of components) {
        if (!component.tag.includes("-")) {
          this.error(
            `[nomo] Component tag "${component.tag}" must contain a hyphen. ` +
              `Custom element spec requires it. Use e.g. "${component.tag}-element".`,
          );
        }
        if (!fs.existsSync(path.resolve(component.src))) {
          this.error(`[nomo] Component src "${component.src}" does not exist.`);
        }
      }

      // Validate no duplicate tags
      const tags = components.map((c) => c.tag);
      const duplicates = tags.filter((t, i) => tags.indexOf(t) !== i);
      if (duplicates.length > 0) {
        this.error(`[nomo] Duplicate component tags: ${duplicates.join(", ")}`);
      }

      // Validate vendor packages exist in node_modules
      for (const vendor of vendors) {
        try {
          require.resolve(vendor.package);
        } catch {
          this.warn(
            `[nomo] Vendor package "${vendor.package}" not found in node_modules. ` +
              `Run: npm install ${vendor.package}`,
          );
        }
      }
    },
  };

  // ── React wrapper code generation ─────────────────────────────────────────
  const reactWrapPlugin: Plugin = {
    name: "nomo:react-wrap",
    enforce: "pre",
    resolveId(id) {
      // Virtual module for each react-wrapped component
      if (id.startsWith("virtual:nomo-react-wrap:")) {
        return "\0" + id;
      }
    },
    load(id) {
      if (!id.startsWith("\0virtual:nomo-react-wrap:")) return;

      const tag = id.replace("\0virtual:nomo-react-wrap:", "");
      const component = components.find((c) => c.tag === tag);
      if (!component || !component.react) return;

      // Generate a web component that wraps the React app.
      // Key design decisions:
      // - Props are passed as JSON in a <script type="application/json"> data island
      //   inside the custom element's light DOM (set by the SSR Worker).
      //   This avoids the string-only limitation of HTML attributes for complex data.
      // - String attributes (status, color, etc.) still work via observedAttributes.
      // - The React app communicates upward via CustomEvents, not a store.
      // - React renders into the shadow root, isolated from page styles.
      return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '${path.resolve(component.src)}';

class ${tagToClassName(tag)}Element extends HTMLElement {
  #root = null;
  #reactRoot = null;
  #props = {};

  constructor() {
    super();
    // DSD: shadow root may already exist from SSR
    if (!this.shadowRoot) {
      this.attachShadow({ mode: '${component.shadow ?? "open"}' });
    }
  }

  static get observedAttributes() {
    // These are simple string attributes from the SSR shell.
    // Complex props come from the data island (see connectedCallback).
    return App.observedAttributes ?? [];
  }

  connectedCallback() {
    // Read complex props from data island (set by Worker SSR)
    const island = this.querySelector('script[type="application/json"]');
    if (island) {
      try {
        this.#props = JSON.parse(island.textContent ?? '{}');
      } catch (e) {
        console.error('[${tag}] Failed to parse props island:', e);
      }
    }

    // Merge attribute props (string overrides)
    for (const attr of (App.observedAttributes ?? [])) {
      const val = this.getAttribute(attr);
      if (val !== null) this.#props[attr] = val;
    }

    this.#mount();
  }

  disconnectedCallback() {
    this.#reactRoot?.unmount();
    this.#reactRoot = null;
  }

  attributeChangedCallback(name, _old, value) {
    this.#props = { ...this.#props, [name]: value };
    this.#rerender();
  }

  // Public API for the enclosing web component to push new props
  setProps(newProps) {
    this.#props = { ...this.#props, ...newProps };
    this.#rerender();
  }

  #mount() {
    // Emit events up to the enclosing web component.
    // React app should call this.dispatchEvent(new CustomEvent(...)) 
    // but we provide a helper via a prop.
    const emit = (eventName, detail) => {
      this.dispatchEvent(new CustomEvent(eventName, {
        detail,
        bubbles: true,
        composed: true, // crosses shadow DOM boundary
      }));
    };

    this.#reactRoot = createRoot(this.shadowRoot);
    this.#rerender(emit);
  }

  #rerender(emit = this.#emit.bind(this)) {
    if (!this.#reactRoot) return;
    this.#reactRoot.render(
      React.createElement(App, { ...this.#props, emit })
    );
  }

  #emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true,
    }));
  }
}

if (!customElements.get('${tag}')) {
  customElements.define('${tag}', ${tagToClassName(tag)}Element);
}
`;
    },
  };

  // ── Vendor copy plugin ─────────────────────────────────────────────────────
  const vendorPlugin: Plugin = {
    name: "nomo:vendor",
    async writeBundle() {
      for (const vendor of vendors) {
        try {
          const pkgJsonPath = require.resolve(`${vendor.package}/package.json`);
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
          const pkgDir = path.dirname(pkgJsonPath);

          // Resolve entry: prefer module > exports['.'] > main
          const entryFile =
            vendor.entry ??
            pkgJson.module ??
            pkgJson.exports?.["."](
              typeof pkgJson.exports?.["."] === "string"
                ? pkgJson.exports["."]
                : (pkgJson.exports?.["."].import ?? pkgJson.exports?.["."].default),
            ) ??
            pkgJson.main ??
            "index.js";

          const entryPath = path.resolve(pkgDir, entryFile);
          if (!fs.existsSync(entryPath)) {
            console.warn(`[nomo] Vendor entry not found: ${entryPath}`);
            continue;
          }

          const content = fs.readFileSync(entryPath);
          const hash = contentHash(content);
          const ext = path.extname(entryFile);
          const hashedName = `index.${hash}${ext}`;

          const outDir = path.resolve(assetsDir, "vendor", vendor.package);
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(path.resolve(outDir, hashedName), content);

          // Also write an import map entry
          const importMapPath = path.resolve(outDir, "importmap.json");
          const importMap = {
            imports: {
              [vendor.package]: `${base}vendor/${vendor.package}/${hashedName}`,
            },
          };
          fs.writeFileSync(importMapPath, JSON.stringify(importMap, null, 2));

          manifest.vendors[vendor.package] = {
            file: `vendor/${vendor.package}/${hashedName}`,
            src: `${base}vendor/${vendor.package}/${hashedName}`,
            package: vendor.package,
          };

          console.log(`[nomo] Vendored ${vendor.package} → ${hashedName}`);
        } catch (e) {
          console.error(`[nomo] Failed to vendor ${vendor.package}:`, e);
        }
      }
    },
  };

  // ── Manifest emitter plugin ────────────────────────────────────────────────
  const manifestPlugin: Plugin = {
    name: "nomo:manifest",
    generateBundle(_options, bundle) {
      // Record component entries from the bundle
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") continue;

        const component = components.find((c) => {
          const expectedName = c.tag;
          return chunk.name === expectedName || chunk.facadeModuleId?.includes(c.tag);
        });

        if (component) {
          manifest.entries[component.tag] = {
            file: fileName,
            src: `${base}${fileName}`,
            isReact: component.react ?? false,
            tag: component.tag,
            map: bundle[`${fileName}.map`] ? `${fileName}.map` : undefined,
          };
        }
      }
    },
    writeBundle() {
      if (!emitManifest) return;

      manifest.generatedAt = new Date().toISOString();
      const manifestPath = path.resolve(assetsDir, "manifest.json");
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`[nomo] Manifest written to ${manifestPath}`);
    },
  };

  return [validatePlugin, reactWrapPlugin, vendorPlugin, manifestPlugin];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contentHash(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 8);
}

/**
 * Converts a kebab-case tag name to a PascalCase class name.
 * 'status-badge' → 'StatusBadge'
 */
function tagToClassName(tag: string): string {
  return tag
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
