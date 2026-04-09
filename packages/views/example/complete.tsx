/**
 * COMPLETE EXAMPLE — nomo
 *
 * This file shows the full pattern from build → deploy → request.
 * It is annotated heavily to explain every decision.
 *
 * Directory structure this produces:
 *
 *   dist/
 *     assets/
 *       manifest.json                          ← read by Worker at init
 *       status-badge.a3f9c2.js                 ← hashed web component
 *       user-dashboard.b7e1d4.js               ← hashed React-wrapped component
 *       vendor/
 *         capnweb/
 *           index.f2a8b1.js                    ← hashed vendor copy
 *           importmap.json                     ← package → hashed URL
 *     worker/
 *       index.js                               ← Cloudflare Worker
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. BUILD TIME — vite.config.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { defineConfig } from 'vite';
import { nomo } from 'nomo/build';

export const buildConfig = defineConfig({
  plugins: [
    nomo({
      components: [
        {
          // A vanilla web component (no React)
          tag: 'status-badge',
          src: './src/elements/StatusBadge.ts',
        },
        {
          // A React app packaged as a web component.
          // The build plugin auto-generates the wrapper scaffold.
          tag: 'user-dashboard',
          src: './src/apps/UserDashboard.tsx',
          react: true,
          shadow: 'open',
        },
      ],
      vendors: [
        // capnweb is copied to /assets/vendor/capnweb/index.[hash].js
        // The browser import map resolves `import { ... } from 'capnweb'`
        // to this hashed URL automatically.
        { package: 'capnweb' },
      ],
      assetsDir: 'dist/assets',
      manifest: true,    // emit dist/assets/manifest.json
      base: '/assets/',
    }),
  ],
  build: {
    // Build components as separate entries so each gets its own hashed file
    rollupOptions: {
      input: {
        'status-badge': './src/elements/StatusBadge.ts',
        'user-dashboard': './src/apps/UserDashboard.tsx',
      },
      output: {
        // Content-hashed filenames — cache forever, never stale
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]',
      },
    },
    outDir: 'dist/assets',
  },
});


// ═══════════════════════════════════════════════════════════════════════════════
// 2. BUILD TIME — A React app (user-dashboard)
//    src/apps/UserDashboard.tsx
//
// This is a DUMB React app. It:
// - Receives all data as props (no stores, no fetch, no RPC)
// - Communicates upward via emit() (no callbacks, no stores)
// - The enclosing web component drives it entirely
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';

interface UserDashboardProps {
  user: { id: number; name: string; email: string };
  stats: { uptime: number; requests: number };
  emit: (eventName: string, detail?: unknown) => void; // injected by wrapper
}

export function UserDashboard({ user, stats, emit }: UserDashboardProps) {
  const [selectedTab, setSelectedTab] = useState('overview');

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    // Bubble up to the enclosing web component
    emit('tab:changed', { tab });
  };

  return (
    <div className="dashboard">
      <h1>Welcome, {user.name}</h1>
      <nav>
        {['overview', 'stats', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={selectedTab === tab ? 'active' : ''}
          >
            {tab}
          </button>
        ))}
      </nav>
      {selectedTab === 'overview' && (
        <div>
          <p>Email: {user.email}</p>
          <p>User ID: {user.id}</p>
        </div>
      )}
      {selectedTab === 'stats' && (
        <div>
          <p>Uptime: {stats.uptime}s</p>
          <p>Requests: {stats.requests}</p>
        </div>
      )}
    </div>
  );
}

// The build plugin reads this to know which string attributes to observe
UserDashboard.observedAttributes = ['initial-tab'];

export default UserDashboard;


// ═══════════════════════════════════════════════════════════════════════════════
// 3. BUILD TIME — A vanilla web component (status-badge)
//    src/elements/StatusBadge.ts
//
// Extends nomoElement which handles all the gotchas.
// ═══════════════════════════════════════════════════════════════════════════════

import { nomoElement, safeCssColor } from 'nomo/element';
import { newHttpBatchRpcSession } from 'capnweb'; // resolved by import map at runtime

class StatusBadge extends nomoElement {
  // Declare which attributes exist and their types.
  // Coercion, observedAttributes(), and DOM sync happen automatically.
  static propSchema = {
    status: 'string',
    color: 'string',
  };

  // Called after connectedCallback + initial render.
  // Start RPC here, not in the constructor.
  protected connectedRpc(): void {
    // Run once immediately, then every 5s with exponential backoff on failure.
    this.startUpdateLoop(async () => {
      // `using` disposes the batch session when done → no server resource leaks
      using batch = newHttpBatchRpcSession('/api');

      // Promise pipelining: both calls go in one HTTP round trip
      const data = await batch.getSystemStatus().get();

      // applyProps batches attribute updates → single render, no double-render
      this.applyProps({ status: data.status, color: data.color });
    }, 5000);
  }

  render(): void {
    const status = (this.props.status as string) ?? 'unknown';
    // safeCssColor validates before injecting into CSS — no style injection attacks
    const color = safeCssColor(this.props.color, status === 'operational' ? '#10b981' : '#f59e0b');

    // this.html`` escapes interpolations — no XSS from RPC data
    this.shadowRoot!.innerHTML = this.html`
      <style>
        :host { display: inline-block; font-family: system-ui, sans-serif; }
        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
          background-color: ${color};
          transition: background-color 0.3s ease;
        }
      </style>
      <span class="badge">${status.toUpperCase()}</span>
    `;
  }
}

if (!customElements.get('status-badge')) {
  customElements.define('status-badge', StatusBadge);
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. REQUEST TIME — Worker
//    src/worker/index.ts
//
// Loaded ONCE per isolate init (not per request).
// ═══════════════════════════════════════════════════════════════════════════════

import { BaseLayout, BaseView, custom_element } from 'nomo/worker';
import { AssetPipeline, generateNonce, buildCSP, PropsIsland } from 'nomo/runtime';

// Import manifest at module init time — it's static and built at deploy time.
// This is the right place: module-level, not per-request.
// @ts-ignore — resolved by bundler
import manifest from '../../dist/assets/manifest.json';


// ─── Layout ───────────────────────────────────────────────────────────────────

interface LayoutProps {
  title?: string;
}

class AppLayout extends BaseLayout<LayoutProps> {
  render() {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />

          {/*
            Import map MUST come before any <script type="module">.
            This is what makes `import { ... } from 'capnweb'` work
            in your web component — it maps the bare specifier to the
            hashed vendor URL at runtime in the browser.
          */}
          {this.import_map()}

          {/* Views register head content via content_for('head', ...) */}
          {this.yield_content('head')}
        </head>
        <body>
          {this.content}

          {/*
            Scripts at end of body.
            Views register their component loaders via content_for('scripts', ...).
            The registry deduplicates: same tag loaded by multiple views = one script tag.
          */}
          {this.yield_content('scripts')}
        </body>
      </html>
    );
  }
}


// ─── View ─────────────────────────────────────────────────────────────────────

interface SystemStatusProps {
  title: string;
  environment: string;
  status: string;
  user: { id: number; name: string; email: string };
  uptime: number;
}

class SystemStatusView extends BaseView<SystemStatusProps> {
  render() {
    // Register head content — runs into registry, renders nothing here
    this.content_for('head', <>
      <title>{this.props.title}</title>
      <meta name="description" content="System status page" />
    </>);

    // Register component script — deduplicated by tag name
    // Uses content-hashed URL from manifest, CSP nonce automatically applied
    this.component_script('status-badge');
    this.component_script('user-dashboard');

    return (
      <main className="container">
        <h1>System Status</h1>

        {/*
          Simple custom element: string attributes only.
          No complex data needed — the web component fetches its own data via RPC.
          The SSR shell just provides an initial state to avoid flicker.
        */}
        {custom_element(
          'status-badge',
          { status: this.props.status },
          'Checking...',
          { shadow: true }
        )}

        {/*
          React-wrapped custom element: complex props via data island.
          The island is inside the custom element's light DOM.
          The web component's scaffold reads it in connectedCallback.

          WHY NOT ATTRIBUTES?
          - HTML attributes are strings only
          - user={...} would become "[object Object]"
          - Data islands preserve types, structure, and large data cleanly
        */}
        {custom_element(
          'user-dashboard',
          { 'initial-tab': 'overview' },
          <PropsIsland props={{
            user: this.props.user,
            stats: { uptime: this.props.uptime, requests: 0 },
          }} />
        )}
      </main>
    );
  }
}


// ─── Worker Handler ───────────────────────────────────────────────────────────

export default {
  fetch(request: Request, _env: unknown, _ctx: ExecutionContext): Response {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      // Generate a fresh nonce for this request's CSP
      const nonce = generateNonce();

      // AssetPipeline is request-scoped (nonce varies per request).
      // manifest is module-scoped (never changes within a deploy).
      const assets = new AssetPipeline({ manifest, nonce });

      // Build the HTML. This is the only call you need.
      // Internally: renders View (populates registry) → renders Layout (reads registry)
      const html = BaseLayout.withLayout(
        AppLayout,
        SystemStatusView,
        {
          title: 'System Status',
          environment: 'production',
          status: 'loading', // initial shell; web component fetches real status
          user: { id: 1, name: 'Alice', email: 'alice@example.com' },
          uptime: 0,
        },
        assets,
        request
      );

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          // CSP header — nonce matches what was injected into <script> tags
          'Content-Security-Policy': buildCSP({
            nonce,
            connectSrc: ["'self'", '/api'],
          }),
          // Cache the HTML shell at the edge for 10 seconds.
          // Web components fetch fresh data via RPC anyway.
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=60',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
