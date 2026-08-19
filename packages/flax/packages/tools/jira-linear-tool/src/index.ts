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

type Provider = "linear" | "jira" | "memory";

function provider(env: Env): Provider {
  if (secret(env, "LINEAR_API_KEY")) return "linear";
  if (secret(env, "JIRA_BASE_URL")) return "jira";
  return "memory";
}

async function linearFetch(env: Env, query: string, variables: unknown): Promise<any> {
  const base = (secret(env, "LINEAR_BASE_URL") ?? "https://api.linear.app").replace(/\/$/, "");
  const res = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: {
      Authorization: requireSecret(env, "LINEAR_API_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data: any = await res.json();
  if (!res.ok || data.errors?.length) {
    throw new Error(data.errors?.[0]?.message ?? `Linear API ${res.status}`);
  }
  return data.data;
}

function linearPriority(p?: string): number {
  const map: Record<string, number> = { highest: 1, urgent: 1, blocker: 1, high: 2, medium: 3, low: 4, lowest: 4, none: 0 };
  return p ? map[p.toLowerCase()] ?? 3 : 3;
}

function jiraHeaders(env: Env): Record<string, string> {
  const token = requireSecret(env, "JIRA_API_TOKEN");
  const email = secret(env, "JIRA_EMAIL");
  const base = { "Content-Type": "application/json", Accept: "application/json" };
  return email
    ? { ...base, Authorization: `Basic ${btoa(`${email}:${token}`)}` }
    : { ...base, Authorization: `Bearer ${token}` };
}

async function jiraFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const base = requireSecret(env, "JIRA_BASE_URL").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...jiraHeaders(env), ...((init.headers as Record<string, string>) ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Jira API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const memoryIssues = new Map<string, { key: string; projectKey: string; summary: string; description?: string; status: string; priority?: string; labels?: string[] }>();
let memoryCounter = 0;

async function linearCreateIssue(env: Env, input: { projectKey: string; summary: string; description?: string; priority?: string; labels?: string[] }): Promise<{ issueKey: string }> {
  const teams = await linearFetch(env, `query($key: String!){ teams(filter: { key: { eq: $key } }) { nodes { id key name } } }`, { key: input.projectKey });
  const team = teams.teams?.nodes?.[0];
  if (!team) throw new Error(`Linear team "${input.projectKey}" not found`);
  const res = await linearFetch(
    env,
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier title } } }`,
    { input: { teamId: team.id, title: input.summary, description: input.description ?? "", priority: linearPriority(input.priority), labelIds: input.labels ?? [] } },
  );
  return { issueKey: res.issueCreate.issue.identifier };
}

async function jiraCreateIssue(env: Env, input: { projectKey: string; summary: string; description?: string; priority?: string; labels?: string[] }): Promise<{ issueKey: string }> {
  const res = await jiraFetch(env, "/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        project: { key: input.projectKey },
        summary: input.summary,
        description: input.description ?? "",
        issuetype: { name: "Task" },
        priority: input.priority ? { name: input.priority } : null,
        labels: input.labels ?? [],
      },
    }),
  });
  return { issueKey: res.key };
}

export class JiraLinearTool extends WorkerEntrypoint<Env> {
  async createIssue(input: { projectKey: string; summary: string; description?: string; issueType?: string; priority?: string; labels?: string[] }): Promise<{ issueKey: string }> {
    const p = provider(this.env);
    if (p === "linear") return linearCreateIssue(this.env, input);
    if (p === "jira") return jiraCreateIssue(this.env, input);

    const key = `${input.projectKey}-${++memoryCounter}`;
    memoryIssues.set(key, { key, projectKey: input.projectKey, summary: input.summary, description: input.description, status: "Backlog", priority: input.priority, labels: input.labels });
    return { issueKey: key };
  }

  async updateIssue(input: { issueKey: string; fields?: Record<string, unknown>; comment?: string }): Promise<{ issueKey: string }> {
    const p = provider(this.env);
    if (p === "linear") {
      const found = await linearFetch(this.env, `query($identifier: String!){ issue(id: $identifier) { id } }`, { identifier: input.issueKey });
      if (!found.issue) throw new Error(`Linear issue "${input.issueKey}" not found`);
      const issue = found.issue as { id: string };
      const fields = (input.fields ?? {}) as Record<string, unknown>;
      const update: Record<string, unknown> = { title: fields.title, description: fields.description ?? (input.comment ? (String(fields.description ?? "") + "\n\n" + input.comment) : undefined), priority: typeof fields.priority === "number" ? fields.priority : typeof fields.priority === "string" ? linearPriority(fields.priority) : undefined };
      const clean = Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined));
      if (Object.keys(clean).length) {
        await linearFetch(this.env, `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`, { id: issue.id, input: clean });
      }
      return { issueKey: input.issueKey };
    }

    if (p === "jira") {
      if (input.comment) {
        await jiraFetch(this.env, `/rest/api/3/issue/${input.issueKey}/comment`, {
          method: "POST",
          body: JSON.stringify({ body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: input.comment }] }] } }),
        });
      }
      if (input.fields && Object.keys(input.fields).length > 0) {
        await jiraFetch(this.env, `/rest/api/3/issue/${input.issueKey}`, { method: "PUT", body: JSON.stringify({ fields: input.fields }) });
      }
      return { issueKey: input.issueKey };
    }

    const issue = memoryIssues.get(input.issueKey);
    if (!issue) throw new Error(`issue ${input.issueKey} not found`);
    if (input.fields) Object.assign(issue, input.fields);
    if (input.comment) issue.description = `${issue.description ?? ""}\n\n${input.comment}`;
    return { issueKey: input.issueKey };
  }

  async getBacklog(input: { projectKey?: string; limit?: number }): Promise<unknown> {
    const p = provider(this.env);
    const limit = input.limit ?? 50;

    if (p === "linear") {
      const teamFilter = input.projectKey ? `team: { key: { eq: "${input.projectKey}" } },` : "";
      const res = await linearFetch(
        this.env,
        `query($first: Int!) { issues(filter: { ${teamFilter} state: { type: { in: ["backlog", "triage", "unstarted"] } } }, first: $first) { nodes { identifier title priority sortOrder state { name type } } } }`,
        { first: limit },
      );
      return (res.issues?.nodes ?? []).map((i: any) => ({
        issueKey: i.identifier,
        title: i.title,
        priority: i.priority,
        sortOrder: i.sortOrder,
        state: i.state?.name,
      }));
    }

    if (p === "jira") {
      const jql = input.projectKey
        ? `project = "${input.projectKey}" AND status not in (Done, Closed)`
        : `status not in (Done, Closed)`;
      const res = await jiraFetch(this.env, `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=summary,status,priority,labels,created`);
      return (res.issues ?? []).map((i: any) => ({
        issueKey: i.key,
        summary: i.fields?.summary,
        status: i.fields?.status?.name,
        priority: i.fields?.priority?.name,
        labels: i.fields?.labels ?? [],
        created: i.fields?.created,
      }));
    }

    return [...memoryIssues.values()]
      .filter((i) => !input.projectKey || i.projectKey === input.projectKey)
      .filter((i) => i.status === "Backlog")
      .slice(0, limit);
  }

  async prioritizeBacklog(input: { issueKeys: string[]; order?: string[] }): Promise<{ issueKeys: string[] }> {
    const order = input.order ?? input.issueKeys;
    const p = provider(this.env);

    if (p === "linear") {
      let sortOrder = 10000;
      for (const key of order) {
        await linearFetch(this.env, `mutation($id: String!, $sortOrder: Float!) { issueUpdate(id: $id, input: { sortOrder: $sortOrder }) { success } }`, { id: key, sortOrder: sortOrder-- });
      }
      return { issueKeys: order };
    }

    if (p === "jira") {
      await jiraFetch(this.env, "/rest/agile/1.0/issue/rank", {
        method: "PUT",
        body: JSON.stringify({ issues: order, rankBeforeKey: order[order.length - 1] }),
      });
      return { issueKeys: order };
    }

    for (const key of order) {
      const issue = memoryIssues.get(key);
      if (issue) issue.status = "Backlog";
    }
    return { issueKeys: order };
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
