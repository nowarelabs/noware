import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

function secret(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

async function braveSearch(env: Env, query: string, limit: number): Promise<SearchResult[]> {
  const key = secret(env, "BRAVE_API_KEY");
  if (!key) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(limit));
  const res = await fetch(url, {
    headers: { "X-Subscription-Token": key, Accept: "application/json" },
  });
  if (!res.ok)
    throw new Error(`Brave Search API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  return (data.web?.results ?? []).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.description ?? "",
  }));
}

async function tavilySearch(env: Env, query: string, limit: number): Promise<SearchResult[]> {
  const key = secret(env, "TAVILY_API_KEY");
  if (!key) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query, max_results: limit }),
  });
  if (!res.ok) throw new Error(`Tavily API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  return (data.results ?? []).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.content ?? "",
  }));
}

async function serpSearch(env: Env, query: string, limit: number): Promise<SearchResult[]> {
  const key = secret(env, "SERP_API_KEY");
  if (!key) return [];
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("engine", "google");
  url.searchParams.set("api_key", key);
  url.searchParams.set("num", String(limit));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  return (data.organic_results ?? []).map((r: any) => ({
    title: r.title,
    url: r.link,
    description: r.snippet ?? "",
  }));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export class WebSearchTool extends WorkerEntrypoint<Env> {
  async search(input: { query: string; limit?: number }): Promise<unknown> {
    const limit = input.limit ?? 8;
    if (secret(this.env, "BRAVE_API_KEY")) {
      return {
        provider: "brave",
        query: input.query,
        results: await braveSearch(this.env, input.query, limit),
      };
    }
    if (secret(this.env, "TAVILY_API_KEY")) {
      return {
        provider: "tavily",
        query: input.query,
        results: await tavilySearch(this.env, input.query, limit),
      };
    }
    if (secret(this.env, "SERP_API_KEY")) {
      return {
        provider: "serpapi",
        query: input.query,
        results: await serpSearch(this.env, input.query, limit),
      };
    }
    throw new Error(
      "no search provider configured (set BRAVE_API_KEY, TAVILY_API_KEY, or SERP_API_KEY)",
    );
  }

  async fetchPage(input: { url: string }): Promise<{ content: string }> {
    const res = await fetch(input.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; flax-web-search/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`fetch ${input.url} returned HTTP ${res.status}`);
    const html = await res.text();
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    const title = titleMatch ? titleMatch[1].trim() : input.url;
    return { content: `# ${title}\n\n${stripHtml(html).slice(0, 8000)}` };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
