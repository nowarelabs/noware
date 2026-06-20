# @nowarelabs/views

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
pnpm add @nowarelabs/views
```

---

## 2. Core Architecture (BaseView & BaseLayout)

### The View (`src/views/welcome.tsx`)

```typescript
import { BaseView, h, Fragment } from "@nowarelabs/views";

interface WelcomeProps {
  name: string;
}

export class WelcomeView extends BaseView<WelcomeProps> {
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
import { BaseLayout, h, Fragment } from "@nowarelabs/views";

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
import { BaseLayout } from "@nowarelabs/views";

const html = BaseLayout.withLayout(ApplicationLayout, WelcomeView, {
  name: "Vance",
});
```

---

## 3. Direct String Rendering

Since JSX calls in this engine return strings, you can use them as simple template functions:

```typescript
const MyComponent = ({ title }: { title: string }) => (
  <header>
    <h1>{title}</h1>
  </header>
);

const html = <MyComponent title="Hello" />;
// html is already a string!
```

---

## 4. Configuration

### tsconfig.json

Add the following to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  }
}
```

### Import in Your Files

```typescript
import { h, Fragment } from "@nowarelabs/views";
```

Or use a JSX pragma comment at the top of each file:

```typescript
/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from "@nowarelabs/views";
```

---

## 5. Features

### Content For / Yield Content Pattern

Views can push content to named regions in layouts:

```typescript
// In View
this.content_for("head", <title>My Page</title>)
this.content_for("head", <meta name="description" content="..." />)

// In Layout
{this.yield_content("head")}
```

### Asset Helpers

Built-in helpers for common asset tags:

```typescript
// Stylesheet
{
  this.stylesheet_link_tag("/assets/app.css");
}
{
  this.stylesheet_link_tag("https://cdn.example.com/normalize.css");
}

// JavaScript
{
  this.javascript_include_tag("/assets/app.js", { defer: true });
}

// Images
{
  this.image_tag("/logo.png", { alt: "Logo", width: "200" });
}
```

### Conditional Rendering

```typescript
{this.props.showGreeting && (
  <p>Welcome back!</p>
)}

{this.props.user ? (
  <div>Hello, {this.props.user.name}</div>
) : (
  <div>Please log in</div>
)}
```

### Lists

```typescript
<ul>
  {this.props.items.map(item => (
    <li key={item.id}>{item.name}</li>
  ))}
</ul>
```

### Fragments

```typescript
const MultiElement = () => (
  <>
    <h1>Title</h1>
    <p>Paragraph</p>
  </>
);
```

### Style Objects

```typescript
<div style={{
  backgroundColor: "blue",
  fontSize: "16px",
  padding: "20px"
}}>
  Styled content
</div>
```

---

## 6. Cloudflare Worker Integration

```typescript
import { BaseLayout, renderView } from "@nowarelabs/views";
import { ApplicationLayout } from "./layouts/application";
import { HomeView } from "./views/home";

interface Env {
  DATABASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const html = BaseLayout.withLayout(
      ApplicationLayout,
      HomeView,
      { title: "Welcome" },
      request as any,
      env as any,
      ctx as any,
    );

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};
```

---

## 7. Advanced Usage

### Custom View Methods

```typescript
class DashboardView extends BaseView<{ revenue: number }> {
  private formatCurrency(amount: number): string {
    return `$${amount.toLocaleString()}`;
  }

  render() {
    return (
      <div class="dashboard">
        <h1>Revenue: {this.formatCurrency(this.props.revenue)}</h1>
      </div>
    );
  }
}
```

### Multiple Content Regions

```typescript
// In Layout
<html>
  <head>
    {this.yield_content("meta")}
    {this.yield_content("styles")}
  </head>
  <body>
    <header>{this.yield_content("header")}</header>
    <aside>{this.yield_content("sidebar")}</aside>
    <main>{this.content}</main>
    <footer>{this.yield_content("footer")}</footer>
    {this.yield_content("scripts")}
  </body>
</html>

// In View
{this.content_for("meta", <meta name="description" content="..." />)}
{this.content_for("styles", <link rel="stylesheet" href="..." />)}
{this.content_for("header", <h1>My Site</h1>)}
{this.content_for("sidebar", <nav>...</nav>)}
{this.content_for("footer", <p>&copy; 2024</p>)}
{this.content_for("scripts", <script src="..." />)}
```

### Render Without Layout

```typescript
import { renderView } from "@nowarelabs/views";

const html = renderView(WelcomeView, { name: "Alice" });
```

---

## 8. API Reference

### BaseView<Props>

Base class for all view components.

**Properties:**

- `props: Props` - Component properties
- `request?: RequestLike` - Current request
- `env?: EnvLike` - Environment variables
- `ctx?: ContextLike` - Execution context

**Methods:**

- `abstract render(): string` - Must be implemented by subclasses
- `content_for(name: string, content: string): string` - Store content for layouts
- `toString(): string` - Render to HTML string

### BaseLayout

Base class for all layout components.

**Properties:**

- `content: string` - Main view content
- `request?: RequestLike` - Current request
- `env?: EnvLike` - Environment variables
- `ctx?: ContextLike` - Execution context

**Methods:**

- `abstract render(): string` - Must be implemented by subclasses
- `yield_content(name: string): string` - Retrieve stored content
- `stylesheet_link_tag(href: string, options?): string` - Generate stylesheet tag
- `javascript_include_tag(src: string, options?): string` - Generate script tag
- `image_tag(src: string, options?): string` - Generate image tag
- `toString(): string` - Render to HTML string

**Static Methods:**

- `withLayout<L, V, P>(LayoutClass, ViewClass, props, request?, env?, ctx?): string` - Render view within layout

### Functions

- `h(tag, props, ...children): string` - JSX factory (createElement)
- `Fragment({ children }): string` - JSX fragment support
- `renderView<V, P>(ViewClass, props, request?, env?, ctx?): string` - Render view without layout
- `stylesheet_link_tag(href, options?): string` - Generate stylesheet tag
- `javascript_include_tag(src, options?): string` - Generate script tag
- `image_tag(src, options?): string` - Generate image tag

---

## 9. Performance

This library is optimized for edge computing:

- **Zero dependencies** - No runtime overhead
- **Direct string concatenation** - Fastest possible rendering
- **No virtual DOM** - No diffing, patching, or reconciliation
- **Minimal memory footprint** - Strings are created and discarded immediately
- **V8-optimized** - Perfect for Cloudflare Workers' V8 isolates

---

## 10. Type Safety

Full TypeScript support with generics:

```typescript
interface UserProps {
  name: string;
  email: string;
}

class UserView extends BaseView<UserProps> {
  render() {
    // TypeScript knows this.props has name and email
    return <div>{this.props.name}</div>;
  }
}

// TypeScript enforces correct props
const html = renderView(UserView, {
  name: "Alice",
  email: "alice@example.com"
});
```

---

## 11. Comparison with Other Solutions

| Feature              | @nowarelabs/views | React SSR | Preact | HTMX |
| -------------------- | ----------------- | --------- | ------ | ---- |
| Zero Dependencies    | ✅                | ❌        | ❌     | ❌   |
| Direct String Output | ✅                | ❌        | ❌     | ❌   |
| No Virtual DOM       | ✅                | ❌        | ❌     | ✅   |
| Edge Optimized       | ✅                | ❌        | ✅     | ❌   |
| Class-Based Views    | ✅                | ❌        | ❌     | N/A  |
| Layout Pattern       | ✅                | ❌        | ❌     | ❌   |

---

## 12. License

MIT

---

## 13. Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## 14. Credits

Created by [Noware Labs](https://github.com/nowarelabs)

Inspired by Ruby on Rails view patterns and modern JSX implementations.
