# nomo/views

The ultimate, **zero-dependency** direct JSX-to-String engine for Cloudflare Workers (Edge).

## Philosophy: Radical Minimalism

This engine does away with intermediate VNode structures, DOM diffing, and complex patching mechanisms. It leverages JSX as a high-performance template literal system, rendering directly to HTML strings from your class-based components.

- **Zero VNodes**: JSX renders directly to strings. No tree traversal, no memory overhead.
- **Structured Architecture**: Definitive `BaseView` and `BaseLayout` patterns.
- **Optimized for Edge**: Native performance with zero runtime boilerplate.
- **Type-Safe**: Full TSX support with standard JSX transforms.

---

## 1. Installation

```bash
pnpm add nomo/views
```

---

## 2. Core Architecture (BaseView & BaseLayout)

### The View (`src/views/welcome.tsx`)

```typescript
import { BaseView } from "nomo/views";

export class WelcomeView extends BaseView<{ name: string }> {
  render() {
    return (
      <div class="welcome">
        <h1>Welcome, {this.props.name}!</h1>
        {this.content_for("head", <title>Direct String SSR</title>)}
      </div>
    );
  }
}
```

### The Layout (`src/layouts/application.tsx`)

```typescript
import { BaseLayout } from "nomo/views";

export class ApplicationLayout extends BaseLayout {
  render() {
    return (
      <html lang="en">
        <head>
          {this.yield_content("head")}
          {this.stylesheet_link_tag("app.css")}
        </head>
        <body>
          <main>{this.content}</main>
        </body>
      </html>
    );
  }
}
```

### Rendering

```typescript
import { BaseLayout } from "nomo/views";

const html = BaseLayout.withLayout(ApplicationLayout, WelcomeView, {
  name: "Vance",
});
```

---

## 3. Direct String Rendering

Since JSX calls in this engine return strings, you can use them as simple template functions:

```typescript
const MyComponent = ({ title }) => (
  <header>
    <h1>{title}</h1>
  </header>
);

const html = <MyComponent title="Hello" />;
// html is already a string!
```

---

## 4. Nofo Web Components Integration

nomo Views are designed to work seamlessly with **Nofo Web Components**. Since every component renders to a string, it's perfect for custom elements with shadow DOM.

### Nofo Web Components

You can use Nofo custom elements directly in your views. They are loaded via the import map and provide reactive state management using the Signal Polyfill.

```typescript
import { NofoElement } from "nomo/nofo";
```

### Custom Elements

Use Nofo custom elements for interactive UI components:

```typescript
export class UserProfile extends BaseView {
  render() {
    return (
      <div class="profile">
        <user-profile name={this.props.name} bio={this.props.bio}></user-profile>
      </div>
    );
  }
}
```

### Declarative Attributes

Nofo elements work with standard HTML attributes. The framework handles reactivity through signals:

```typescript
export class UserProfile extends BaseView {
  render() {
    return (
      <div class="profile">
        <profile-card
          name={this.props.name}
          editable="true"
        >
          <button slot="actions">Edit</button>
        </profile-card>
      </div>
    );
  }
}
```

---

## 5. Class-Based Components

You can use `BaseView` or `BaseElement` classes directly as tags in your JSX. The engine automatically handles instantiation and context propagation (registry/assets).

```typescript
// Define a reusable class component
class UserBadge extends BaseView<{ name: string }> {
  render() {
    return <span class="badge">{this.props.name}</span>;
  }
}

// Use it directly in JSX
const html = <UserBadge name="Vance" />;
```

### BaseElement (Full-Stack Web Components)

`BaseElement` is a specialized class for building Web Components with SSR. It automatically wraps your output in its assigned `static tag`.

```typescript
import { BaseElement } from "nomo/views";

export class CounterElement extends BaseElement<{ count: number }> {
  static tag = "my-counter";

  renderElement() {
    return (
      <div data-controller="counter">
        <button data-action="click->counter#decrement">-</button>
        <span data-counter-target="count">{this.props.count}</span>
        <button data-action="click->counter#increment">+</button>
      </div>
    );
  }
}

// Renders as: <my-counter count="5">...</my-counter>
const html = <CounterElement count={5} />;
```

---

## 6. Web Components Synergy (The Main Use Case)

The primary goal of nomo is the synergy between **Capnweb** (Web Components & RPC), **Hotwired** (Fast SSR Navigation), and **BaseView** (JSX SSR).

### The Pattern

1.  **Define** your logic-heavy UI as a Web Component using `capnweb`.
2.  **Provide** an initial SSR state in `BaseView` using `custom_element`.
3.  **Enhance** the experience with `hotwired` for fragment updates and page transitions.

### Example: Real-time Status Badge

**1. The Component (`status-badge.ts`)**

```typescript
import { BaseElement, safeCss } from "nomo/views";

class StatusBadge extends BaseElement {
  static tag = "status-badge";

  // Browser-side logic
  connectedRpc() {
    this.startUpdateLoop(async () => {
      const data = await this.rpc.get("/api/status");
      this.applyProps({ status: data.status });
    }, 5000);
  }

  // Initial SSR state + Browser render
  renderElement() {
    const status = this.props.status || "unknown";
    // CSS variables are automatically sync'd:
    // this.props.color becomes var(--color) in CSS
    return this.html`
      <style>
        :host { display: inline-block; }
        span { color: var(--color, gray); font-weight: bold; }
      </style>
      <span>${status.toUpperCase()}</span>
    `;
  }
}
```

### Advanced Features

`BaseElement` provides a bridge between SSR and standard Web APIs:

- **Reactive Attributes**: Add `static get observedAttributes() { return ['status', 'color']; }` to have attribute changes automatically update `this.props` and re-render.
- **CSS Variable Sync**: Every prop is automatically exposed as a CSS variable (e.g., `props.themeColor` becomes `--theme-color`).
- **DOM Parity**: Methods like `setAttribute`, `getAttribute`, and `hasAttribute` work in both SSR (updating the initial shell) and the Browser.
- **Direct Manipulation**: Standard methods like `removeChild` and `insertBefore` are available for fine-grained control when tagged literals aren't enough.

**2. The View (`welcome.tsx`)**

```typescript
export class WelcomeView extends BaseView {
  render() {
    return (
      <div>
        {/* custom_element supports Declarative Shadow DOM for no-flicker SSR */}
        {this.custom_element("status-badge", { status: "checking" }, (
          <span class="loading">Initializing...</span>
        ), { shadow: true })}
      </div>
    );
  }
}
```

**3. The Orchestration**

- The `status-badge` element is instantly visible via Declarative Shadow DOM.
- **Capnweb** upgrades the element and starts the RPC loop.
- Signals handle reactive updates without a virtual DOM.

---

## 7. Asset & Content Rails

- `content_for(name, content)`: Push strings (metadata, scripts) from deep inside views.
- `yield_content(name)`: Pull strings into layouts.
- `stylesheet_link_tag(name)`: Render an optimized CSS link.
- `javascript_include_tag(name)`: Render a module script tag.
- `custom_element(tag, attrs, children, options)`: Render a Web Component with DSD support.

---

## 8. Import Maps

The `import_map_tag()` helper generates a `<script type="importmap">` tag for modern browser-based module resolution.

### Basic Usage (Layout)

In your layout's `<head>`, call `this.import_map_tag()` to include the default import map:

```tsx
export class ApplicationLayout extends BaseLayout {
  render() {
    return (
      <html>
        <head>{this.import_map_tag()}</head>
        {/* ... */}
      </html>
    );
  }
}
```

### Customization (View)

Individual views can override or extend the import map by passing an object to `import_map_tag`. This is useful for adding view-specific dependencies:

```tsx
export class TournamentListView extends BaseView {
  render() {
    return (
      <div>
        {this.content_for(
          "head",
          <>
            {this.import_map_tag({
              imports: {
                ...(this.a?.importMap?.imports || {}),
                "nomo/nofo": "/assets/vendor/nomo/nofo.js",
              },
            })}
          </>,
        )}
        {/* ... */}
      </div>
    );
  }
}
```

### Default Imports

By default, the following mappings are included:

- `capnweb`: `/assets/vendor/capnweb.js`
- `signal-polyfill`: `/assets/vendor/signal-polyfill.js`
- `nomo/nofo`: `/assets/vendor/nomo/nofo.js`

---

## 9. Why no tags/svg modules?

In a direct string-rendering JSX system, standard HTML and SVG elements are natively supported via JSX. Redundant functional helpers (`div()`, `svg()`) add unnecessary weight to the package without providing any benefit over standard JSX.

---

## License

MIT
