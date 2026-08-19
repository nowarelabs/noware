import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface TestCase {
  name: string;
  suite: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
}

function seed(seedValue: number): () => number {
  let s = seedValue >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stableSeed(...parts: (string | undefined)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const s = part ?? "";
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

function defaultSuites(level: string, filter?: string): string[] {
  const suites: Record<string, string[]> = {
    unit: ["math", "strings", "api-handlers", "utils", "storage", "validation"],
    integration: ["auth-flow", "database", "messaging", "payments", "webhooks"],
    e2e: ["checkout", "signup", "dashboard", "settings"],
  };
  const list = suites[level] ?? [];
  return filter ? list.filter((s) => s.includes(filter.toLowerCase())) : list;
}

interface TestRun {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  tests: TestCase[];
}

function simulateRun(
  level: string,
  scope: string,
  suite: string,
  repo: string | undefined,
): TestRun {
  const rand = seed(stableSeed(level, suite, repo));
  const count = 5 + Math.floor(rand() * 12);
  const passRate = 0.7 + rand() * 0.3;
  const tests: TestCase[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rand();
    const status: TestCase["status"] =
      roll > passRate ? "failed" : roll > 0.97 ? "skipped" : "passed";
    tests.push({
      name: `${suite} test ${i + 1}`,
      suite,
      status,
      durationMs: Math.round(rand() * 400 + 5),
    });
  }
  const durationMs = tests.reduce((n, t) => n + t.durationMs, 0);
  return {
    suite,
    total: tests.length,
    passed: tests.filter((t) => t.status === "passed").length,
    failed: tests.filter((t) => t.status === "failed").length,
    skipped: tests.filter((t) => t.status === "skipped").length,
    durationMs,
    tests,
  };
}

export class TestRunnerTool extends WorkerEntrypoint<Env> {
  async runUnitTests(input: { repo?: string; filter?: string }): Promise<unknown> {
    return this.runLevel("unit", input.repo, input.filter);
  }

  async runIntegrationTests(input: { repo?: string; environment?: string }): Promise<unknown> {
    return this.runLevel("integration", input.repo, input.environment);
  }

  async runE2eTests(input: { repo?: string; suite?: string }): Promise<unknown> {
    return this.runLevel("e2e", input.repo, input.suite);
  }

  private async runLevel(level: string, repo?: string, scope?: string): Promise<unknown> {
    const suites = defaultSuites(level, scope);
    const runs = suites.map((suite) => simulateRun(level, scope ?? "", suite, repo));
    const totals = runs.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        passed: acc.passed + r.passed,
        failed: acc.failed + r.failed,
        skipped: acc.skipped + r.skipped,
        durationMs: acc.durationMs + r.durationMs,
      }),
      { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
    );
    return {
      level,
      repo: repo ?? "unknown",
      simulated: true,
      note: "deterministic simulated run; wire a real executor (e.g. GitHub Actions) for live results",
      ...totals,
      passRate: totals.total > 0 ? Math.round((totals.passed / totals.total) * 1000) / 10 : 0,
      suites: runs,
      scope: scope ?? null,
    };
  }

  async generateTestData(input: {
    schema?: unknown;
    count?: number;
  }): Promise<{ records: unknown[] }> {
    const schema = (input.schema ?? {}) as Record<string, unknown>;
    const count = Math.min(Math.max(input.count ?? 10, 1), 1000);
    const rand = seed(stableSeed(JSON.stringify(schema), String(count)));
    const records: Record<string, unknown>[] = [];

    for (let i = 0; i < count; i++) {
      const record: Record<string, unknown> = {};
      for (const [field, type] of Object.entries(schema)) {
        record[field] = this.generateValue(type, i, rand);
      }
      records.push(record);
    }
    return { records };
  }

  private generateValue(type: unknown, index: number, rand: () => number): unknown {
    if (Array.isArray(type)) {
      const options = type;
      return options[Math.floor(rand() * options.length)];
    }
    const str = String(type).toLowerCase();
    if (str.startsWith("enum:")) {
      const options = str.slice(5).split(",");
      return options[Math.floor(rand() * options.length)].trim();
    }
    switch (str) {
      case "string":
      case "text":
        return `value-${index}`;
      case "name":
        return `User ${index + 1}`;
      case "email":
        return `user${index + 1}@example.com`;
      case "uuid":
        return crypto.randomUUID();
      case "date":
        return new Date(Date.now() - Math.floor(rand() * 365 * 86400000))
          .toISOString()
          .slice(0, 10);
      case "datetime":
      case "timestamp":
        return new Date(Date.now() - Math.floor(rand() * 365 * 86400000)).toISOString();
      case "number":
      case "float":
        return Math.round(rand() * 10000) / 100;
      case "integer":
      case "int":
        return Math.floor(rand() * 100000);
      case "boolean":
      case "bool":
        return rand() > 0.5;
      case "object":
        return { id: index, source: "generated" };
      case "array":
      case "list":
        return [1, 2, 3].map(() => Math.floor(rand() * 100));
      default:
        return null;
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
