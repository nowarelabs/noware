import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface StoredEvent {
  event: string;
  timestamp: string;
  userId?: string;
  properties?: Record<string, unknown>;
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

async function analyticsFetch(env: Env, body: unknown): Promise<unknown> {
  const base = requireSecret(env, "ANALYTICS_BASE_URL").replace(/\/$/, "");
  const key = secret(env, "ANALYTICS_API_KEY");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${base}/query`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`analytics API ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const events: StoredEvent[] = [];

function dayStart(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 86400000);
}

export class AnalyticsTool extends WorkerEntrypoint<Env> {
  async getFunnel(input: { eventSteps: string[]; startDate: string; endDate: string }): Promise<unknown> {
    if (secret(this.env, "ANALYTICS_BASE_URL")) {
      return analyticsFetch(this.env, { type: "funnel", ...input });
    }

    const steps = input.eventSteps.map((event) => {
      const count = events.filter((e) => e.event === event).length;
      return { event, count };
    });
    const first = steps[0]?.count ?? 0;
    const withConversion = steps.map((step, i) => ({
      ...step,
      conversion: first > 0 ? Math.round((step.count / first) * 1000) / 10 : 0,
      dropoff: i === 0 ? 0 : first > 0 ? Math.round(((first - step.count) / first) * 1000) / 10 : 0,
    }));
    const last = withConversion[withConversion.length - 1]?.count ?? 0;
    return {
      eventSteps: input.eventSteps,
      startDate: input.startDate,
      endDate: input.endDate,
      steps: withConversion,
      overallConversion: first > 0 ? Math.round((last / first) * 1000) / 10 : 0,
      note: "in-memory analytics (ANALYTICS_BASE_URL not configured); track events via trackEvent()",
    };
  }

  async getCohort(input: { startDate: string; retentionDays?: number }): Promise<unknown> {
    if (secret(this.env, "ANALYTICS_BASE_URL")) {
      return analyticsFetch(this.env, { type: "cohort", ...input });
    }

    const days = input.retentionDays ?? 30;
    const start = dayStart(input.startDate);
    const cohort: { dayOffset: number; date: string; activeUsers: number }[] = [];
    for (let i = 0; i < days; i++) {
      const day = start + i;
      const matching = events.filter((e) => dayStart(e.timestamp) === day);
      const users = new Set(matching.map((e) => e.userId ?? e.event)).size;
      cohort.push({ dayOffset: i, date: new Date(day * 86400000).toISOString().slice(0, 10), activeUsers: users });
    }
    return {
      startDate: input.startDate,
      retentionDays: days,
      cohort,
      note: "in-memory analytics (ANALYTICS_BASE_URL not configured)",
    };
  }

  async queryEvent(input: { event: string; filters?: unknown }): Promise<unknown> {
    if (secret(this.env, "ANALYTICS_BASE_URL")) {
      return analyticsFetch(this.env, { type: "event", ...input });
    }

    const filters = (input.filters ?? {}) as Record<string, unknown>;
    const matching = events.filter((e) => {
      if (e.event !== input.event) return false;
      for (const [key, value] of Object.entries(filters)) {
        if (e.properties?.[key] !== value) return false;
      }
      return true;
    });
    return {
      event: input.event,
      count: matching.length,
      sample: matching.slice(0, 10),
      note: "in-memory analytics (ANALYTICS_BASE_URL not configured)",
    };
  }

  async trackEvent(input: { event: string; userId?: string; properties?: unknown; timestamp?: string }): Promise<{ received: boolean }> {
    events.push({ event: input.event, userId: input.userId, properties: (input.properties ?? {}) as Record<string, unknown>, timestamp: input.timestamp ?? new Date().toISOString() });
    return { received: true };
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
