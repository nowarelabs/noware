import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service?: string;
  message: string;
}

function secret(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

const logs: LogEntry[] = [];

function seedLogs(env: Env): void {
  if (logs.length > 0) return;
  const raw = secret(env, "LOGS_JSON");
  if (!raw) return;
  try {
    const list = JSON.parse(raw) as LogEntry[];
    logs.push(...list);
  } catch {
    // ignore malformed LOGS_JSON
  }
}

function timeRangeMs(timeRange?: string): number {
  if (!timeRange) return 24 * 60 * 60 * 1000;
  const m = /^(\d+)([smhdw])$/.exec(timeRange);
  const unitMs: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return (m ? Number(m[1]) : 24) * (unitMs[m?.[2] ?? "h"] ?? 3600000);
}

function matches(query: string, entry: LogEntry): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const parts = trimmed.split(/\s+/);
  return parts.every((part) => {
    const [key, value] = part.split(":");
    if (value !== undefined) {
      if (key === "level") return entry.level.toLowerCase() === value.toLowerCase();
      if (key === "service") return entry.service?.toLowerCase().includes(value.toLowerCase()) ?? false;
      return entry.message.toLowerCase().includes(part.toLowerCase());
    }
      return entry.message.toLowerCase().includes(part.toLowerCase()) || (entry.service?.toLowerCase().includes(part.toLowerCase()) ?? false);
  });
}

export class LogAggregationTool extends WorkerEntrypoint<Env> {
  async queryLogs(input: { query: string; timeRange?: string; limit?: number }): Promise<unknown> {
    seedLogs(this.env);
    const windowMs = timeRangeMs(input.timeRange);
    const cutoff = Date.now() - windowMs;
    const limit = input.limit ?? 100;

    const matching = logs
      .filter((l) => new Date(l.timestamp).getTime() >= cutoff)
      .filter((l) => matches(input.query, l))
      .slice(-limit);

    const levelCounts: Record<string, number> = {};
    for (const l of matching) levelCounts[l.level] = (levelCounts[l.level] ?? 0) + 1;

    return {
      query: input.query,
      timeRange: input.timeRange ?? "24h",
      resultCount: matching.length,
      levelCounts,
      logs: matching,
      note: "in-memory log store (LOGS_JSON can seed it)",
    };
  }

  async tailLogs(input: { query: string }): Promise<unknown> {
    seedLogs(this.env);
    const matching = logs.filter((l) => matches(input.query, l)).slice(-50);
    return {
      query: input.query,
      live: false,
      logs: matching,
      note: "in-memory log store; returns last 50 matching entries",
    };
  }

  async ingest(input: { level: string; message: string; service?: string }): Promise<{ id: string }> {
    const id = `log-${crypto.randomUUID()}`;
    logs.push({ id, timestamp: new Date().toISOString(), level: input.level, service: input.service, message: input.message });
    return { id };
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
