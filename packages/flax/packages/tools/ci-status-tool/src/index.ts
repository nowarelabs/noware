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
      ...init.headers,
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

async function defaultBranch(env: Env, repo: string): Promise<string> {
  const info = await ghFetch(env, `/repos/${repo}`);
  return info.default_branch ?? "main";
}

export class CiStatusTool extends WorkerEntrypoint<Env> {
  async getBuildStatus(input: { repo?: string; ref?: string }): Promise<unknown> {
    const repo = input.repo ?? requireSecret(this.env, "GITHUB_REPO");
    const ref = input.ref ?? (await defaultBranch(this.env, repo));
    const runs = await ghFetch(
      this.env,
      `/repos/${repo}/actions/runs?branch=${encodeURIComponent(ref)}&per_page=20`,
    );
    const latest = runs.workflow_runs ?? [];
    return {
      repo,
      ref,
      latestRun: latest[0]
        ? {
            id: latest[0].id,
            name: latest[0].name,
            status: latest[0].status,
            conclusion: latest[0].conclusion,
            createdAt: latest[0].created_at,
            htmlUrl: latest[0].html_url,
          }
        : null,
      runs: latest.map((r: any) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        event: r.event,
      })),
    };
  }

  async getTestResults(input: { repo?: string; ref?: string }): Promise<unknown> {
    const repo = input.repo ?? requireSecret(this.env, "GITHUB_REPO");
    const ref = input.ref ?? (await defaultBranch(this.env, repo));
    const checks = await ghFetch(this.env, `/repos/${repo}/commits/${ref}/check-runs?per_page=100`);
    const testChecks = (checks.check_runs ?? []).filter((c: any) =>
      /test|spec|e2e|jest|pytest|vitest/i.test(c.name),
    );
    const annotations: unknown[] = [];
    for (const c of testChecks) {
      try {
        const ann = await ghFetch(this.env, `/repos/${repo}/check-runs/${c.id}/annotations`);
        annotations.push(...ann);
      } catch {
        // annotations are optional per check run
      }
    }
    return {
      repo,
      ref,
      testSuites: testChecks.map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        conclusion: c.conclusion,
        startedAt: c.started_at,
        completedAt: c.completed_at,
      })),
      failureCount: testChecks.filter((c: any) => c.conclusion === "failure").length,
      annotations: annotations.slice(0, 100).map((a: any) => ({
        path: a.path,
        startLine: a.start_line,
        endLine: a.end_line,
        annotationLevel: a.annotation_level,
        message: a.message,
      })),
    };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
