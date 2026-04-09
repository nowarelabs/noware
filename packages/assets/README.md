# nomo/assets

Advanced asset pipeline for nomo applications.

## Features

- **Environment-Aware Resolution**: Automatically handles different paths for development and production.
- **Manifest Support**: Resolves fingerprinted assets from a `manifest.json`.
- **HTML Helpers**: Built-in helpers for stylesheets, scripts, and images.
- **HTMLRewriter Integration**: Specialized `AssetInjector` for zero-latency asset injection into response streams.

## Usage

### Basic Path Resolution

```typescript
import { AssetPipeline } from "nomo/assets";

const assets = new AssetPipeline({
  manifest: { "application.css": "application-abc123.css" },
  isProd: true,
});

assets.path("application.css"); // "/application-abc123.css"
```

### HTML Helpers

```typescript
assets.stylesheet_link_tag("application.css");
// <link rel="stylesheet" href="/application.css">

assets.javascript_include_tag("main.js");
// <script src="/main.js" type="module"></script>

assets.image_tag("logo.png", { alt: "Logo", className: "h-8" });
// <img src="/logo.png" alt="Logo" class="h-8" />
```

### HTMLRewriter Injection

```typescript
import { AssetInjector } from "nomo/assets";

const injector = new AssetInjector(assets, {
  styles: ["application.css"],
  scripts: ["main.js"],
});

return new HTMLRewriter().on("head", injector).transform(response);
```
