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

function commitType(commitMessage: string): string | null {
  const m =
    /^(feat|fix|perf|refactor|revert|docs|style|chore|build|ci|test)(\([^)]*\))?:\s*(.*)$/.exec(
      commitMessage,
    );
  return m ? m[1] : null;
}

function bump(version: string, type: string | null): string {
  const [major, minor, patch] = version.replace(/^v/, "").split(".").map(Number);
  if (type === "feat") return `v${major}.${minor + 1}.0`;
  if (type === "fix" || type === "perf") return `v${major}.${minor}.${patch + 1}`;
  return `v${major}.${minor}.${patch}`;
}

export class ChangelogTool extends WorkerEntrypoint<Env> {
  async generateChangelog(input: {
    repo: string;
    fromTag?: string;
    toTag?: string;
  }): Promise<{ changelog: string }> {
    const tags = await ghFetch(this.env, `/repos/${input.repo}/tags?per_page=100`);
    const tagNames: string[] = (tags ?? []).map((t: any) => t.name);
    const toTag = input.toTag ?? tagNames[0];
    if (!toTag) throw new Error(`repo ${input.repo} has no tags; create a tag first`);
    const fromTag = input.fromTag ?? tagNames[1];

    const compare = await ghFetch(this.env, `/repos/${input.repo}/compare/${fromTag}...${toTag}`);
    const commits: any[] = compare.commits ?? [];
    const grouped = new Map<string, string[]>();
    for (const commit of commits) {
      const type = commitType(commit.commit.message);
      const subject = (commit.commit.message.split("\n")[0] ?? "").replace(/^\w+.*?:\s*/, "");
      const entry = `- ${subject} ([${commit.sha.slice(0, 7)}](https://github.com/${input.repo}/commit/${commit.sha}))`;
      const bucket = type ?? "other";
      if (!grouped.has(bucket)) grouped.set(bucket, []);
      grouped.get(bucket)!.push(entry);
    }

    const headings: Record<string, string> = {
      feat: "## Features",
      fix: "## Bug Fixes",
      perf: "## Performance",
      refactor: "## Refactors",
      revert: "## Reverts",
      docs: "## Documentation",
      style: "## Style",
      chore: "## Chores",
      build: "## Build",
      ci: "## CI",
      test: "## Tests",
      other: "## Other",
    };

    const next = bump(
      toTag,
      commits.find((c) => commitType(c.commit.message))?.commit.message
        ? commitType(commits.find((c) => commitType(c.commit.message))!.commit.message)
        : null,
    );

    const sections = [...grouped.entries()]
      .filter(([, entries]) => entries.length > 0)
      .map(([bucket, entries]) => `${headings[bucket]}\n\n${entries.join("\n")}`)
      .join("\n\n");

    const changelog = [
      `# ${input.repo} Changelog`,
      ``,
      `## ${toTag} (${new Date(compare.base_commit?.commit?.committer?.date ?? Date.now()).toISOString().slice(0, 10)})`,
      ``,
      `Compare: ${fromTag}...${toTag}`,
      ``,
      sections || "_No commits in this range._",
      ``,
      `> Suggested next version: ${next}`,
    ].join("\n");

    return { changelog };
  }

  async getVersionHistory(input: { repo: string; limit?: number }): Promise<unknown> {
    const tags = await ghFetch(this.env, `/repos/${input.repo}/tags?per_page=${input.limit ?? 20}`);
    const versions = [];
    for (const tag of tags ?? []) {
      try {
        const commit = await ghFetch(
          this.env,
          `/repos/${input.repo}/git/commits/${tag.commit.sha}`,
        );
        versions.push({
          tag: tag.name,
          sha: tag.commit.sha,
          date: commit.committer?.date ?? commit.author?.date ?? null,
        });
      } catch {
        versions.push({ tag: tag.name, sha: tag.commit.sha, date: null });
      }
    }
    return { repo: input.repo, versions };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
