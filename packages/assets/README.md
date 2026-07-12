# @nowarelabs/assets

An enterprise-grade, isomorphic asset delivery pipeline and streaming HTML tag injection framework following the Standard Gauge pattern for `@nowarelabs` applications.

**Execution Flow:** `BaseAsset → RuntimeAdapterFactory → RuntimeAdapter → AssetChainLink (Chain of Responsibility)`

## Features

- **Zero Global Leaks** - Abstracted behind polymorphic Web-Standard APIs (`Request`, `Response`, `TransformStream`).
- **Isomorphic Runtime Switching** - Seamless runtime sniffing supporting Cloudflare Workers, Node.js, Bun, and Deno concurrently using the **Adapter** and **Factory** patterns.
- **Modularity via Chain of Responsibility** - Decoupled behavioral pipelines for handling routing, fallback resolution, and injection independently.
- **On-The-Fly HTML Streaming** - Native ultra-fast `HTMLRewriter` parsing on Cloudflare, with automatic thread-safe fallback to memory-efficient asynchronous `TransformStream` decoders on Standalone JS environments.
- **Production Asset Manifest Support** - Seamless path transformation for hashed and fingerprinted assets (e.g., `main.css` to `main.a8f3b2.css`).
- **Automated Monorepo-Aware Vendoring** - Accompanying build-time CLI engine that resolves package exports natively from `node_modules` (including complex nested layout or `pnpm` monorepo storage layouts).

## Installation

```bash
npm install @nowarelabs/assets
```

## Quick Start

### 1. Build-Time Vendoring (`package.json`)

Configure your application dependencies to vendor assets out of `node_modules` directly into your static public build directory by updating your layout options:

```json
{
  "name": "my-nowarelabs-app",
  "vendorAssets": ["htmx.org", "lodash-es"],
  "scripts": {
    "build:assets": "noware-vendor"
  }
}
```

Running your script commands copies raw ESM distribution streams into your public directory and automatically generates a matching browser-compliant `importmap.ts` next to your runtime engine source code.

### 2. Isomorphic Integration (`src/index.ts`)

Instantiate the `BaseAsset` pipeline class inside any web routing engine or global server entrance loop. It abstracts all environments without exposing platform internals.

```typescript
import { BaseAsset } from "@nowarelabs/assets";
import type { ContextLike, EnvLike, RequestLike } from "@nowarelabs/shared";

export default {
  async fetch(request: Request, env: EnvLike, ctx: ContextLike): Promise<Response> {
    // 1. Initialize our polymorphic asset engine
    const pipeline = new BaseAsset(request, env, ctx, {
      styles: ["assets/css/main.css"],
      scripts: ["assets/js/app.js"],
      manifest: {
        "assets/css/main.css": "assets/css/main.a8f3b2.css",
      },
    });

    // 2. Supply your raw template layout or stream target response
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Nowarelabs Isomorphic App</title>
        </head>
        <body>
          <div id="root">Hello World</div>
        </body>
      </html>
    `;

    // 3. Chain handling routes static asset files or transparently injects tags into the HTML head
    return await pipeline.handle(htmlTemplate);
  },
};
```

## Architectural Deep Dive

The architecture uses object-oriented design patterns to completely insulate your code from runtime quirks:

### The Adapter Pattern

All infrastructure tasks (reading local file systems, proxying cloud bindings, executing target mutations) are mapped down onto the single `RuntimeAdapter` blueprint:

```typescript
export interface RuntimeAdapter {
  matchRuntime(): boolean;
  serveStatic(pathname: string, request: Request): Promise<Response | null>;
  injectHTML(response: Response, payloadHtml: string): Response;
}
```

- **`CloudflareAdapter`**: Intercepts paths via native `env.ASSETS.fetch` bindings and invokes hardware-accelerated C++ `HTMLRewriter` targets.
- **`BunAdapter`**: Queries file validity instantly using fast asynchronous `Bun.file()` macros.
- **`NodeAdapter`**: Fallback architecture spinning up streaming file structures using non-blocking chunks arrays.

### The Chain of Responsibility Pattern

Processing paths do not run inside massive sequential loops. Requests are passed sequentially down concrete decoupled behavioral links:

```
Request ──► [ StaticAssetRouteLink ] ──(If NotFound / NotStatic)──► [ HTMLHtmlInjectionLink ] ──► Final Response
```

## Configuration Options

When extending or calling `BaseAsset`, passing the following generic setup controls options parameters:

| Property       | Type                     | Default             | Description                                                            |
| -------------- | ------------------------ | ------------------- | ---------------------------------------------------------------------- |
| `styles`       | `string[]`               | `[]`                | List of target CSS files to include as explicit link elements.         |
| `scripts`      | `string[]`               | `[]`                | Primary client JavaScript module paths to append into the head.        |
| `publicPrefix` | `string`                 | `"/assets/"`        | Path indicator prefix identifying static app files.                    |
| `vendorPrefix` | `string`                 | `"/assets/vendor/"` | Path indicator prefix identifying localized vendors.                   |
| `manifest`     | `Record<string, string>` | `{}`                | Hashed dictionary map pairing raw assets to compiled production paths. |
| `importMap`    | `Record<string, string>` | _Compiled Map_      | Browser-side bare module path mappings overrides.                      |

## TypeScript Global Configuration

To ensure cross-runtime types like Cloudflare's `Fetcher` and `Bun` are fully acknowledged by your editor while maintaining environment abstraction, ensure your `tsconfig.json` parameters look like this:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node", "bun", "@cloudflare/workers-types"],
    "skipLibCheck": true
  }
}
```

## API Reference

### `BaseAsset`

| Method                                    | Return Type         | Description                                                               |
| ----------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `constructor(request, env, ctx, options)` | `BaseAsset`         | Prepares the framework engine and isolates active runtime.                |
| `handle(htmlFallbackOrResponse)`          | `Promise<Response>` | Processes static routes immediately, or intercept/stream HTML injections. |
| `resolveAssetPath(name)`                  | `string`            | Queries internal manifest instances to match cache-busted path mappings.  |

### `RuntimeAdapterFactory`

| Method               | Return Type      | Description                                                         |
| -------------------- | ---------------- | ------------------------------------------------------------------- |
| `static create(env)` | `RuntimeAdapter` | Scans global bindings dynamically to instantiate matching adapters. |

### `VendorManager` (Build Step)

| Method                 | Return Type     | Description                                                   |
| ---------------------- | --------------- | ------------------------------------------------------------- |
| `constructor(options)` | `VendorManager` | Builds compilation contexts target layouts.                   |
| `vendor()`             | `Promise<void>` | Mirror distributes source trees and registers `importmap.ts`. |

## Development

```bash
# Install dependencies
vp install

# Run build-time assets unit verification tests
vp test

# Compile production distributions
vp pack
```

## Examples

### Basic Usage with Custom Styles and Scripts

```typescript
import { BaseAsset } from "@nowarelabs/assets";
import type { ContextLike, EnvLike, RequestLike } from "@nowarelabs/shared";

export default {
  async fetch(request: Request, env: EnvLike, ctx: ContextLike): Promise<Response> {
    const pipeline = new BaseAsset(request, env, ctx, {
      styles: ["css/bootstrap.min.css", "css/site.css"],
      scripts: ["js/jquery.min.js", "js/bootstrap.bundle.min.js", "js/app.js"],
      publicPrefix: "/assets/",
      vendorPrefix: "/assets/vendor/",
      manifest: {
        "css/bootstrap.min.css": "css/bootstrap.min.a1b2c3.css",
        "js/app.js": "js/app.d4e5f6.js",
      },
    });

    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>My Application</title>
        </head>
        <body>
          <div id="app">
            <h1>Welcome to My Application</h1>
          </div>
        </body>
      </html>
    `;

    return await pipeline.handle(htmlTemplate);
  },
};
```

### Using with Different Runtimes

The asset pipeline automatically detects and adapts to different JavaScript runtimes:

- **Cloudflare Workers**: Uses `HTMLRewriter` for zero-copy HTML transformation
- **Bun**: Uses native `Bun.file()` for fast file system access
- **Node.js**: Uses streaming file reads for efficient asset serving
- **Deno**: Falls back to NodeAdapter (with proper polyfills)

### Advanced Manifest Configuration

For production builds with cache-busting:

```typescript
const pipeline = new BaseAsset(request, env, ctx, {
  styles: ["css/main.css"],
  scripts: ["js/app.js"],
  manifest: {
    "css/main.css": "css/main.abc123def456.css",
    "js/app.js": "js/app.abc123def456.js",
    "images/logo.png": "images/logo.abc123def456.png",
  },
});
```

### Custom Import Map Overrides

Override automatic import map generation:

```typescript
const pipeline = new BaseAsset(request, env, ctx, {
  styles: ["css/main.css"],
  scripts: ["js/app.js"],
  importMap: {
    lodash: "/assets/vendor/lodash-es/lodash.js",
    axios: "/assets/vendor/axios/dist/axios.esm.js",
  },
});
```

## License

MIT - See LICENSE file for details.
