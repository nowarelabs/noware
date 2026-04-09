# nomo — Architecture & Gotcha Reference

## Package Map

| Package        | Where it runs              | What it does                                          |
| -------------- | -------------------------- | ----------------------------------------------------- |
| `nomo/build`   | Build time (Vite plugin)   | Compiles components, copies vendors, emits manifest   |
| `nomo/worker`  | Cloudflare Worker (server) | JSX → HTML, per-request registry, content_for/yield   |
| `nomo/runtime` | Cloudflare Worker (server) | Asset path resolution, CSP, import maps, PropsIsland  |
| `nomo/element` | Browser (web component)    | Base class: DSD, prop coercion, RPC loops, XSS safety |

---

## The Render Pipeline (Request Time)

```
Browser request
  └── Worker: BaseLayout.withLayout(Layout, View, props, assets, request)
        │
        ├── 1. new ContentRegistry()          ← fresh per request, never static
        ├── 2. View._render(props, ctx)        ← populates registry via content_for()
        │         └── content_for('head', ...) → registry.push('head', ...)
        │         └── component_script(tag)   → registry.push('scripts', <script...>)
        │         └── returns JSX body
        │
        ├── 3. Layout.render()                 ← reads registry via yield_content()
        │         └── yield_content('head')   → registry.yield('head') → React nodes
        │         └── yield_content('scripts')→ registry.yield('scripts') → React nodes
        │         └── import_map()            → <script type="importmap" ...>
        │
        └── 4. renderToStaticMarkup(element)  → HTML string → Response
```

---

## Why Each Decision Was Made

### 1. Per-request ContentRegistry (not static)

**Problem:** Cloudflare Worker isolates are reused between requests. A static `Map` on a class leaks content from request A into request B — different users get each other's `<title>` tags, scripts, etc.

**Fix:** `withLayout()` creates `new ContentRegistry()` on every call. It lives only for the duration of that render, then is GC'd.

```ts
// WRONG — do not do this:
class ContentRegistry {
  private static blocks = new Map(); // ← lives forever, shared across requests
}

// RIGHT:
const ctx = { registry: new ContentRegistry(), ... }; // ← created per render
```

### 2. Import Maps for vendor packages

**Problem:** Web components in the browser can't resolve bare `import { X } from 'capnweb'` — that's a Node.js concept. But you want to write idiomatic imports.

**Fix:** At build time, copy `capnweb` to `/assets/vendor/capnweb/index.[hash].js`. At request time, inject an import map into `<head>`:

```json
{
  "imports": {
    "capnweb": "/assets/vendor/capnweb/index.f2a8b1.js"
  }
}
```

The browser resolves the bare specifier to the hashed URL. Works in all modern browsers. No bundling needed in the web component for vendor deps.

**Critical:** The import map `<script>` tag MUST come before any `<script type="module">` in the HTML. The layout's `import_map()` helper places it first.

### 3. Content-hashed asset URLs (no stale cache)

**Problem:** If `status-badge.js` doesn't have a hash in the filename, redeploying with a bug fix doesn't bust the browser cache. Users run old code.

**Fix:** Vite's `[name].[hash].js` output format produces `status-badge.a3f9c2.js`. The manifest records the mapping. `assets.component('status-badge')` always returns the current hashed URL.

The HTML shell can be cached for 10-60 seconds with `stale-while-revalidate`. The assets themselves (`/assets/**`) can be cached forever (`Cache-Control: immutable`).

### 4. Data Islands for complex props (not HTML attributes)

**Problem:** HTML attributes are strings only. Passing `user={{ id: 1, name: 'Alice' }}` to a custom element via attributes loses type information and would appear as `[object Object]`.

**Fix:** The Worker renders a `<script type="application/json">` inside the custom element's light DOM. The web component reads it in `connectedCallback`.

```html
<user-dashboard initial-tab="overview">
  <script type="application/json">
    { "user": { "id": 1, "name": "Alice" } }
  </script>
</user-dashboard>
```

- Parsed as JSON → types preserved
- Not visible as DOM attributes → cleaner DevTools
- Works with SSR → no hydration mismatch
- Safe against XSS → `</script>` sequences are escaped

Use string attributes only for simple values the web component needs to `observe` reactively (e.g. `status`, `color`). Use data islands for initial complex data.

### 5. applyProps() prevents double-renders

**Problem:** Calling `setAttribute('status', x)` then `setAttribute('color', y)` triggers `attributeChangedCallback` twice → two renders.

**Fix:** `applyProps({ status, color })` sets `#batchingProps = true`, applies all attributes, then calls `render()` exactly once.

### 6. `using` for Cap'n Web batch sessions

**Problem:** `newHttpBatchRpcSession()` allocates server-side resources. If the session isn't disposed, the server leaks stubs — memory leak that compounds on every 5-second poll cycle.

**Fix:** Use `using` (explicit resource management, standard JS since 2025):

```ts
using batch = newHttpBatchRpcSession("/api");
const data = await batch.getSystemStatus().get();
// batch[Symbol.dispose]() called automatically when scope exits
```

### 7. `this.html` tagged template literal (not bare innerHTML)

**Problem:** `this.shadowRoot.innerHTML = \`<span>${status}</span>\``is XSS if`status` comes from RPC data (which comes from the network).

**Fix:** The `html` tagged template literal from `nomoElement` escapes all interpolated values:

```ts
this.shadowRoot.innerHTML = this.html`<span>${status}</span>`;
// If status = '</span><script>evil()</script>', it becomes:
// <span>&lt;/span&gt;&lt;script&gt;evil()&lt;/script&gt;</span>
```

### 8. `safeCssColor()` for CSS injection

**Problem:** Injecting `color` directly into a `<style>` block: `background-color: ${color}` is CSS injection if `color` is attacker-controlled. A value like `red} :host{display:none` breaks your component.

**Fix:** `safeCssColor(value, fallback)` validates against known safe patterns (hex, named, rgb/hsl) and returns the fallback if invalid.

### 9. React app communicates via CustomEvents, not props callbacks

**Problem:** If the React app takes callback props (`onTabChange={...}`), the enclosing web component needs to re-render React to pass new callbacks — coupling the two layers.

**Fix:** The React app receives `emit(eventName, detail)` as a prop. Events bubble up through the shadow DOM (`composed: true`). The enclosing web component listens for events and responds. Neither layer holds a reference to the other.

```ts
// React app:
emit("tab:changed", { tab: "stats" });

// Enclosing web component:
this.shadowRoot.querySelector("user-dashboard").addEventListener("tab:changed", (e) => {
  // respond to tab change
});
```

### 10. Exponential backoff in the update loop

**Problem:** If the Worker API goes down, a fixed 5-second interval hammers the endpoint forever — 720 requests/hour per client.

**Fix:** `startUpdateLoop()` doubles the delay on each failure up to 60s. Resets on success.

---

## Common Gotchas for Developers

### "My content_for head tags aren't showing up"

- Check your layout calls `{this.yield_content('head')}` in `<head>`
- The block name must match exactly (case-sensitive)
- `yield_content` returns `null` if nothing was registered — not an error

### "My web component script loads twice"

- You're calling `component_script('my-tag')` in two views that both render
- It's deduplicated by tag name automatically — only one `<script>` tag will appear

### "Import map isn't working / capnweb can't be resolved"

- The `<script type="importmap">` must be before your `<script type="module">` tags
- Check the layout: `{this.import_map()}` must come before `{this.yield_content('scripts')}`
- Verify the vendor was added to `nomo({ vendors: [{ package: 'capnweb' }] })`

### "My props are all strings / objects are [object Object]"

- You're passing complex props as HTML attributes
- Use `<PropsIsland props={...} />` inside the custom element instead
- The web component reads it via `this.querySelector('script[type="application/json"]')`

### "Status badge flickers on load"

- Your DSD template (the `shadow: true` content) should match what the JS renders
- The web component's first `render()` call runs before RPC completes
- Set a meaningful initial `status` attribute in the Worker view, not `'loading'`

### "RPC data is leaking between users"

- You have shared state somewhere — check for module-level variables
- The Cap'n Web batch session should be created inside `startUpdateLoop`, not outside it
- `using batch = newHttpBatchRpcSession(...)` must be inside the async function

### "TypeScript says my tag isn't in the manifest"

- The component wasn't built — check `vite.config.ts` `rollupOptions.input`
- The manifest was regenerated but the Worker wasn't redeployed
- The tag name has a typo (tag names are case-sensitive)
