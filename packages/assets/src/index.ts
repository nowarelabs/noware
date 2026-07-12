import type { EnvLike, AssetContext, RequestLike } from "@nowarelabs/shared";

// Dynamically try to pull the map built by your vendor process
let COMPILED_MAP = { imports: {} as Record<string, string> };
try {
  // @ts-ignore - This file is generated dynamically at build-time
  const module = await import("./importmap.ts");
  if (module?.IMPORT_MAP) COMPILED_MAP = module.IMPORT_MAP;
} catch {
  // Graceful fallback if building from scratch
}

export interface AssetPipelineOptions {
  styles?: string[];
  scripts?: string[];
  publicPrefix?: string;
  vendorPrefix?: string;
  manifest?: Record<string, string>;
  importMap?: Record<string, string>;
}

export interface RuntimeAdapter {
  matchRuntime(): boolean;
  serveStatic(pathname: string, request: Request): Promise<Response | null>;
  injectHTML(response: Response, payloadHtml: string): Response;
}

export class CloudflareAdapter implements RuntimeAdapter {
  constructor(private env: { ASSETS?: Fetcher } & Record<string, any>) {}

  matchRuntime(): boolean {
    return typeof HTMLRewriter !== "undefined" && typeof this.env?.ASSETS?.fetch === "function";
  }

  async serveStatic(pathname: string, request: Request): Promise<Response | null> {
    try {
      const res = await this.env.ASSETS!.fetch(request);
      return res.status === 404 ? null : res;
    } catch {
      return null;
    }
  }

  injectHTML(response: Response, payloadHtml: string): Response {
    return new HTMLRewriter()
      .on("head", {
        element(el: Element) {
          el.append(payloadHtml, { html: true });
        },
      })
      .transform(response);
  }
}

export class BunAdapter implements RuntimeAdapter {
  matchRuntime(): boolean {
    return typeof Bun !== "undefined";
  }

  async serveStatic(pathname: string): Promise<Response | null> {
    const file = Bun.file(`.${pathname}`);
    return (await file.exists()) ? new Response(file) : null;
  }

  injectHTML(response: Response, payloadHtml: string): Response {
    return StreamingTextInjector.transform(response, payloadHtml);
  }
}

export class NodeAdapter implements RuntimeAdapter {
  matchRuntime(): boolean {
    return typeof process !== "undefined" && process.versions?.node !== undefined;
  }

  async serveStatic(pathname: string): Promise<Response | null> {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const localPath = path.join(process.cwd(), pathname);

      if (fs.existsSync(localPath) && !fs.statSync(localPath).isDirectory()) {
        const stream = fs.createReadStream(localPath);
        const contentType = pathname.endsWith(".js") ? "application/javascript" : "text/css";
        return new Response(stream as any, { headers: { "content-type": contentType } });
      }
    } catch {}
    return null;
  }

  injectHTML(response: Response, payloadHtml: string): Response {
    return StreamingTextInjector.transform(response, payloadHtml);
  }
}

export interface AssetChainLink {
  setNext(next: AssetChainLink): AssetChainLink;
  handle(pathname: string, request: Request, adapter: RuntimeAdapter): Promise<Response | null>;
}

export abstract class AbstractAssetChainLink implements AssetChainLink {
  private nextLink: AssetChainLink | null = null;

  setNext(next: AssetChainLink): AssetChainLink {
    this.nextLink = next;
    return next;
  }

  async handle(
    pathname: string,
    request: Request,
    adapter: RuntimeAdapter,
  ): Promise<Response | null> {
    if (this.nextLink) {
      return this.nextLink.handle(pathname, request, adapter);
    }
    return null;
  }
}

export class StaticAssetRouteLink extends AbstractAssetChainLink {
  constructor(
    private publicPrefix: string,
    private vendorPrefix: string,
  ) {
    super();
  }

  private isStaticPath(pathname: string): boolean {
    return (
      pathname.startsWith(this.publicPrefix) ||
      pathname.startsWith(this.vendorPrefix) ||
      pathname.endsWith(".css") ||
      pathname.endsWith(".js") ||
      pathname.endsWith(".js.map")
    );
  }

  override async handle(
    pathname: string,
    request: Request,
    adapter: RuntimeAdapter,
  ): Promise<Response | null> {
    if (this.isStaticPath(pathname)) {
      const assetResponse = await adapter.serveStatic(pathname, request);
      if (assetResponse) return assetResponse;
      return new Response("Asset Not Found", { status: 404 });
    }
    return super.handle(pathname, request, adapter);
  }
}

export class HTMLHtmlInjectionLink extends AbstractAssetChainLink {
  constructor(
    private payloadHtml: string,
    private htmlFallbackOrResponse: Response | string,
  ) {
    super();
  }

  override async handle(
    pathname: string,
    request: Request,
    adapter: RuntimeAdapter,
  ): Promise<Response | null> {
    const originalResponse =
      typeof this.htmlFallbackOrResponse === "string"
        ? new Response(this.htmlFallbackOrResponse, {
            headers: { "content-type": "text/html;charset=UTF-8" },
          })
        : this.htmlFallbackOrResponse;

    return adapter.injectHTML(originalResponse, this.payloadHtml);
  }
}

export class RuntimeAdapterFactory {
  static create(env: EnvLike): RuntimeAdapter {
    const adapters = [new CloudflareAdapter(env), new BunAdapter(), new NodeAdapter()];

    for (const adapter of adapters) {
      if (adapter.matchRuntime()) return adapter;
    }

    return new NodeAdapter();
  }
}

export class BaseAsset<
  Ctx extends AssetContext = AssetContext,
  Env extends EnvLike = EnvLike,
  Request extends RequestLike = RequestLike,
> {
  static beforeHooks: unknown[] = [];
  static afterHooks: unknown[] = [];

  protected options: Required<AssetPipelineOptions>;
  protected adapter: RuntimeAdapter;

  constructor(
    protected request: Request,
    protected env: Env,
    protected ctx: Ctx,
    options: AssetPipelineOptions = {},
  ) {
    this.options = {
      styles: options.styles || [],
      scripts: options.scripts || [],
      publicPrefix: options.publicPrefix || "/assets/",
      vendorPrefix: options.vendorPrefix || "/assets/vendor/",
      manifest: options.manifest || {},
      importMap: options.importMap || COMPILED_MAP.imports,
    };

    this.adapter = RuntimeAdapterFactory.create(this.env);
  }

  async handle(htmlFallbackOrResponse: Response | string): Promise<Response> {
    const url = new URL((this.request as any).url);
    const payloadHtml = this.generateInjectionString();

    const staticAssetLink = new StaticAssetRouteLink(
      this.options.publicPrefix,
      this.options.vendorPrefix,
    );
    const htmlInjectionLink = new HTMLHtmlInjectionLink(payloadHtml, htmlFallbackOrResponse);

    staticAssetLink.setNext(htmlInjectionLink);

    const response = await staticAssetLink.handle(url.pathname, this.request as any, this.adapter);

    return response || new Response("Internal Execution Failure", { status: 500 });
  }

  protected resolveAssetPath(name: string): string {
    const manifest = this.options.manifest;
    if (manifest && manifest[name]) {
      return `/${manifest[name]}`;
    }
    return `/${name}`;
  }

  private generateInjectionString(): string {
    let tags = "";

    for (const style of this.options.styles) {
      tags += `<link rel="stylesheet" href="${this.resolveAssetPath(style)}">\n`;
    }

    const activeMap = this.options.importMap;
    tags += `<script type="importmap">${JSON.stringify({ imports: activeMap })}</script>\n`;

    for (const script of this.options.scripts) {
      tags += `<script src="${this.resolveAssetPath(script)}" type="module"></script>\n`;
    }
    return tags;
  }
}

class StreamingTextInjector {
  static transform(response: Response, payloadHtml: string): Response {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    (async () => {
      let headFound = false;
      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          let chunk = decoder.decode(value, { stream: true });
          if (!headFound && chunk.includes("</head>")) {
            chunk = chunk.replace("</head>", `${payloadHtml}\n</head>`);
            headFound = true;
          }
          await writer.write(encoder.encode(chunk));
        }
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, response);
  }
}
