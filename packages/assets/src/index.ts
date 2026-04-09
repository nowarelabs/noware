export * from "./vendor";

export interface AssetManifest {
  [key: string]: string;
}

export class AssetPipeline {
  private manifest: AssetManifest | null = null;
  private isProd: boolean;
  public importMap: any = null;

  constructor(
    options: {
      manifest?: AssetManifest;
      isProd?: boolean;
      importMap?: any;
    } = {},
  ) {
    this.manifest = options.manifest || null;
    this.isProd = options.isProd || false;
    this.importMap = options.importMap || null;
  }

  /**
   * Resolves the public path for a given asset.
   */
  path(name: string): string {
    if (this.isProd && this.manifest && this.manifest[name]) {
      return `/${this.manifest[name]}`;
    }
    return `/${name}`;
  }

  /**
   * Generates a <link> tag for a stylesheet.
   */
  stylesheet_link_tag(name: string): string {
    const path = this.path(name);
    return `<link rel="stylesheet" href="${path}">`;
  }

  /**
   * Generates a <script> tag for a javascript file.
   */
  javascript_include_tag(name: string): string {
    const path = this.path(name);
    return `<script src="${path}" type="module"></script>`;
  }

  /**
   * Generates the raw JSON string for the import map.
   */
  import_map_tag(): string {
    if (!this.importMap) return "";
    return JSON.stringify(this.importMap);
  }
}

/**
 * HTMLRewriter handler to inject assets into the head.
 */
export class AssetInjector {
  constructor(
    private pipeline: AssetPipeline,
    private entries: { styles: string[]; scripts: string[] },
  ) {}

  element(element: any) {
    if (element.tagName === "head") {
      for (const style of this.entries.styles) {
        element.append(this.pipeline.stylesheet_link_tag(style), {
          html: true,
        });
      }
      for (const script of this.entries.scripts) {
        element.append(this.pipeline.javascript_include_tag(script), {
          html: true,
        });
      }
    }
  }
}
