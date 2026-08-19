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

async function promFetch(env: Env, path: string): Promise<any> {
  const base = requireSecret(env, "MONITORING_BASE_URL").replace(/\/$/, "");
  const token = secret(env, "MONITORING_TOKEN");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Prometheus API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (data.status && data.status !== "success")
    throw new Error(`Prometheus query error: ${data.error ?? "unknown"}`);
  return data.data;
}

function timeRangeSeconds(timeRange?: string): { start: number; end: number } {
  const end = Date.now() / 1000;
  const m = /^(\d+)([smhdw])$/.exec(timeRange ?? "1h");
  const amount = m ? Number(m[1]) : 3600;
  const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  const seconds = amount * (unitSeconds[m?.[2] ?? "h"] ?? 3600);
  return { start: Math.floor(end - seconds), end: Math.floor(end) };
}

function syntheticSeries(metric: string, points: number): { timestamp: number; value: number }[] {
  const now = Date.now();
  const out = [];
  let base = 0;
  for (let i = 0; i < points; i++) {
    for (let c = 0; c < metric.length; c++) base = (base * 31 + metric.charCodeAt(c)) >>> 0;
    const wave = Math.sin(i / 3) * 10 + 50;
    const jitter = (base % 20) - 10;
    out.push({
      timestamp: now - (points - i) * 60000,
      value: Math.round((wave + jitter) * 100) / 100,
    });
  }
  return out;
}

const alerts = new Map<
  string,
  { name: string; condition: string; severity: string; createdAt: string }
>();

export class MonitoringTool extends WorkerEntrypoint<Env> {
  async getMetrics(input: { query: string; timeRange?: string }): Promise<unknown> {
    const baseUrl = secret(this.env, "MONITORING_BASE_URL");
    if (baseUrl) {
      const { start, end } = timeRangeSeconds(input.timeRange);
      const step = Math.max(60, Math.floor((end - start) / 60));
      const data = await promFetch(
        this.env,
        `/api/v1/query_range?query=${encodeURIComponent(input.query)}&start=${start}&end=${end}&step=${step}`,
      );
      return {
        query: input.query,
        timeRange: input.timeRange ?? "1h",
        results: (data.result ?? []).map((r: any) => ({
          metric: r.metric,
          values: (r.values ?? []).map((v: [number, string]) => ({
            timestamp: v[0],
            value: Number(v[1]),
          })),
        })),
      };
    }

    return {
      query: input.query,
      timeRange: input.timeRange ?? "1h",
      synthetic: true,
      results: [{ metric: { __name__: input.query }, values: syntheticSeries(input.query, 60) }],
      note: "MONITORING_BASE_URL not configured; returning synthetic series",
    };
  }

  async getDashboard(input: { dashboard: string; timeRange?: string }): Promise<unknown> {
    const grafana = secret(this.env, "GRAFANA_BASE_URL");
    if (grafana && secret(this.env, "GRAFANA_TOKEN")) {
      const base = grafana.replace(/\/$/, "");
      const res = await fetch(`${base}/api/dashboards/uid/${encodeURIComponent(input.dashboard)}`, {
        headers: { Authorization: `Bearer ${secret(this.env, "GRAFANA_TOKEN")}` },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Grafana API ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      return {
        dashboard: input.dashboard,
        title: data.dashboard?.title,
        panels: (data.dashboard?.panels ?? []).map((p: any) => ({
          id: p.id,
          title: p.title,
          type: p.type,
          targets: (p.targets ?? []).map((t: any) => t.expr ?? t.query ?? null),
        })),
      };
    }

    return {
      dashboard: input.dashboard,
      timeRange: input.timeRange ?? "1h",
      synthetic: true,
      panels: [
        {
          id: 1,
          title: `${input.dashboard} - requests`,
          targets: [`sum(rate(http_requests_total{dashboard="${input.dashboard}"}[5m]))`],
          values: syntheticSeries(input.dashboard, 60),
        },
        {
          id: 2,
          title: `${input.dashboard} - latency p95`,
          targets: [
            `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`,
          ],
          values: syntheticSeries(`${input.dashboard}-latency`, 60),
        },
      ],
      note: "GRAFANA_BASE_URL not configured; returning synthetic dashboard",
    };
  }

  async createAlert(input: {
    name: string;
    condition: string;
    severity?: string;
  }): Promise<{ alertId: string }> {
    const alertmanager = secret(this.env, "ALERTMANAGER_URL");
    const alertId = `alert-${crypto.randomUUID()}`;
    alerts.set(alertId, {
      name: input.name,
      condition: input.condition,
      severity: input.severity ?? "warning",
      createdAt: new Date().toISOString(),
    });

    if (alertmanager) {
      const res = await fetch(`${alertmanager.replace(/\/$/, "")}/api/v2/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            labels: { alertname: input.name, severity: input.severity ?? "warning", alertId },
            annotations: { condition: input.condition, summary: input.name },
          },
        ]),
      });
      if (!res.ok)
        throw new Error(`Alertmanager API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    return { alertId };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
