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

async function sonarFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const base = requireSecret(env, "SONARQUBE_URL").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecret(env, "SONARQUBE_TOKEN")}`,
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SonarQube API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
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
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function githubCodeScanning(env: Env, repo: string): Promise<unknown[]> {
  const alerts = await ghFetch(env, `/repos/${repo}/code-scanning/alerts?state=open`);
  return (alerts ?? []).map((a: any) => ({
    rule: a.rule?.id,
    severity: a.rule?.severity,
    securitySeverity: a.rule?.security_severity_level,
    description: a.rule?.description,
    tool: a.tool?.name,
    path: a.most_recent_instance?.location?.path ?? null,
    htmlUrl: a.html_url,
  }));
}

const SECRET_PATTERNS = [
  { name: "AWS Access Key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub Token", re: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { name: "Private Key", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Slack Token", re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: "Stripe Key", re: /sk_live_[0-9A-Za-z]{16,}/ },
];

interface HeuristicFinding {
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  line?: number;
  rule: string;
}

function heuristicScan(filename: string, content: string): HeuristicFinding[] {
  const findings: HeuristicFinding[] = [];
  const lines = content.split(/\r?\n/);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  for (const pattern of SECRET_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.re.test(lines[i])) {
        findings.push({
          severity: "critical",
          rule: "secret-detection",
          message: `Potential ${pattern.name} committed`,
          line: i + 1,
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/console\.(log|debug)\(/.test(line))
      findings.push({
        severity: "info",
        rule: "debug-logging",
        message: "Debug logging left in production code",
        line: i + 1,
      });
    if (/TODO|FIXME|HACK/.test(line))
      findings.push({
        severity: "warning",
        rule: "todo",
        message: "Unresolved TODO/FIXME",
        line: i + 1,
      });
    if (/\beval\s*\(/.test(line))
      findings.push({
        severity: "error",
        rule: "eval-usage",
        message: "Avoid eval() - code injection risk",
        line: i + 1,
      });
    if (/innerHTML\s*=/.test(line))
      findings.push({
        severity: "warning",
        rule: "dangerous-dom",
        message: "Setting innerHTML can lead to XSS",
        line: i + 1,
      });
    if (/\b==\s*[^=]/.test(line) && !/===/.test(line))
      findings.push({
        severity: "info",
        rule: "loose-equality",
        message: "Use === instead of ==",
        line: i + 1,
      });
    if (/\bvar\s+/.test(line))
      findings.push({
        severity: "info",
        rule: "var-declaration",
        message: "Prefer const/let over var",
        line: i + 1,
      });
    if (/child_process|exec\(|spawn\(/.test(line))
      findings.push({
        severity: "warning",
        rule: "command-execution",
        message: "Shell command execution detected",
        line: i + 1,
      });
    if (ext === "py" && /^import os$/.test(line.trim()))
      findings.push({
        severity: "info",
        rule: "python-os",
        message: "Using os module (validate path usage)",
        line: i + 1,
      });
  }
  return findings;
}

export class StaticAnalysisTool extends WorkerEntrypoint<Env> {
  async analyzeCode(input: { repo?: string; path?: string }): Promise<unknown> {
    const sonarUrl = secret(this.env, "SONARQUBE_URL");
    const githubToken = secret(this.env, "GITHUB_TOKEN");

    if (sonarUrl && secret(this.env, "SONARQUBE_TOKEN")) {
      const project = secret(this.env, "SONARQUBE_PROJECT") ?? (input.repo ?? "").replace("/", "_");
      const [issues, measures] = await Promise.all([
        sonarFetch(
          this.env,
          `/api/issues/search?componentKeys=${encodeURIComponent(project)}&resolved=false&ps=100`,
        ),
        sonarFetch(
          this.env,
          `/api/measures/component?component=${encodeURIComponent(project)}&metricKeys=bugs,vulnerabilities,code_smells,duplicated_lines_density,coverage,sqale_rating,alert_status`,
        ),
      ]);
      const metric = (key: string) =>
        measures.component?.measures?.find((m: any) => m.metric === key)?.value ?? null;
      return {
        engine: "sonarqube",
        project,
        metrics: {
          bugs: metric("bugs"),
          vulnerabilities: metric("vulnerabilities"),
          codeSmells: metric("code_smells"),
          duplicatedLinesDensity: metric("duplicated_lines_density"),
          coverage: metric("coverage"),
          sqaleRating: metric("sqale_rating"),
          alertStatus: metric("alert_status"),
        },
        issues: (issues.issues ?? []).map((i: any) => ({
          rule: i.rule,
          severity: i.severity,
          type: i.type,
          message: i.message,
          path: i.component?.split(":").pop(),
          line: i.line ?? null,
          effort: i.effort,
        })),
        issueCount: issues.total ?? 0,
      };
    }

    if (githubToken && input.repo) {
      return {
        engine: "github-code-scanning",
        repo: input.repo,
        findings: await githubCodeScanning(this.env, input.repo),
      };
    }

    if (input.path && githubToken && input.repo) {
      const res = await ghFetch(this.env, `/repos/${input.repo}/contents/${input.path}`);
      const content = typeof res.content === "string" ? atob(res.content) : "";
      const findings = heuristicScan(input.path, content);
      return { engine: "builtin-heuristics", file: input.path, findings };
    }

    throw new Error(
      "static analysis requires SonarQube (SONARQUBE_URL + SONARQUBE_TOKEN) or GITHUB_TOKEN + repo",
    );
  }

  async getCodeSmells(input: { repo?: string; path?: string }): Promise<unknown> {
    const sonarUrl = secret(this.env, "SONARQUBE_URL");
    if (sonarUrl && secret(this.env, "SONARQUBE_TOKEN")) {
      const project = secret(this.env, "SONARQUBE_PROJECT") ?? (input.repo ?? "").replace("/", "_");
      const issues = await sonarFetch(
        this.env,
        `/api/issues/search?componentKeys=${encodeURIComponent(project)}&types=CODE_SMELL&resolved=false&ps=100`,
      );
      return {
        engine: "sonarqube",
        codeSmellCount: issues.total ?? 0,
        codeSmells: (issues.issues ?? []).map((i: any) => ({
          rule: i.rule,
          severity: i.severity,
          message: i.message,
          path: i.component?.split(":").pop(),
          line: i.line ?? null,
        })),
      };
    }

    if (input.path && secret(this.env, "GITHUB_TOKEN") && input.repo) {
      const res = await ghFetch(this.env, `/repos/${input.repo}/contents/${input.path}`);
      const content = typeof res.content === "string" ? atob(res.content) : "";
      const findings = heuristicScan(input.path, content).filter(
        (f) => f.severity === "info" || f.severity === "warning",
      );
      return {
        engine: "builtin-heuristics",
        file: input.path,
        codeSmellCount: findings.length,
        codeSmells: findings,
      };
    }

    throw new Error("getCodeSmells requires SonarQube credentials or GITHUB_TOKEN + repo + path");
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
