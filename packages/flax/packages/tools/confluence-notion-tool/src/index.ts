import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

function secret(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function requireSecret(env: Env, key: string): string {
  const v = secret(env, key);
  if (!v) throw new Error(`${key} binding is not configured on this worker`);
  return v;
}

type Provider = "notion" | "confluence" | "memory";

function provider(env: Env): Provider {
  if (secret(env, "NOTION_TOKEN")) return "notion";
  if (secret(env, "CONFLUENCE_BASE_URL")) return "confluence";
  return "memory";
}

async function notionFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecret(env, "NOTION_TOKEN")}`,
      "Notion-Version": secret(env, "NOTION_VERSION") ?? "2022-06-28",
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Notion API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function bodyToBlocks(body?: string): unknown[] {
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 100)
    .map((line) => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: line.slice(0, 1900) } }] },
    }));
}

function confluenceHeaders(env: Env): Record<string, string> {
  const token = secret(env, "CONFLUENCE_API_TOKEN") ?? secret(env, "CONFLUENCE_TOKEN") ?? "";
  const email = secret(env, "CONFLUENCE_EMAIL");
  const base = { "Content-Type": "application/json", Accept: "application/json" };
  if (email && token) return { ...base, Authorization: `Basic ${btoa(`${email}:${token}`)}` };
  if (token) return { ...base, Authorization: `Bearer ${token}` };
  throw new Error(
    "CONFLUENCE_API_TOKEN (or CONFLUENCE_TOKEN) binding is not configured on this worker",
  );
}

async function confluenceFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const base = requireSecret(env, "CONFLUENCE_BASE_URL").replace(/\/$/, "");
  const res = await fetch(`${base}/rest/api/v2${path}`, {
    ...init,
    headers: { ...confluenceHeaders(env), ...((init.headers as Record<string, string>) ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Confluence API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function confluenceSpaceId(env: Env, key: string): Promise<string> {
  const res = await confluenceFetch(env, `/spaces?key=${encodeURIComponent(key)}`);
  const space = res.results?.[0];
  if (!space) throw new Error(`Confluence space "${key}" not found`);
  return space.id;
}

const memoryPages = new Map<
  string,
  { id: string; space: string; title: string; body?: string; parentId?: string }
>();
let memoryCounter = 0;

export class ConfluenceNotionTool extends WorkerEntrypoint<Env> {
  async createPage(input: {
    space: string;
    title: string;
    body?: string;
    parentId?: string;
  }): Promise<{ pageId: string }> {
    const p = provider(this.env);

    if (p === "notion") {
      const res = await notionFetch(this.env, "/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: input.parentId
            ? { type: "page_id", page_id: input.parentId }
            : { type: "workspace" },
          properties: { title: { title: [{ text: { content: input.title } }] } },
          children: bodyToBlocks(input.body),
        }),
      });
      return { pageId: res.id };
    }

    if (p === "confluence") {
      const spaceId = await confluenceSpaceId(this.env, input.space);
      const res = await confluenceFetch(this.env, "/pages", {
        method: "POST",
        body: JSON.stringify({
          spaceId,
          parentId: input.parentId,
          title: input.title,
          body: { representation: "storage", value: input.body ?? `<p>${input.title}</p>` },
        }),
      });
      return { pageId: res.id };
    }

    const id = `page-${++memoryCounter}`;
    memoryPages.set(id, {
      id,
      space: input.space,
      title: input.title,
      body: input.body,
      parentId: input.parentId,
    });
    return { pageId: id };
  }

  async updatePage(input: {
    pageId: string;
    title?: string;
    body?: string;
  }): Promise<{ pageId: string }> {
    const p = provider(this.env);

    if (p === "notion") {
      if (input.title) {
        await notionFetch(this.env, `/pages/${input.pageId}`, {
          method: "PATCH",
          body: JSON.stringify({
            properties: { title: { title: [{ text: { content: input.title } }] } },
          }),
        });
      }
      if (input.body) {
        await notionFetch(this.env, `/blocks/${input.pageId}/children`, {
          method: "PATCH",
          body: JSON.stringify({ children: bodyToBlocks(input.body) }),
        });
      }
      return { pageId: input.pageId };
    }

    if (p === "confluence") {
      const current = await confluenceFetch(this.env, `/pages/${input.pageId}`);
      const version = (current.version?.number ?? 0) + 1;
      await confluenceFetch(this.env, `/pages/${input.pageId}`, {
        method: "PUT",
        body: JSON.stringify({
          id: input.pageId,
          title: input.title ?? current.title,
          body: input.body ? { representation: "storage", value: input.body } : current.body,
          version: { number: version },
        }),
      });
      return { pageId: input.pageId };
    }

    const page = memoryPages.get(input.pageId);
    if (!page) throw new Error(`page ${input.pageId} not found`);
    if (input.title) page.title = input.title;
    if (input.body) page.body = input.body;
    return { pageId: input.pageId };
  }

  async searchPages(input: { query: string; space?: string; limit?: number }): Promise<unknown> {
    const p = provider(this.env);
    const limit = input.limit ?? 25;

    if (p === "notion") {
      const res = await notionFetch(this.env, "/search", {
        method: "POST",
        body: JSON.stringify({
          query: input.query,
          filter: { value: "page", property: "object" },
          page_size: limit,
        }),
      });
      return (res.results ?? []).map((r: any) => ({
        pageId: r.id,
        title: r.properties?.title?.title?.[0]?.plain_text ?? null,
        url: r.url ?? null,
      }));
    }

    if (p === "confluence") {
      const cql =
        `text ~ "${input.query.replace(/"/g, '\\"')}"` +
        (input.space ? ` AND space = "${input.space}"` : "");
      const res = await confluenceFetch(
        this.env,
        `/search?cql=${encodeURIComponent(cql)}&limit=${limit}`,
      );
      return (res.results ?? []).map((r: any) => ({
        pageId: r.id,
        title: r.title,
        url: r._links?.webui ?? null,
      }));
    }

    return [...memoryPages.values()]
      .filter(
        (page) =>
          (!input.space || page.space === input.space) &&
          page.title.toLowerCase().includes(input.query.toLowerCase()),
      )
      .slice(0, limit)
      .map((page) => ({ pageId: page.id, title: page.title }));
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
