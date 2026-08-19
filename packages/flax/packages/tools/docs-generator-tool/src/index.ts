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

async function ghFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${requireSecret(env, "GITHUB_TOKEN")}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readRepoFile(env: Env, repo: string, path: string, ref?: string): Promise<string | null> {
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  try {
    const res = await ghFetch(env, `/repos/${repo}/contents/${path}${suffix}`);
    if (!res || typeof res.content !== "string") return null;
    return atob(res.content);
  } catch {
    return null;
  }
}

interface Operation {
  method: string;
  summary?: string;
  operationId?: string;
  description?: string;
}

interface PathDoc {
  path: string;
  operations: Operation[];
}

interface SpecDoc {
  title: string;
  version: string;
  description?: string;
  paths: PathDoc[];
}

const METHOD_RE = /^(get|post|put|patch|delete|head|options)$/i;

function specFromJson(spec: any): SpecDoc {
  const info = spec.info ?? {};
  const paths: PathDoc[] = Object.entries((spec.paths ?? {}) as Record<string, any>).map(([path, ops]) => ({
    path,
    operations: Object.entries((ops ?? {}) as Record<string, any>)
      .filter(([method]) => METHOD_RE.test(method))
      .map(([method, op]) => ({
        method: method.toUpperCase(),
        summary: op.summary,
        operationId: op.operationId,
        description: op.description,
      })),
  }));
  return { title: info.title ?? "API", version: String(info.version ?? "unknown"), description: info.description, paths };
}

function specFromYaml(text: string): SpecDoc {
  const paths: PathDoc[] = [];
  let current: PathDoc | null = null;
  const info: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const noIndent = line.replace(/^\s+/, "");
    const pathMatch = /^(\/[^:]+):\s*$/.exec(noIndent);
    const methodMatch = /^(get|post|put|patch|delete|head|options):\s*$/.exec(noIndent);
    const propMatch = /^(summary|description|operationId):\s*(.*)$/.exec(noIndent);
    const indent = line.length - line.trimStart().length;

    if (pathMatch && indent === 2) {
      current = { path: pathMatch[1], operations: [] };
      paths.push(current);
    } else if (current && methodMatch && indent === 4) {
      current.operations.push({ method: methodMatch[1].toUpperCase() });
    } else if (current && current.operations.length > 0 && propMatch && indent === 6) {
      const op = current.operations[current.operations.length - 1];
      const value = propMatch[2].replace(/^["']|["']$/g, "");
      if (propMatch[1] === "summary") op.summary = value;
      else if (propMatch[1] === "operationId") op.operationId = value;
      else if (propMatch[1] === "description") op.description = value;
    } else if (indent === 0) {
      const titleMatch = /^title:\s*(.*)$/.exec(noIndent);
      const versionMatch = /^version:\s*(.*)$/.exec(noIndent);
      if (titleMatch) info.title = titleMatch[1].replace(/["']/g, "");
      if (versionMatch) info.version = versionMatch[1].replace(/["']/g, "");
    }
  }

  return { title: info.title ?? "API", version: info.version ?? "unknown", paths };
}

function detectSpecFormat(content: string): "json" | "yaml" {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{")) return "json";
  return "yaml";
}

function specToMarkdown(spec: SpecDoc): string {
  const lines: string[] = [];
  lines.push(`# ${spec.title}`);
  lines.push("");
  lines.push(`> Version: ${spec.version}`);
  if (spec.description) {
    lines.push("");
    lines.push(spec.description);
  }
  lines.push("");
  lines.push(`## Endpoints (${spec.paths.reduce((n, p) => n + p.operations.length, 0)})`);
  for (const path of spec.paths) {
    lines.push("");
    lines.push(`### \`${path.path}\``);
    for (const op of path.operations) {
      const summary = op.summary ?? op.operationId ?? "";
      lines.push("");
      lines.push(`**${op.method}** ${summary}`);
      if (op.description) lines.push(op.description);
      if (op.operationId) lines.push(`\`operationId: ${op.operationId}\``);
    }
  }
  return lines.join("\n");
}

function markdownToHtml(markdown: string, title: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const body = escaped
    .split(/\r?\n/)
    .map((line) => {
      const h1 = /^# (.*)$/.exec(line);
      if (h1) return `<h1>${h1[1]}</h1>`;
      const h2 = /^## (.*)$/.exec(line);
      if (h2) return `<h2>${h2[1]}</h2>`;
      const h3 = /^### (.*)$/.exec(line);
      if (h3) return `<h3>${h3[1]}</h3>`;
      const bold = /^\*\*(.*)\*\*$/.exec(line);
      if (bold) return `<p><strong>${bold[1]}</strong></p>`;
      if (line.startsWith("> ")) return `<blockquote>${line.slice(2)}</blockquote>`;
      if (line.trim() === "") return "";
      return `<p>${line}</p>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}h1,h2,h3{color:#111}code{background:#f4f4f4;padding:2px 6px;border-radius:4px}blockquote{color:#555;border-left:4px solid #ddd;padding-left:12px}</style></head><body>${body}</body></html>`;
}

function dataUrl(mime: string, content: string): string {
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

async function fetchSpec(env: Env, repo: string, specPath?: string): Promise<string> {
  const candidates = specPath
    ? [specPath]
    : ["openapi.json", "openapi.yaml", "openapi.yml", "swagger.json", "swagger.yaml", "api/openapi.json", "api/openapi.yaml", "docs/openapi.yaml"];
  for (const path of candidates) {
    const content = await readRepoFile(env, repo, path);
    if (content) return content;
  }
  throw new Error(`no OpenAPI spec found in ${repo} (tried ${candidates.join(", ")})`);
}

export class DocsGeneratorTool extends WorkerEntrypoint<Env> {
  async generateApiDocs(input: { repo?: string; specPath?: string; format?: string }): Promise<{ docsUrl: string }> {
    const repo = input.repo ?? requireSecret(this.env, "GITHUB_REPO");
    const content = await fetchSpec(this.env, repo, input.specPath);
    const spec = detectSpecFormat(content) === "json" ? specFromJson(JSON.parse(content)) : specFromYaml(content);
    const markdown = specToMarkdown(spec);
    const format = (input.format ?? "markdown").toLowerCase();

    const docsUrl =
      format === "html"
        ? dataUrl("text/html", markdownToHtml(markdown, spec.title))
        : dataUrl("text/markdown", markdown);
    return { docsUrl };
  }

  async buildDocsSite(input: { repo?: string; outputDir?: string }): Promise<{ siteUrl: string }> {
    const repo = input.repo ?? requireSecret(this.env, "GITHUB_REPO");
    const readme =
      (await readRepoFile(this.env, repo, "README.md")) ??
      (await readRepoFile(this.env, repo, "docs/index.md")) ??
      (await readRepoFile(this.env, repo, "index.md")) ??
      "";

    let specSection = "";
    try {
      const content = await fetchSpec(this.env, repo);
      const spec = detectSpecFormat(content) === "json" ? specFromJson(JSON.parse(content)) : specFromYaml(content);
      specSection = `\n\n# API Reference\n\n${specToMarkdown(spec)}`;
    } catch {
      specSection = "";
    }

    const siteUrl = dataUrl("text/html", markdownToHtml(readme + specSection, repo));
    return { siteUrl };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
