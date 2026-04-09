# nomo/nofo

The Definitive "No-Transpiler" DSL for building Web Components.

NofoElement is a lightweight base class for creating vanilla HTML Web Components with **Signal-driven reactive state**, declarative UI wiring, and modern browser standards (like ElementInternals and Custom States) — without needing a transpiler, build step, or framework.

## Installation

```bash
npm install nomo/nofo
```

## Quick Start

```javascript
import { NofoElement } from 'nomo/nofo';

class MyCounter extends NofoElement {
  static props = { count: 0 };

  template() {
    return `
      <button on-click="decrement">-</button>
      <span>${this.state.count}</span>
      <button on-click="increment">+</button>
    `;
  }

  styles() {
    return `
      span { margin: 0 8px; font-size: 1.2rem; }
    `;
  }

  increment() {
    this.state.count++;
  }

  decrement() {
    this.state.count--;
  }
}

customElements.define('my-counter', MyCounter);
```

```html
<my-counter></my-counter>
```

---

## Core Concepts

### 1. Signal-Driven Reactive State

NofoElement uses a **Signal-backed Proxy** system. Any mutation to `this.state` automatically triggers a precise re-render. Unlike simple proxies, signals allow for fine-grained dependency tracking and optimized updates.

```javascript
class MyComponent extends NofoElement {
  template() {
    return `<p>Hello, ${this.state.name}!</p>`;
  }

  onMount() {
    this.state.name = 'World';
  }
}
```

#### Selective State Tracking

By default, any state change triggers a re-render. For optimization, use `static tracks` to specify which state fields should trigger re-renders:

```javascript
// Only re-render when 'count' or 'loading' changes
class OptimizedComponent extends NofoElement {
  static props = { count: 0, name: '', loading: false };
  static tracks = ['count', 'loading'];

  template() {
    // This will only update when count/loading changes
    // Changes to 'name' won't trigger a re-render
    return `<p>Count: ${this.state.count}</p>`;
  }
}
```

### 2. Declarative Wiring (`sync()`)

The `sync()` method provides a fluent, declarative way to "wire up" your component's state or attributes to CSS variables, data attributes, and custom states.

```javascript
onMount() {
  this.sync()
    .attr('theme').toCSS('--theme-color')
    .value(this.state.isLoading).toDataAttr('loading')
    .states({ error: !!this.state.error });
}
```

- **`.attr(name).toCSS(var, transform?)`**: Sync an attribute to a CSS custom property.
- **`.value(v).toDataAttr(name)`**: Set a `data-` attribute based on a value.
- **`.states({ ... })`**: Toggle [Custom States](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet) (accessible via `:state()` CSS selectors).

### 3. Reactive Effects (`effect()`)

Run side effects whenever a signal dependency changes. NofoElement automatically tracks which properties in `this.state` are accessed and re-runs the effect when they change.

```javascript
onMount() {
  this.effect(() => {
    console.log('Count is now:', this.state.count);
    // Cleanup function (optional)
    return () => console.log('Cleaning up effect...');
  });
}
```
*Effects are automatically cleaned up when the component is unmounted.*

### 4. Props & Attributes

Define `static props` to create properties that sync with HTML attributes.

```javascript
class UserCard extends NofoElement {
  static props = {
    name: 'Anonymous',
    avatar: '',
    active: false
  };

  template() {
    return `
      <img src="${this.avatar}" alt="${this.name}" />
      <h2>${this.name}</h2>
      <p class="${this.active ? 'active' : 'inactive'}">
        ${this.active ? 'Online' : 'Offline'}
      </p>
    `;
  }
}
```

```html
<user-card name="Alice" avatar="/alice.png" active></user-card>
```

**Type Handling:**
- **Booleans**: `active` attribute presence = `true`
- **Objects/Arrays**: JSON-serialized in attributes
- **Primitives**: Passed as-is

### 5. The `commit()` Method

For immutable state updates, use `commit()` with a mutation function:

```javascript
class TodoList extends NofoElement {
  static props = { items: [] };

  addItem(text) {
    this.commit('items', (items) => [...items, { text, done: false }]);
  }

  toggleItem(index) {
    this.commit('items', (items) => 
      items.map((item, i) => 
        i === index ? { ...item, done: !item.done } : item
      )
    );
  }
}
```

---

## Event Binding

### The `on-*` Convention

Add event handlers directly in your template using `on-EVENT` attributes:

```javascript
class MyButton extends NofoElement {
  static props = { label: 'Click me' };

  template() {
    return `<button on-click="handleClick">${this.label}</button>`;
  }

  handleClick(e) {
    console.log('Button clicked!', e);
  }
}
```

**How it works:**
1. On render, NofoElement scans for `on-*` attributes
2. Attaches the corresponding event listener
3. Looks for the handler first on the component instance, then in injected actions
4. Removes the attribute after binding

---

## Context System

### Providing Context

Parents can "provide" data to descendants via the context system:

```javascript
class App extends NofoElement {
  onMount() {
    // Provide data to specific child tags
    this.provide('user', { name: 'Alice', role: 'admin' }, ['user-profile']);
    
    // Provide actions to all descendants
    this.registerActions({
      logout: () => console.log('Logging out...')
    });
  }
}
```

### Injecting Context

Descendants request context from their ancestors:

```javascript
class UserProfile extends NofoElement {
  template() {
    const user = this.inject('user');
    return `<p>Welcome, ${user?.name || 'Guest'}</p>`;
  }
}
```

**How it works:**
- `inject(key)` dispatches a bubbling `nofo-context-request` event
- Ancestors check if they have a matching `key` and if the requesting tag is in `allowedTags`
- The first matching ancestor responds via callback

---

## Templates & Blueprints

### Basic Templates

Override `template()` to return HTML strings:

```javascript
class Card extends NofoElement {
  static props = { title: '', content: '' };

  template() {
    return `
      <div class="card">
        <h2>${this.title}</h2>
        <p>${this.content}</p>
      </div>
    `;
  }
}
```

### Template Blueprints

For rendering lists, forms, and reusable UI fragments, define `<template slot="blueprint-*">` elements as **children** of the web component in your server-rendered HTML (or JSX view):

```html
<pools-table>
  <template slot="blueprint-pool-row">
    <tr>
      <td>{{id}}</td>
      <td>{{name}}</td>
      <td>{{participants}}</td>
      <td><span class="status status-{{status}}">{{status}}</span></td>
      <td>
        <button on-click="editPool" data-id="{{id}}">Edit</button>
        <button on-click="deletePool" data-id="{{id}}">Delete</button>
      </td>
    </tr>
  </template>
</pools-table>
```

The `blueprint-` prefix is a convention — it's stripped automatically, so the component references it by the short name (`'pool-row'`).

### Blueprint Naming Convention

| Slot in HTML | Component reference |
|---|---|
| `slot="blueprint-pool-row"` | `'pool-row'` |
| `slot="blueprint-pool-edit-row"` | `'pool-edit-row'` |
| `slot="blueprint-pool-create-form"` | `'pool-create-form'` |

You can also use plain slot names without the prefix (e.g., `slot="pool-row"`), but `blueprint-*` is the recommended convention for clarity.

### Render Methods

| Method | Purpose |
|---|---|
| `renderList(data, slot, options?)` | Render an array of items using a blueprint |
| `renderItem(item, slot)` | Render a single item using a blueprint |
| `renderForm(slot, data?)` | Render a form blueprint with optional initial data |
| `renderPartial(slot, data?)` | Render any arbitrary blueprint |
| `hasBlueprint(name)` | Check if a blueprint exists |
| `getBlueprint(name)` | Get the raw template element |
| `blueprintNames()` | List all registered blueprint names |

#### renderList with Conditional Branching

`renderList` accepts an optional `options.branch` array for rendering different blueprints based on conditions:

```javascript
class PoolsTable extends NofoElement {
  template() {
    return `
      <div>
        ${this.state.showForm ? this.renderForm('pool-create-form') : ''}
        <table>
          <tbody>
            ${this.renderList(this.state.pools, 'pool-row', {
              branch: [
                { test: (pool) => this.state.editingId === pool.id, slot: 'pool-edit-row' },
                { test: (pool) => pool.status === 'archived', slot: 'pool-archived-row' }
              ]
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}
```

Branches are evaluated in order. The first matching condition wins. If no branch matches, the default `slot` is used.

### Inline List Rendering with `list()`

For simpler lists, use the `list()` helper for inline iteration:

```javascript
class UserList extends NofoElement {
  static props = { users: [] };

  template() {
    return `
      <ul>
        ${this.list(this.users, (user, index) => `
          <li data-index="${index}">
            <img src="${user.avatar}" alt="${user.name}" />
            <span>${user.name}</span>
          </li>
        `)}
      </ul>
    `;
  }
}
```

### Nested Property Binding

All render methods support nested properties:

```html
<user-list users='[{"name": "Alice", "profile": {"role": "Admin"}}]'>
  <template slot="blueprint-user-item">
    <div>{{name}} - {{profile.role}}</div>
  </template>
</user-list>
```

---

## Blueprint Interpolation

Blueprints use `{{key}}` placeholders and `nofo-*` directives that are processed at render time. All patterns produce **valid HTML** — browsers ignore unknown attributes natively, so templates are previewable without breaking.

### Value Replacement

Replaces `{{key}}` with the corresponding value from the data object. Supports dot notation for nested properties.

```html
<!-- Before -->
<td>{{name}}</td>
<td>{{user.email}}</td>
<td>{{address.city}}</td>
```

```html
<!-- After (data: { name: "Alice", user: { email: "alice@example.com" }, address: { city: "NYC" } }) -->
<td>Alice</td>
<td>alice@example.com</td>
<td>NYC</td>
```

**Nuance:** Missing or `undefined` values become empty strings. `0` renders as `"0"`, `false` renders as `""`.

### Conditional Text (ternary)

Inline ternary expressions for text content. The most developer-friendly pattern for simple conditionals.

```html
<!-- Before -->
<span>{{isActive ? 'Online' : 'Offline'}}</span>
<span>{{role ? role : 'Guest'}}</span>
```

```html
<!-- After (data: { isActive: true, role: null }) -->
<span>Online</span>
<span>Guest</span>
```

**Nuance:** The ternary is evaluated as a string comparison, not JavaScript. The `{{key}}` part must be a simple key or dot-path. Complex expressions are not supported.

### Dynamic Class Names

For class names derived directly from data values, use interpolation inside the `class` attribute.

```html
<!-- Before -->
<span class="status status-{{status}}">{{status}}</span>
```

```html
<!-- After (data: { status: "active" }) -->
<span class="status status-active">active</span>

<!-- After (data: { status: "pending" }) -->
<span class="status status-pending">pending</span>
```

**Nuance:** This is the preferred pattern when the class name is derived from the data value itself. It's DRY — one attribute covers all possible values.

### Conditional Classes

Adds a class name only when the data key is truthy. Use for boolean toggles, not value-derived names.

```html
<!-- Before -->
<span class="badge" nofo-class:active="{{isActive}}" nofo-class:error="{{hasError}}">
  {{label}}
</span>
```

```html
<!-- After (data: { isActive: true, hasError: false, label: "Running" }) -->
<span class="badge active">Running</span>

<!-- After (data: { isActive: false, hasError: true, label: "Failed" }) -->
<span class="badge error">Failed</span>
```

**Nuance:** The class name is the part after the colon (`nofo-class:active` → `active`). The value is checked for truthiness. Do **not** use this for value-derived classes like `status-active` — use dynamic class names instead, since all options would be truthy strings and all classes would be added.

### Conditional Selected

For `<select>` elements, declare the data key on each option. The engine compares each option's `value` against the data value — only the match gets `selected`.

```html
<!-- Before -->
<select name="status">
  <option value="active" nofo-selected="status">Active</option>
  <option value="pending" nofo-selected="status">Pending</option>
  <option value="completed" nofo-selected="status">Completed</option>
</select>
```

```html
<!-- After (data: { status: "pending" }) -->
<select name="status">
  <option value="active">Active</option>
  <option value="pending" selected>Pending</option>
  <option value="completed">Completed</option>
</select>
```

**Nuance:** The `nofo-selected="status"` on all three options is intentional and DRY. The engine reads the `status` value from data, then checks each option's `value` against it. Only the matching option gets the `selected` attribute.

### Conditional Boolean Attributes

Adds or removes boolean attributes (`disabled`, `checked`, `hidden`, `readonly`, `required`) based on truthiness.

```html
<!-- Before -->
<button nofo-disabled="{{isLocked}}">Delete</button>
<input type="checkbox" nofo-checked="{{isActive}}" />
<input type="text" nofo-readonly="{{isReadOnly}}" />
<input type="text" nofo-required="{{isRequired}}" />
```

```html
<!-- After (data: { isLocked: true, isActive: false, isReadOnly: true, isRequired: false }) -->
<button disabled>Delete</button>
<input type="checkbox" />
<input type="text" readonly />
<input type="text" />
```

**Nuance:** When the value is falsy, the attribute is removed entirely (not set to `false` or empty string). This ensures correct browser behavior.

### Conditional Attributes

Sets an attribute to the data value if truthy, removes it if falsy.

```html
<!-- Before -->
<a nofo-attr:href="{{url}}" nofo-attr:title="{{tooltip}}" nofo-attr:target="{{target}}">Link</a>
```

```html
<!-- After (data: { url: "/profile", tooltip: "View profile", target: "_blank" }) -->
<a href="/profile" title="View profile" target="_blank">Link</a>

<!-- After (data: { url: null, tooltip: null, target: "_self" }) -->
<a target="_self">Link</a>
```

**Nuance:** The attribute is set to the actual data value (not just added/removed). If the value is falsy, the attribute is removed entirely.

### Conditional Elements

Shows or hides an entire element based on a data key.

```html
<!-- Before -->
<div nofo-if="{{isAdmin}}">
  <button on-click="deleteUser">Delete</button>
</div>
```

```html
<!-- After (data: { isAdmin: true }) -->
<div>
  <button on-click="deleteUser">Delete</button>
</div>

<!-- After (data: { isAdmin: false }) -->
<!--nofo-if-false-->
```

**Nuance:** When falsy, the element is replaced with an HTML comment `<!--nofo-if-false-->`. The element and all its children are removed from the DOM. This is not the same as CSS `display: none` — the content is not rendered at all.

### Else Blocks

Marks an element to be shown when a preceding `nofo-if` element is hidden.

```html
<!-- Before -->
<div nofo-if="{{users.length}}">
  <table>...</table>
</div>
<div nofo-else="empty-state">
  <p>No users found.</p>
</div>
```

```html
<!-- After (data: { users: [] }) -->
<!--nofo-if-false-->
<div>
  <p>No users found.</p>
</div>

<!-- After (data: { users: [{ name: "Alice" }] }) -->
<div>
  <table>...</table>
</div>
<!--nofo-else-target="empty-state"-->
```

**Nuance:** The `nofo-else` element is identified by the `id` attribute. When the `nofo-if` element is truthy, the `nofo-else` element is hidden (replaced with a comment). When the `nofo-if` is falsy, the `nofo-else` element is shown. The `nofo-else` element must be a sibling of the `nofo-if` element.

---

## Global Configuration

Nofo ships with sensible defaults that can be overridden at the app level or per-component.

### Global Configuration (App Entry Point)

```javascript
import { Nofo } from 'nomo/nofo';

Nofo.configure({
  rpc: {
    staleTime: 60_000,        // 1 min cache TTL (default: 5 min)
    persist: true,            // sessionStorage persistence (default: true)
    timeout: 15000,           // 15s request timeout (default: 30s)
    retries: 2,               // auto-retry on failure (default: 0)
    retryDelay: 1000,         // 1s between retries (default: 1s)
  },
  url: {
    sync: 'push',             // 'replace' | 'push' | 'none' (default: 'replace')
    debounce: 100,            // ms to debounce URL updates (default: 0)
  },
  loading: {
    minDisplay: 200,          // minimum ms loading state shows (default: 0)
    indicator: true,          // auto-track loading state (default: true)
  },
  error: {
    autoDisplay: true,            // auto-track error state (default: true)
    maxMessageLength: 200,        // truncate long error messages (default: 200)
  },
  render: {
    debounce: 0,                  // ms to debounce re-renders (default: 0)
  },
});
```

### Per-Component Override

Component-level options merge on top of global defaults:

```javascript
class PoolsTable extends NofoElement {
  static rpc = {
    baseUrl: '/v1/rpc',
    endpoints: [{ name: 'pools', path: '/pools' }],
    options: { staleTime: 30_000 }  // overrides global staleTime
  };
}
```

### Reset to Defaults

```javascript
Nofo.reset();  // Restore all defaults
```

---

## RPC & Data Fetching

Nofo includes a built-in RPC client with caching, deduplication, and automatic cache invalidation.

### Configuration

```javascript
class PoolsTable extends NofoElement {
  static rpc = {
    baseUrl: '/v1/rpc',
    endpoints: [{ name: 'pools', path: '/pools' }],
    options: { staleTime: 60_000 }  // 1 minute cache
  };
}
```

### Usage

```javascript
// Fetch with automatic caching
const result = await this.rpc.pools.list({ page: 1, perPage: 10 });
// result = { data: { items: [...], total: 25, page: 1, perPage: 10, totalPages: 3 }, error: null }

// Create (invalidates cache automatically)
await this.rpc.pools.create({ name: 'New Pool', participants: 8, status: 'active' });

// Update (invalidates cache automatically)
await this.rpc.pools.update(1, { name: 'Updated Pool' });

// Delete (invalidates cache automatically)
await this.rpc.pools.delete(1);
```

### Caching Behavior

- **Stale-while-revalidate**: Cached responses are served immediately, fresh data fetched in background when stale
- **Query deduplication**: Concurrent identical queries share one RPC call
- **sessionStorage persistence**: Cache survives page refreshes, clears on tab close
- **Default 5-minute TTL**: Configurable via `staleTime`
- **Auto-invalidation**: `create`, `update`, `delete` automatically invalidate all cached queries for that endpoint

```javascript
// First call — fetches from server
await this.rpc.pools.list({ page: 1 });

// Second call within staleTime — returns cached data instantly
await this.rpc.pools.list({ page: 1 });  // { cached: true }

// After staleTime — serves cached data, fetches fresh in background
await this.rpc.pools.list({ page: 1 });  // { cached: true } (background refresh)

// After mutation — cache invalidated, next call fetches fresh
await this.rpc.pools.create({ name: 'New' });
await this.rpc.pools.list({ page: 1 });  // fetches from server
```

### Loading & Error State

```javascript
class PoolsTable extends NofoElement {
  async loadPools() {
    return this.withLoading('pools', async () => {
      const result = await this.rpc.pools.list({ page: this.state.page });
      this.syncResponse({ pools: result.data?.items || [], total: result.data?.total || 0 });
    });
  }

  template() {
    return `
      ${this.loading['pools'] ? '<div class="spinner">Loading...</div>' : ''}
      ${this.error['pools'] ? `<div class="error">${this.error['pools']}</div>` : ''}
      ${this.renderList(this.state.pools, 'pool-row')}
    `;
  }
}
```

### `syncResponse()`

Merges API response data into component state. Only updates keys that exist in `static props`:

```javascript
this.syncResponse({
  pools: data?.items || [],
  total: data?.total || 0,
  page: data?.page,       // auto-syncs to URL if url: true
  perPage: data?.perPage  // auto-syncs to URL if url: true
});
```

---

## URL State Management

Props with `url: true` automatically sync with the browser URL.

```javascript
class PoolsTable extends NofoElement {
  static props = {
    filter: { default: 'all', url: true },
    page: { default: 1, url: true, parse: Number },
    perPage: { default: 10, url: true, parse: Number },
    editingId: null,        // not in URL
    showForm: false,        // not in URL
  };

  onUrlChange() {
    this.loadPools();  // called when URL params change (back/forward navigation)
  }
}
```

**Features:**
- **Initial load**: Reads values from `window.location.search`
- **State changes**: Updates URL via `history.replaceState` (or `pushState` if configured)
- **Back/forward**: `popstate` listener updates state automatically
- **Out-of-bounds handling**: Server can correct page numbers, which sync back to URL

---

## Auto-Observed Attributes

NofoElement automatically observes all attributes defined in `static props`. No need to manually implement `observedAttributes`:

```javascript
class MyComponent extends NofoElement {
  static props = { name: 'Guest', count: 0 };
  
  // attributeChangedCallback is automatically called when name or count changes
  attributeChangedCallback(name, oldVal, newVal) {
    console.log(`${name} changed from ${oldVal} to ${newVal}`);
  }
}
```

---

## Lifecycle Hooks

### Lifecycle Methods

#### `onMount()`

Called after the component is connected and initial render completes:

```javascript
async onMount() {
  console.log('Component mounted!');
}
```

#### `onUnmount()`

Called after the component is disconnected from the DOM:

```javascript
onUnmount() {
  console.log('Component removed!');
}
```

---

## CSS / Styles

### Component Styles

Override `styles()` to add component-specific CSS:

```javascript
class MyCard extends NofoElement {
  template() {
    return `<div class="card">Content</div>`;
  }

  styles() {
    return `
      .card {
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
    `;
  }
}
```

### Global Styles

Set `window.nofoUIStyles` to include global styles in every component:

```javascript
window.nofoUIStyles = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; }
`;
```

---

## Testing & Agentic AI API

Every NofoElement exposes a comprehensive API for testing, debugging, and programmatic control. This enables easy integration with testing frameworks (Playwright, Cypress, Vitest) and agentic AI systems.

### Enabling Test Mode

Test mode exposes additional state, methods, and emits events for testing. Enable it in one of three ways:

```javascript
// Option 1: Class-level (all instances of a component)
import { NofoElement } from 'nomo/nofo';
NofoElement.testMode = true;

// Option 2: Per-instance attribute
<nofo-button test-mode>Click</nofo-button>

// Option 3: Programmatic
element.enableTestMode();
```

### Test ID

Each component automatically gets a test ID for easy querying:

```javascript
element.$testId  // Returns: "nofo_button" (tag name with underscores)

// In test mode, this is set as data-testid attribute
<nofo-button data-testid="nofo_button">Click</nofo-button>
```

### State Exposure (Test Mode Only)

When test mode is enabled, access internal state and props:

```javascript
element.$state   // Returns: { count: 5, loading: false, ... }
element.$props   // Returns: { size: '2', variant: 'solid', disabled: false }
element.$methods // Returns: { increment: fn, decrement: fn, reset: fn, ... }
```

### Programmatic Control

```javascript
element.click()                                    // Trigger click on internal button/focusable
element.focus()                                     // Focus the element
element.blur()                                      // Blur the element
element.setProps({ size: '2', variant: 'solid' }) // Set multiple props
element.query('.my-selector')                       // Query shadow DOM
element.queryAll('button')                          // Query all in shadow DOM

// Wait for condition (useful for async state changes)
await element.waitFor(() => element.state.loading === false, 5000);

// Trigger custom events
element.trigger('custom-event', { detail: { key: 'value' } });
```

### Test Events

Components emit custom events in test mode for assertion:

```javascript
// Listen for lifecycle events
element.addEventListener('nofo-button:mounted', e => {
  console.log(e.detail.testId); // "nofo_button"
});

element.addEventListener('nofo-button:rendered', e => {});
element.addEventListener('nofo-button:unmounted', e => {});

// Listen for interaction events
element.addEventListener('nofo-button:clicked', e => {});
element.addEventListener('nofo-button:focused', e => {});
element.addEventListener('nofo-button:blurred', e => {});

// Listen for state changes
element.addEventListener('nofo-button:attributeChanged', e => {
  console.log(e.detail.attribute, e.detail.oldValue, e.detail.newValue);
});
element.addEventListener('nofo-button:propsSet', e => {});
element.addEventListener('nofo-button:styleChanged', e => {});
element.addEventListener('nofo-button:themeChanged', e => {});
```

---

## Styling API

Programmatic control over component styling for testing and dynamic theming. All methods are **chainable** - they return `this` for fluent API usage.

### CSS Property Access

```javascript
// Single property - get/set
element.css('color')              // Get computed color
element.css('color', 'red')       // Set inline color style
element.css('--my-var', 'blue')   // Set CSS custom property

element.css({
  'color': 'red',
  'background': 'blue',
  '--spacing': '1rem'
});

element.cssVar('accent')         // Get --accent value
element.cssVar('accent', '#f00') // Set --accent variable

element.cssVar({
  'primary': '#007bff',
  'secondary': '#6c757d',
  'spacing': '1rem'
});
```

### CSS Variables

```javascript
// Single variable - get/set (auto-prefixes with --)
element.cssVar('accent')         // Get --accent value
element.cssVar('accent', '#f00') // Set --accent variable

// Batch operations
element.cssVar({
  'primary': '#007bff',
  'secondary': '#6c757d',
  'spacing': '1rem'
});
```

### Theming Helpers

```javascript
element.theme()              // Get all theme variables as object
element.setTheme('dark')    // Set theme attribute
element.toggleTheme()       // Toggle between light/dark
element.colorMode('dark')   // Set color-mode attribute
element.size('2')           // Set size attribute
element.variant('solid')    // Set variant attribute
element.disabled(true)      // Set disabled attribute
element.toggleDisabled()   // Toggle disabled state
element.loading(true)       // Set loading attribute
element.toggleLoading()    // Toggle loading state
```

### State Queries

```javascript
element.is('disabled')      // Check if disabled
element.is('loading')       // Check if loading
element.is('focused')       // Check if focused
element.is('checked')       // Check if checked
element.is('open')          // Check if open
element.is('active')        // Check if active
element.is('hidden')        // Check if hidden
element.is('theme:dark')     // Check if dark theme
element.hasTheme('dark')    // Check current theme
```

### Animation & Transitions

```javascript
element.transition('all 0.3s ease')  // Set transition
element.animate('fade-in')            // Play animation
```

### Responsive Helpers

```javascript
element.breakpoint('md')                      // Set breakpoint
element.mediaQuery('(min-width: 768px)')     // Check media query
```

### Style Inspection

```javascript
element.getStyles()          // Returns detailed style info:
{
  element: 'color: red; padding: 10px;',  // Inline styles
  computed: CSSStyleDeclaration,            // All computed styles
  cssVars: { '--nofo-accent': '#00ff41' }, // CSS variables
  classList: ['active', 'filled'],          // Element classes
  dataset: { variant: 'solid' },            // Data attributes
  states: {                                 // State flags
    disabled: false,
    loading: true,
    focused: false,
    checked: false,
    open: true,
    theme: 'dark'
  }
}
```

### Chaining Example

```javascript
// Fluent API - all methods return `this`
element
  .cssVar({ primary: '#007bff', spacing: '1rem' })
  .colorMode('dark')
  .size('2')
  .variant('solid')
  .disabled(false)
  .transition('all 0.2s ease');
```

### Global Theme System

```javascript
import { setTheme, setNofoTheme, getTheme } from 'nomo/nofo';

// Set custom theme variables
setTheme({
  '--my-brand-color': '#ff0000',
  '--custom-spacing': '1rem'
});

// Use built-in themes
setNofoTheme('light');   // Light theme
setNofoTheme('dark');    // Dark theme  
setNofoTheme('matrix');  // Cyberpunk green
setNofoTheme('neon');    // Neon pink/purple

// Get current theme
const theme = getTheme();
// Returns: { '--nofo-background': '#000', '--nofo-foreground': '#fff', ... }
```

---

## Full Example: Todo App

```javascript
import { NofoElement } from 'nomo/nofo';

class TodoApp extends NofoElement {
  static props = { todos: [] };

  constructor() {
    super();
    this.registerActions({
      addTodo: (text) => this.addTodo(text),
      toggleTodo: (index) => this.toggleTodo(index),
      deleteTodo: (index) => this.deleteTodo(index)
    }, ['todo-item', 'todo-input']);
  }

  template() {
    return `
      <h1>My Todos</h1>
      <todo-input></todo-input>
      <ul class="todo-list">
        ${this.renderList(this.state.todos, 'todo-item')}
      </ul>
    `;
  }

  styles() {
    return `
      .todo-list { list-style: none; padding: 0; }
      .todo-list li { display: flex; align-items: center; gap: 8px; }
      .done span { text-decoration: line-through; opacity: 0.6; }
    `;
  }

  addTodo(text) {
    this.commit('todos', (t) => [...t, { text, done: false }]);
  }

  toggle(index) {
    this.commit('todos', (t) =>
      t.map((item, i) => i === index ? { ...item, done: !item.done } : item)
    );
  }

  delete(index) {
    this.commit('todos', (t) => t.filter((_, i) => i !== index));
  }
}

class TodoInput extends NofoElement {
  template() {
    return `
      <input type="text" placeholder="Add a todo..." />
      <button on-click="submit">Add</button>
    `;
  }

  submit() {
    const input = this.shadowRoot.querySelector('input');
    if (input.value.trim()) {
      const actions = this.inject('actions');
      if (actions?.addTodo) actions.addTodo(input.value);
      input.value = '';
    }
  }
}

customElements.define('todo-app', TodoApp);
customElements.define('todo-input', TodoInput);
```

```html
<todo-app>
  <template slot="todo-item">
    <li class="{{done ? 'done' : ''}}">
      <input type="checkbox" {{done}} on-change="toggle" />
      <span>{{text}}</span>
      <button on-click="delete">×</button>
    </li>
  </template>
</todo-app>
```

---

## API Reference

### Static Properties

| Property | Type | Description |
|----------|------|-------------|
| `props` | `Object` | Property definitions with default values |
| `refs` | `Array` | Template ref names for DOM access |
| `computed` | `Object` | Computed property getters |
| `tracks` | `Array \| null` | State paths to track for re-rendering (null = track all) |
| `rpc` | `Object` | RPC configuration (baseUrl, endpoints, options) |
| `testMode` | `boolean` | Enable test mode for all instances |
| `debug` | `boolean` | Enable debug logging |

### Exported Utilities

| Export | Description |
|--------|-------------|
| `createNofoRpc` | Create RPC client |
| `createStore` | Create reactive signal store |
| `createSignal` | Create a reactive signal |
| `createEffect` | Create a reactive effect |
| `wire` | Create sync wiring |
| `setTheme` | Set CSS custom properties globally |
| `setNofoTheme` | Set built-in theme (light, dark, matrix, neon) |
| `getTheme` | Get current theme variables |

### Composables

| Export | Description |
|--------|-------------|
| `useToggle` | Boolean toggle with setTrue/setFalse |
| `useClickOutside` | Detect outside clicks |
| `useDebounce` | Debounced values |
| `useThrottle` | Throttled values |
| `useMediaQuery` | Responsive queries |
| `BREAKPOINTS` | Common breakpoint queries |
| `useIntersectionObserver` | Visibility tracking |
| `useLocalStorage` | localStorage persistence |
| `useAsync` | Async state management |
| `useClipboard` | Clipboard operations |
| `useMounted` | Mounted state tracking |
| `useTimeout` | Timeout utilities |
| `useInterval` | Interval utilities |

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `Proxy` | Reactive state object |
| `shadowRoot` | `ShadowRoot` | Component's shadow DOM |
| `rpc` | `Object` | RPC API proxy for configured endpoints |
| `rpcClient` | `RpcClient` | Raw RPC client for advanced usage |

### Methods

| Method | Arguments | Description |
|--------|-----------|-------------|
| `sync()` | - | Returns a wiring DSL for attributes/states |
| `effect(fn)` | `fn: () => void/cleanup` | Runs a reactive side effect with auto-cleanup |
| `commit(key, fn)` | `key: string, fn: (value) => value` | Immutable state update |
| `registerActions(actions, tags)` | `actions: Object, tags: string[]` | Register action functions |
| `provide(key, value, tags)` | `key: string, value: any, tags: string[]` | Provide context to descendants |
| `inject(key)` | `key: string` | Request context from ancestors |
| `list(data, callback)` | `data: any[], fn: (item, index) => string` | Inline list rendering |
| `renderList(data, slot, options?)` | `data: any[], slot: string, options?: { branch: { test: fn, slot: string }[] }` | Render list with conditional branching |
| `renderItem(item, slot)` | `item: any, slot: string` | Render single item from blueprint |
| `renderForm(slot, data?)` | `slot: string, data?: object` | Render form blueprint |
| `renderPartial(slot, data?)` | `slot: string, data?: object` | Render any blueprint |
| `hasBlueprint(name)` | `name: string` | Check if blueprint exists |
| `getBlueprint(name)` | `name: string` | Get raw template element |
| `blueprintNames()` | - | List all blueprint names |
| `fetch(endpoint, method, dataOrId, data)` | `string, string, any, any?` | Manual RPC fetch |
| `attr(name, value?)` | `string, any?` | Get/set attribute |
| `has(name)` | `string` | Check attribute presence |
| `query(selector)` | `string` | Query shadow DOM element |
| `queryAll(selector)` | `string` | Query all shadow DOM elements |
| `emit(eventName, detail?)` | `string, object` | Emit custom event with detail |
| `trigger(eventName, detail?)` | `string, object` | Trigger custom event |
| `waitFor(conditionFn, timeout?)` | `fn, number` | Wait for condition to be true |
| `click()` | - | Trigger click on focusable element |
| `focus()` | - | Focus the element |
| `blur()` | - | Blur the element |
| `setProps(props)` | `Object` | Set multiple props |
| `refs` | getter | Returns template ref elements |
| `setRef(name, element)` | `string, Element` | Set a template ref programmatically |
| `template()` | - | Override to return HTML string |
| `styles()` | - | Override to return CSS string |
| `onMount()` | - | Override for post-mount logic |
| `onUnmount()` | - | Override for post-unmount cleanup |
| `attributeChangedCallback(name, oldVal, newVal)` | - | Override for attribute change handling |

### Styling Methods

| Method | Arguments | Description |
|--------|-----------|-------------|
| `css(property, value?)` | `string/object, string?` | Get/set CSS property |
| `cssVar(varName, value?)` | `string/object, string?` | Get/set CSS variable |
| `theme()` | - | Get all theme variables |
| `setTheme(themeName)` | `string` | Set theme attribute |
| `toggleTheme()` | - | Toggle between light/dark theme |
| `colorMode(mode)` | `string` | Set color-mode attribute |
| `size(size)` | `string` | Set size attribute |
| `variant(variant)` | `string` | Set variant attribute |
| `disabled(disabled?)` | `boolean` | Set disabled attribute |
| `toggleDisabled()` | - | Toggle disabled state |
| `loading(loading?)` | `boolean` | Set loading attribute |
| `toggleLoading()` | - | Toggle loading state |
| `is(state)` | `string` | Query element state |
| `hasTheme(themeName)` | `string` | Check if element has theme |
| `transition(css)` | `string` | Set transition CSS |
| `animate(name)` | `string` | Play animation |
| `breakpoint(name)` | `string` | Set breakpoint |
| `mediaQuery(query)` | `string` | Check media query |
| `getStyles()` | - | Get all style information |

### Dev Mode Methods

| Method | Arguments | Description |
|--------|-----------|-------------|
| `log(...args)` | `...any` | Log in debug mode |
| `warn(...args)` | `...any` | Always warn |
| `error(...args)` | `...any` | Always error |
| `inspect()` | - | Get full component state (test mode) |

### Testing & Agentic AI (Use $ Prefix)

| Method | Arguments | Description |
|--------|-----------|-------------|
| `$testId` | getter | Returns data-testid (auto-generated from tag name) |
| `$state` | getter | Returns reactive state (test mode only) |
| `$props` | getter | Returns all props (test mode only) |
| `$methods` | getter | Returns all public methods (test mode only) |
| `enableTestMode(enabled?)` | `boolean` | Enable/disable test mode |

### Static Properties (Testing)

| Property | Type | Description |
|----------|------|-------------|
| `testMode` | `boolean` | When true, enables test mode for all instances |
| `debug` | `boolean` | When true, enables debug logging for all instances |

### Lifecycle

1. **constructor** - Initialize state, props, shadow DOM, internals
2. **connectedCallback** - Register blueprints, trigger first render (via effect), call `onMount()`
3. **Attribute Change** - Auto-observed from props, triggers re-render
4. **State Change** - Signal notifies watcher, queues microtask, calls `render()`
5. **render** - Update shadow DOM, bind events
6. **disconnectedCallback** - Call `onUnmount()`, clear effects

---

## Composables

Nofo provides a set of composable functions for common patterns. These are reusable, standalone utilities that work with the signal system.

### Available Composables

| Composable | Description |
|------------|-------------|
| `useToggle` | Boolean toggle state with setTrue/setFalse |
| `useClickOutside` | Detect clicks outside an element |
| `useDebounce` | Debounced value with cancel/flush |
| `useThrottle` | Throttled value |
| `useMediaQuery` | Responsive queries with BREAKPOINTS |
| `useIntersectionObserver` | Lazy loading/visibility tracking |
| `useLocalStorage` | Persist state to localStorage |
| `useAsync` | Async operations with loading/error/data states |
| `useClipboard` | Copy/paste to clipboard |
| `useMounted` | Track mounted state |
| `useTimeout` | Timeout management |
| `useInterval` | Interval management |

### Usage

```javascript
import { NofoElement, useClickOutside, useTimeout } from 'nomo/nofo';

class MyComponent extends NofoElement {
  #clickCleanup = null;
  #timer = useTimeout();

  onMount() {
    // Use click outside
    this.effect(() => {
      if (this.state.open) {
        const { bind } = useClickOutside();
        this.#clickCleanup = bind(this, () => {
          this.state.open = false;
        });
      }
    });
  }

  onUnmount() {
    if (this.#clickCleanup) this.#clickCleanup();
    this.#timer.clear();
  }
}
```

---

## Template Refs (`$refs`)

Access DOM elements directly using the `ref` attribute:

```javascript
class MyForm extends NofoElement {
  static refs = ['input', 'submit'];

  template() {
    return `
      <input ref="input" type="text" />
      <button ref="submit">Submit</button>
    `;
  }

  onMount() {
    this.$refs.input.focus();
  }

  handleSubmit() {
    const value = this.$refs.input.value;
    this.$refs.submit.disabled = true;
  }
}
```

---

## Computed Properties

Define derived state that automatically updates:

```javascript
class UserCard extends NofoElement {
  static props = { firstName: '', lastName: '' };

  static computed = {
    fullName() {
      return `${this.state.firstName} ${this.state.lastName}`.trim();
    },
    initials() {
      const first = this.state.firstName?.[0] || '';
      const last = this.state.lastName?.[0] || '';
      return `${first}${last}`.toUpperCase();
    }
  };

  template() {
    return `
      <h2>${this.fullName}</h2>
      <span>${this.initials}</span>
    `;
  }
}
```

---

## Dev Mode Helpers

Debug your components with built-in logging and inspection:

```javascript
class MyComponent extends NofoElement {
  static debug = true;  // Enable debug logging

  onMount() {
    this.log('Component mounted with state:', this.state);
    this.warn('This is a warning');
    this.error('This is an error');
  }
}
```

### Available Methods

| Method | Description |
|--------|-------------|
| `log(...args)` | Log in debug mode only |
| `warn(...args)` | Always warn |
| `error(...args)` | Always error |
| `inspect()` | Get full component state (test mode) |

### `inspect()` Output

```javascript
const info = element.inspect();
// Returns:
{
  tag: 'MY-COMPONENT',
  props: { size: '2', variant: 'solid' },
  state: { count: 5, loading: false },
  methods: { increment: fn, reset: fn },
  refs: { input: HTMLInputElement, button: HTMLButtonElement },
  dataset: { variant: 'solid' },
  attributes: [{ name: 'size', value: '2' }],
  testId: 'my_component'
}
```

---

## Cap'n Web RPC Integration

NofoElement includes built-in support for [Cap'n Web](https://github.com/cloudflare/capnweb) - a JSON-based RPC system that works over HTTP or WebSocket with no schema requirements.

### Quick Start

```javascript
import { NofoElement, createNofoRpc } from 'nomo/nofo';

class UserList extends NofoElement {
  static props = { users: [] };
  
  static rpc = {
    baseUrl: '/v1/sf_rpc',
    endpoints: [
      { name: 'accounts', path: '/accounts' },
      { name: 'settings', path: '/settings' }
    ]
  };

  async onMount() {
    const result = await this.rpc.accounts.list();
    if (result.data) {
      this.state.users = result.data;
    }
  }

  template() {
    return `
      <ul>
        ${this.list(this.state.users, user => `
          <li>${user.name}</li>
        `)}
      </ul>
    `;
  }
}

customElements.define('user-list', UserList);
```

### RPC Configuration

Configure RPC at the class level using `static rpc`:

```javascript
static rpc = {
  baseUrl: 'https://api.example.com',
  endpoints: [
    { name: 'users', path: '/users' },
    { name: 'posts', path: '/posts' }
  ],
  options: {
    headers: { 'Authorization': 'Bearer token' },
    timeout: 30000,
    onError: (err) => console.error(err)
  }
};
```

### API Usage

The `this.rpc` object provides a clean API for each endpoint:

```javascript
// Create
const result = await this.rpc.accounts.create({ name: 'Alice', email: 'alice@example.com' });
// Returns: { data: { id: '123', ... }, id: '123', error: null }

// Get by ID
const user = await this.rpc.accounts.get('123');

// List all
const users = await this.rpc.accounts.list();

// Update
const updated = await this.rpc.accounts.update('123', { name: 'Alice Smith' });

// Delete
await this.rpc.accounts.delete('123');
```

### Error Handling

All RPC methods return a graceful response object:

```javascript
const result = await this.rpc.accounts.list();

if (result.error) {
  console.error('Failed to fetch:', result.error);
  return;
}

console.log('Users:', result.data);
```

Response format: `{ data: T | null, id?: string, error: string | null }`

### Batch Operations

For complex operations, use batch queries:

```javascript
const results = await this.rpcClient.batch([
  { endpoint: 'accounts', method: 'list' },
  { endpoint: 'settings', method: 'get', id: 'default' },
  { endpoint: 'accounts', method: 'create', data: { name: 'New' } }
]);
```

### Manual Fetch Pattern

Use the `fetch()` helper for manual control:

```javascript
async loadUser(id) {
  const result = await this.fetch('accounts', 'get', id);
  return result.data;
}
```

---

## Why NofoElement?

- **No build step** — Pure ES modules for a faster dev cycle.
- **Signal-driven** — Ultra-efficient updates without a virtual DOM.
- **Native Power** — Built-in support for `ElementInternals`, Custom States, and Shadow DOM.
- **Lightweight** — Zero heavy dependencies, just the power of the platform.
- **Framework-agnostic** — Works alongside React, Vue, or vanilla JS.

---

## Matrix UI Component Library

Nofo includes a comprehensive library of pre-built UI components organized into two categories:

### System Components

Low-level building blocks (`nofo-button`, `nofo-dialog`, `nofo-input`, etc.):

```javascript
import 'nomo/nofo/components';
```

```html
<nofo-button variant="solid" color="accent" size="2">
  Click me
</nofo-button>

<nofo-dialog open>
  <nofo-heading size="3">Hello</nofo-heading>
  <nofo-text>This is a dialog</nofo-text>
</nofo-dialog>
```

### Library Components

Styled wrappers with theme integration (`nofo-ui-button`, `nofo-ui-dialog`, etc.):

```javascript
import 'nomo/nofo/components';
// or specifically
import 'nomo/nofo/components/library';
```

```html
<nofo-ui-button variant="default" size="md">
  Submit
</nofo-ui-button>

<nofo-ui-card>
  <nofo-ui-card-header>
    <nofo-ui-card-title>Card Title</nofo-ui-card-title>
  </nofo-ui-card-header>
  <nofo-ui-card-content>
    Card content goes here
  </nofo-ui-card-content>
</nofo-ui-card>
```

### Available Components

**System Components:**
- Layout: `nofo-box`, `nofo-flex`, `nofo-grid`, `nofo-stack`, `nofo-container`, `nofo-section`, `nofo-inset`
- Typography: `nofo-heading`, `nofo-text`, `nofo-code`, `nofo-kbd`, `nofo-link`, `nofo-blockquote`, `nofo-quote`
- Forms: `nofo-button`, `nofo-text-field`, `nofo-text-area`, `nofo-checkbox`, `nofo-radio`, `nofo-switch`, `nofo-slider`, `nofo-select`, `nofo-file-input`, `nofo-number-input`
- Feedback: `nofo-alert`, `nofo-toast`, `nofo-progress`, `nofo-skeleton`, `nofo-spinner`, `nofo-loading-overlay`
- Overlay: `nofo-dialog`, `nofo-drawer`, `nofo-popover`, `nofo-tooltip`, `nofo-sheet`
- Navigation: `nofo-tabs`, `nofo-breadcrumbs`, `nofo-pagination`, `nofo-navigation`, `nofo-menu`
- Data: `nofo-table`, `nofo-list`, `nofo-data-list`
- Media: `nofo-avatar`, `nofo-image`, `nofo-carousel`
- Utility: `nofo-divider`, `nofo-separator`, `nofo-visually-hidden`, `nofo-reset`, `nofo-sticky`, `nofo-form`

**Library Components:**
- `nofo-ui-button`, `nofo-ui-input`, `nofo-ui-textarea`, `nofo-ui-checkbox`, `nofo-ui-radio-group`
- `nofo-ui-dialog`, `nofo-ui-drawer`, `nofo-ui-sheet`, `nofo-ui-popover`, `nofo-ui-tooltip`
- `nofo-ui-card`, `nofo-ui-avatar`, `nofo-ui-badge`, `nofo-ui-alert`
- `nofo-ui-tabs`, `nofo-ui-accordion`, `nofo-ui-collapsible`
- `nofo-ui-select`, `nofo-ui-slider`, `nofo-ui-switch`
- `nofo-ui-table`, `nofo-ui-pagination`
- `nofo-ui-form`, `nofo-ui-field`, `nofo-ui-label`
- `nofo-ui-typography` (h1-h4, p, blockquote, code)
- And many more...

### Component Properties

All components use standardized props:

```javascript
// Size variants
size="1" | "2" | "3" | "4"

// Color variants  
color="accent" | "gray" | "red" | "green" | "blue" | "yellow" | "purple"

// Style variants
variant="solid" | "outline" | "ghost" | "soft" | "surface"

// States
disabled
loading
readonly
```

### Creating Custom Components

Use NofoElement to build your own components:

```javascript
import { NofoElement } from 'nomo/nofo';

class MyCard extends NofoElement {
  static props = {
    title: '',
    variant: 'default'
  };

  template() {
    return `
      <div class="card ${this.state.variant}">
        <h2>${this.state.title}</h2>
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      .card {
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid var(--gray-6);
      }
      .card.primary {
        background: var(--accent-3);
        border-color: var(--accent-9);
      }
    `;
  }
}

customElements.define('my-card', MyCard);
```
