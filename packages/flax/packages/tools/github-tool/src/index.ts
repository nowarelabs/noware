import { WorkerEntrypoint } from "cloudflare:workers";

import { authForRepo, repoFromPath } from "./github-app";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

async function ghFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const authorization = await authForRepo(env, repoFromPath(path));
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: authorization,
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

function toRefPath(ref: string): string {
  if (ref.startsWith("refs/")) return ref;
  return ref.includes("/") ? ref : `heads/${ref}`;
}

export class GithubTool extends WorkerEntrypoint<Env> {
  async createPullRequest(input: {
    repo: string;
    branch: string;
    title: string;
    body: string;
    base?: string;
  }): Promise<{ prUrl: string }> {
    const pr = await ghFetch(this.env, `/repos/${input.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        head: input.branch,
        base: input.base ?? (await defaultBranch(this.env, input.repo)),
        body: input.body,
      }),
    });
    return { prUrl: pr.html_url };
  }

  async getPullRequest(input: { repo: string; prNumber: number }): Promise<unknown> {
    return ghFetch(this.env, `/repos/${input.repo}/pulls/${input.prNumber}`);
  }

  async mergePullRequest(input: {
    repo: string;
    prNumber: number;
    method?: string;
  }): Promise<{ merged: boolean }> {
    const res = await ghFetch(this.env, `/repos/${input.repo}/pulls/${input.prNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify({ merge_method: input.method ?? "squash" }),
    });
    return { merged: res.merged === true };
  }

  async getIssue(input: { repo: string; issueNumber: number }): Promise<unknown> {
    return ghFetch(this.env, `/repos/${input.repo}/issues/${input.issueNumber}`);
  }

  async createBranch(input: {
    repo: string;
    branch: string;
    fromRef?: string;
  }): Promise<{ ref: string }> {
    const base = input.fromRef ?? (await defaultBranch(this.env, input.repo));
    const refInfo = await ghFetch(this.env, `/repos/${input.repo}/git/ref/${toRefPath(base)}`);
    await ghFetch(this.env, `/repos/${input.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${input.branch}`, sha: refInfo.object.sha }),
    });
    return { ref: `refs/heads/${input.branch}` };
  }

  async commitFiles(input: {
    repo: string;
    branch: string;
    files: unknown[];
    message: string;
  }): Promise<{ sha: string }> {
    const files = input.files as { path: string; content: string; encoding?: string }[];
    if (files.length === 0) throw new Error("no files provided");
    const headRef = await ghFetch(this.env, `/repos/${input.repo}/git/ref/heads/${input.branch}`);
    const headSha = headRef.object.sha;
    const headCommit = await ghFetch(this.env, `/repos/${input.repo}/git/commits/${headSha}`);

    const treeItems: unknown[] = [];
    for (const file of files) {
      const blob = await ghFetch(this.env, `/repos/${input.repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: file.content, encoding: file.encoding ?? "utf-8" }),
      });
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const tree = await ghFetch(this.env, `/repos/${input.repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: treeItems }),
    });

    const newCommit = await ghFetch(this.env, `/repos/${input.repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: input.message, tree: tree.sha, parents: [headSha] }),
    });

    await ghFetch(this.env, `/repos/${input.repo}/git/refs/heads/${input.branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    return { sha: newCommit.sha };
  }

  async createTag(input: { repo: string; tag: string; ref?: string }): Promise<{ ref: string }> {
    const base = input.ref ?? (await defaultBranch(this.env, input.repo));
    const refInfo = await ghFetch(this.env, `/repos/${input.repo}/git/ref/${toRefPath(base)}`);
    const tagObj = await ghFetch(this.env, `/repos/${input.repo}/git/tags`, {
      method: "POST",
      body: JSON.stringify({
        tag: input.tag,
        message: input.tag,
        object: refInfo.object.sha,
        type: "commit",
      }),
    });
    await ghFetch(this.env, `/repos/${input.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/tags/${input.tag}`, sha: tagObj.sha }),
    });
    return { ref: `refs/tags/${input.tag}` };
  }

  async getDiff(input: { repo: string; base: string; head: string }): Promise<unknown> {
    return ghFetch(this.env, `/repos/${input.repo}/compare/${input.base}...${input.head}`);
  }

  async getCiStatus(input: { repo: string; ref?: string }): Promise<unknown> {
    const ref = input.ref ?? (await defaultBranch(this.env, input.repo));
    const [checkRuns, runs] = await Promise.all([
      ghFetch(this.env, `/repos/${input.repo}/commits/${ref}/check-runs`),
      ghFetch(
        this.env,
        `/repos/${input.repo}/actions/runs?branch=${encodeURIComponent(ref)}&per_page=10`,
      ),
    ]);
    return {
      ref,
      checkRuns: (checkRuns.check_runs ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        conclusion: c.conclusion,
        htmlUrl: c.html_url,
      })),
      workflowRuns: (runs.workflow_runs ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        htmlUrl: r.html_url,
      })),
    };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
