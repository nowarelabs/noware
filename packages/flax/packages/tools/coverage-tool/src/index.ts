import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

function requireSecret(env: Env, key: string): string {
  const v = env[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`${key} binding is not configured on this worker`);
  }
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
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface IstanbulSummary {
  lines?: { total: number; covered: number; skipped: number; pct: number };
  statements?: { total: number; covered: number; skipped: number; pct: number };
  functions?: { total: number; covered: number; skipped: number; pct: number };
  branches?: { total: number; covered: number; skipped: number; pct: number };
  [key: string]: unknown;
}

function pct(covered: number, total: number): number {
  return total === 0 ? 100 : Math.round((covered / total) * 1000) / 10;
}

function parseIstanbul(json: Record<string, any>): unknown {
  const total: Record<string, unknown> = {};
  const files: unknown[] = [];
  for (const [path, metrics] of Object.entries(json)) {
    if (!metrics || typeof metrics !== "object") continue;
    const m = metrics as IstanbulSummary;
    if (path === "total") {
      total.lines = m.lines;
      total.statements = m.statements;
      total.functions = m.functions;
      total.branches = m.branches;
    } else {
      files.push({ path, lines: m.lines });
    }
  }
  const lines = total.lines as { covered: number; total: number } | undefined;
  const overall = lines ? pct(lines.covered, lines.total) : 0;
  return { format: "istanbul-summary-json", overall: { lines: overall }, total, files };
}

function parseLcov(content: string): unknown {
  let totalFound = 0;
  let totalHit = 0;
  let fnFound = 0;
  let fnHit = 0;
  let brFound = 0;
  let brHit = 0;
  const files: unknown[] = [];
  let current: { path: string; lf: number; lh: number; fF: number; fH: number; bF: number; bH: number } | null = null;
  for (const line of content.split("\n")) {
    const [key, value] = line.split(":");
    if (key === "SF") {
      current = { path: value, lf: 0, lh: 0, fF: 0, fH: 0, bF: 0, bH: 0 };
      files.push(current);
    } else if (current) {
      const n = Number(value);
      if (key === "LF") { current.lf = n; totalFound += n; }
      else if (key === "LH") { current.lh = n; totalHit += n; }
      else if (key === "FNF") { current.fF = n; fnFound += n; }
      else if (key === "FNH") { current.fH = n; fnHit += n; }
      else if (key === "BRF") { current.bF = n; brFound += n; }
      else if (key === "BRH") { current.bH = n; brHit += n; }
    }
  }
  return {
    format: "lcov",
    overall: {
      lines: pct(totalHit, totalFound),
      functions: pct(fnHit, fnFound),
      branches: pct(brHit, brFound),
    },
    files: files.map((f: any) => ({
      path: f.path,
      lines: pct(f.lh, f.lf),
      functions: pct(f.fH, f.fF),
      branches: pct(f.bH, f.bF),
    })),
  };
}

async function defaultBranch(env: Env, repo: string): Promise<string> {
  const info = await ghFetch(env, `/repos/${repo}`);
  return info.default_branch ?? "main";
}

const cachedReports = new Map<string, unknown>();

export class CoverageTool extends WorkerEntrypoint<Env> {
  async getCoverageReport(input: { repo?: string; ref?: string }): Promise<unknown> {
    const repo = input.repo ?? (this.env.GITHUB_REPO as string | undefined) ?? "NO_REPO_CONFIGURED";
    const ref = input.ref ?? (repo === "NO_REPO_CONFIGURED" ? "main" : await defaultBranch(this.env, repo));
    const cacheKey = `${repo}:${ref}`;
    if (cachedReports.has(cacheKey)) return cachedReports.get(cacheKey);

    if (repo === "NO_REPO_CONFIGURED") {
      return { repo, found: false, message: "GITHUB_REPO binding not configured and no repo given" };
    }

    const candidates = [
      "coverage/coverage-summary.json",
      "coverage/lcov.info",
      "coverage/clover.xml",
      "coverage/coverage.json",
      "coverage/coverage-final.json",
    ];

    for (const path of candidates) {
      try {
        const res = await ghFetch(this.env, `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`);
        if (res && typeof res.content === "string") {
          const content = decodeBase64(res.content);
          let report: unknown;
          if (path.endsWith(".json")) {
            report = parseIstanbul(JSON.parse(content));
          } else if (path.endsWith(".info")) {
            report = parseLcov(content);
          } else {
            continue;
          }
          const result = { repo, ref, found: true, source: path, ...(report as object) };
          cachedReports.set(cacheKey, result);
          return result;
        }
      } catch {
        // file not present, try next
      }
    }

    const result = { repo, ref, found: false, message: `no coverage report found in ${repo} (tried ${candidates.join(", ")})` };
    cachedReports.set(cacheKey, result);
    return result;
  }
}

function decodeBase64(b64: string): string {
  return atob(b64);
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
