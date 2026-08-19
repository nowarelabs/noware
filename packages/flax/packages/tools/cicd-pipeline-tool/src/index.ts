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

async function defaultBranch(env: Env, repo: string): Promise<string> {
  const info = await ghFetch(env, `/repos/${repo}`);
  return info.default_branch ?? "main";
}

const provisionedEnvironments = new Map<string, string>();

export class CicdPipelineTool extends WorkerEntrypoint<Env> {
  async triggerPipeline(input: {
    pipeline: string;
    branch?: string;
    vars?: unknown;
  }): Promise<{ runId: string }> {
    const repo = requireSecret(this.env, "GITHUB_REPO");
    const ref = input.branch ?? (await defaultBranch(this.env, repo));

    const workflowFile =
      input.pipeline.includes("/") ||
      input.pipeline.endsWith(".yml") ||
      input.pipeline.endsWith(".yaml")
        ? input.pipeline
        : await (async () => {
            const workflows = await ghFetch(
              this.env,
              `/repos/${repo}/actions/workflows?per_page=100`,
            );
            const match = (workflows.workflows ?? []).find(
              (w: any) =>
                w.name === input.pipeline || w.path === `.github/workflows/${input.pipeline}.yml`,
            );
            if (!match) throw new Error(`workflow "${input.pipeline}" not found in ${repo}`);
            return match.path;
          })();

    await ghFetch(this.env, `/repos/${repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: "POST",
      headers: { Accept: "application/vnd.github+json" },
      body: JSON.stringify({ ref, inputs: input.vars ?? {} }),
    });

    const runs = await ghFetch(
      this.env,
      `/repos/${repo}/actions/runs?branch=${encodeURIComponent(ref)}&event=workflow_dispatch&per_page=1`,
    );
    const latest = runs.workflow_runs?.[0];
    if (!latest) {
      throw new Error(
        "workflow dispatched but run id could not be determined; check GitHub Actions",
      );
    }
    return { runId: String(latest.id) };
  }

  async getPipelineStatus(input: { runId: string }): Promise<unknown> {
    const repo = requireSecret(this.env, "GITHUB_REPO");
    const run = await ghFetch(this.env, `/repos/${repo}/actions/runs/${input.runId}`);
    const jobs = await ghFetch(this.env, `/repos/${repo}/actions/runs/${input.runId}/jobs`);
    return {
      runId: run.id,
      workflow: run.name,
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url,
      jobs: (jobs.jobs ?? []).map((j: any) => ({
        id: j.id,
        name: j.name,
        status: j.status,
        conclusion: j.conclusion,
        steps: (j.steps ?? []).map((s: any) => ({
          name: s.name,
          status: s.status,
          conclusion: s.conclusion,
        })),
      })),
    };
  }

  async provisionEnvironment(input: {
    environment: string;
    config?: unknown;
  }): Promise<{ environmentUrl: string }> {
    const repo = requireSecret(this.env, "GITHUB_REPO");
    await ghFetch(
      this.env,
      `/repos/${repo}/environments/${encodeURIComponent(input.environment)}`,
      {
        method: "PUT",
        body: JSON.stringify({ wait_timer: 0 }),
      },
    );
    const url = `https://github.com/${repo}/environments/${encodeURIComponent(input.environment)}`;
    provisionedEnvironments.set(input.environment, url);
    return { environmentUrl: url };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
