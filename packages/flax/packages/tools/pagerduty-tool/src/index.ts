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

async function pdFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.pagerduty.com${path}`, {
    ...init,
    headers: {
      Authorization: `Token token=${requireSecret(env, "PAGERDUTY_API_KEY")}`,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PagerDuty API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function isId(value: string): boolean {
  return /^[A-Z0-9]{6,}$/.test(value) && !value.includes(" ");
}

async function resolveServiceId(env: Env, service?: string): Promise<string> {
  const configured = secret(env, "PAGERDUTY_SERVICE_ID");
  if (configured) return configured;
  if (!service) throw new Error("service is required (or set PAGERDUTY_SERVICE_ID)");
  if (isId(service)) return service;
  const res = await pdFetch(env, `/services?query=${encodeURIComponent(service)}`);
  const match = res.services?.find((s: any) => s.name.toLowerCase() === service.toLowerCase());
  if (!match) throw new Error(`PagerDuty service "${service}" not found`);
  return match.id;
}

export class PagerdutyTool extends WorkerEntrypoint<Env> {
  async createIncident(input: { title: string; severity?: string; service?: string }): Promise<{ incidentId: string }> {
    const serviceId = await resolveServiceId(this.env, input.service);
    const urgency = input.severity === "critical" ? "high" : "low";
    const res = await pdFetch(this.env, "/incidents", {
      method: "POST",
      body: JSON.stringify({
        incident: {
          type: "incident",
          title: input.title,
          service: { id: serviceId, type: "service_reference" },
          urgency,
          body: { type: "incident_body", details: `Created by flax pagerduty-tool with severity ${input.severity ?? "medium"}.` },
        },
      }),
    });
    return { incidentId: res.incident.id };
  }

  async getOnCall(input: { schedule?: string }): Promise<unknown> {
    let path = "/oncalls";
    if (input.schedule) {
      if (isId(input.schedule)) {
        path = `/oncalls?schedule_ids[]=${input.schedule}`;
      } else {
        const schedules = await pdFetch(this.env, `/schedules?query=${encodeURIComponent(input.schedule)}`);
        const match = schedules.schedules?.find((s: any) => s.name.toLowerCase() === input.schedule!.toLowerCase());
        if (!match) throw new Error(`PagerDuty schedule "${input.schedule}" not found`);
        path = `/oncalls?schedule_ids[]=${match.id}`;
      }
    }
    const res = await pdFetch(this.env, path);
    return (res.oncalls ?? []).map((o: any) => ({
      user: o.user?.summary ?? null,
      email: o.user?.email ?? null,
      schedule: o.schedule?.summary ?? null,
      escalationLevel: o.escalation_level,
      start: o.start,
      end: o.end,
    }));
  }

  async resolveIncident(input: { incidentId: string; resolution?: string }): Promise<{ resolved: boolean }> {
    await pdFetch(this.env, `/incidents/${input.incidentId}`, {
      method: "PUT",
      body: JSON.stringify({
        incident: {
          type: "incident_reference",
          status: "resolved",
          resolution: input.resolution ?? "Resolved via flax pagerduty-tool.",
        },
      }),
    });
    return { resolved: true };
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
