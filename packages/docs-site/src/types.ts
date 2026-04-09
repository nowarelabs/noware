export interface Env {
  ASSETS: R2Bucket;
}

export interface DocsPage {
  slug: string;
  title: string;
  content: string;
  category: "guide" | "api" | "package" | "example";
  order: number;
}
