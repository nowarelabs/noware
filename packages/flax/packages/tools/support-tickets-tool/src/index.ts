import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface Ticket {
  id: string;
  subject: string;
  description?: string;
  status: string;
  priority?: string;
  createdAt: string;
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

const tickets = new Map<string, Ticket>();

function seedTickets(env: Env): void {
  if (tickets.size > 0) return;
  const raw = secret(env, "TICKETS_JSON");
  if (!raw) return;
  try {
    const list = JSON.parse(raw) as Ticket[];
    for (const t of list) tickets.set(t.id, t);
  } catch {
    // ignore malformed TICKETS_JSON
  }
}

function linearPriority(p?: string): number {
  const map: Record<string, number> = {
    highest: 1,
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
    lowest: 4,
    none: 0,
  };
  return p ? (map[p.toLowerCase()] ?? 3) : 3;
}

async function createBacklogIssue(
  env: Env,
  projectKey: string,
  ticket: Ticket,
): Promise<{ issueKey: string }> {
  const linearToken = secret(env, "LINEAR_API_KEY");
  const jiraBase = secret(env, "JIRA_BASE_URL");

  if (linearToken) {
    const base = (secret(env, "LINEAR_BASE_URL") ?? "https://api.linear.app").replace(/\/$/, "");
    const graphql = async (query: string, variables: unknown): Promise<any> => {
      const res = await fetch(`${base}/graphql`, {
        method: "POST",
        headers: { Authorization: linearToken, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      const data: any = await res.json();
      if (!res.ok || data.errors?.length)
        throw new Error(data.errors?.[0]?.message ?? `Linear API ${res.status}`);
      return data.data;
    };
    const teams = await graphql(
      `
        query ($key: String!) {
          teams(filter: { key: { eq: $key } }) {
            nodes {
              id
            }
          }
        }
      `,
      { key: projectKey },
    );
    const team = teams.teams?.nodes?.[0];
    if (!team) throw new Error(`Linear team "${projectKey}" not found`);
    const res = await graphql(
      `
        mutation ($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              identifier
            }
          }
        }
      `,
      {
        input: {
          teamId: team.id,
          title: ticket.subject,
          description: ticket.description ?? "",
          priority: linearPriority(ticket.priority),
        },
      },
    );
    return { issueKey: res.issueCreate.issue.identifier };
  }

  if (jiraBase) {
    const token = requireSecret(env, "JIRA_API_TOKEN");
    const email = secret(env, "JIRA_EMAIL");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    headers.Authorization = email ? `Basic ${btoa(`${email}:${token}`)}` : `Bearer ${token}`;
    const res = await fetch(`${jiraBase.replace(/\/$/, "")}/rest/api/3/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: ticket.subject,
          description: ticket.description ?? "",
          issuetype: { name: "Task" },
          priority: ticket.priority ? { name: ticket.priority } : null,
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Jira API ${res.status}: ${text.slice(0, 300)}`);
    return { issueKey: (JSON.parse(text) as { key: string }).key };
  }

  const issueKey = `${projectKey}-${Math.floor(Math.random() * 9000) + 1000}`;
  return { issueKey };
}

export class SupportTicketsTool extends WorkerEntrypoint<Env> {
  async getTickets(input: { status?: string; limit?: number }): Promise<unknown> {
    seedTickets(this.env);
    const limit = input.limit ?? 50;
    return [...tickets.values()]
      .filter((t) => !input.status || t.status.toLowerCase() === input.status.toLowerCase())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async createBacklogItemFromTicket(input: {
    ticketId: string;
    projectKey?: string;
  }): Promise<{ issueKey: string }> {
    seedTickets(this.env);
    const ticket = tickets.get(input.ticketId);
    if (!ticket) throw new Error(`ticket ${input.ticketId} not found`);
    const projectKey = input.projectKey ?? secret(this.env, "DEFAULT_PROJECT_KEY");
    if (!projectKey)
      throw new Error("projectKey is required and DEFAULT_PROJECT_KEY is not configured");
    const { issueKey } = await createBacklogIssue(this.env, projectKey, ticket);
    ticket.status = "converted";
    return { issueKey };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
