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
      ...(init.headers ?? {}),
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

const SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "HTTP Strict Transport Security",
  "content-security-policy": "Content Security Policy",
  "x-frame-options": "Clickjacking protection (X-Frame-Options)",
  "x-content-type-options": "MIME sniffing protection (X-Content-Type-Options)",
  "referrer-policy": "Referrer Policy",
  "permissions-policy": "Permissions Policy",
};

const DAST_PROBES = ["/.env", "/.git/config", "/robots.txt", "/admin", "/.well-known/security.txt"];

interface DastFinding {
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  recommendation: string;
}

export class SecurityScanTool extends WorkerEntrypoint<Env> {
  async runSast(input: { repo: string; ref?: string }): Promise<unknown> {
    const ref = input.ref;
    const path = `/repos/${input.repo}/code-scanning/alerts?state=open` + (ref ? `&ref=${encodeURIComponent(ref)}` : "");
    const alerts = await ghFetch(this.env, path);
    const mapped = (alerts ?? []).map((a: any) => ({
      number: a.number,
      state: a.state,
      rule: a.rule?.id,
      severity: a.rule?.severity,
      securitySeverity: a.rule?.security_severity_level,
      description: a.rule?.description,
      tool: a.tool?.name,
      htmlUrl: a.html_url,
    }));
    return {
      repo: input.repo,
      tool: "github-code-scanning",
      openAlertCount: mapped.length,
      alerts: mapped,
    };
  }

  async runDast(input: { targetUrl: string }): Promise<unknown> {
    const url = input.targetUrl;
    const findings: DastFinding[] = [];

    if (!url.startsWith("https://")) {
      findings.push({
        severity: "high",
        title: "Non-HTTPS target",
        detail: `The target ${url} does not use TLS.`,
        recommendation: "Serve the application over HTTPS with a valid certificate.",
      });
    }

    let res: Response;
    try {
      res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    } catch (err) {
      throw new Error(`DAST could not reach ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }

    for (const [header, label] of Object.entries(SECURITY_HEADERS)) {
      if (!res.headers.get(header)) {
        findings.push({
          severity: header === "strict-transport-security" || header === "content-security-policy" ? "high" : "medium",
          title: `Missing security header: ${label}`,
          detail: `Response from ${url} did not include the ${header} header.`,
          recommendation: `Add "${header}" to the response headers.`,
        });
      }
    }

    const singleCookie = res.headers.get("set-cookie");
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : singleCookie ? [singleCookie] : [];
    for (const cookie of setCookie) {
      if (!/;\s*HttpOnly/i.test(cookie)) {
        findings.push({ severity: "low", title: "Cookie without HttpOnly flag", detail: "A Set-Cookie header lacks HttpOnly.", recommendation: "Set the HttpOnly flag on session cookies." });
      }
      if (!/;\s*Secure/i.test(cookie)) {
        findings.push({ severity: "low", title: "Cookie without Secure flag", detail: "A Set-Cookie header lacks Secure.", recommendation: "Set the Secure flag on cookies." });
      }
    }

    for (const probe of DAST_PROBES) {
      try {
        const probeRes = await fetch(new URL(probe, url).toString(), { signal: AbortSignal.timeout(10000) });
        if (probeRes.ok) {
          findings.push({
            severity: probe === "/.env" || probe === "/.git/config" ? "critical" : "low",
            title: `Exposed path: ${probe}`,
            detail: `GET ${probe} returned HTTP ${probeRes.status}.`,
            recommendation: probe === "/robots.txt" || probe === "/.well-known/security.txt" ? "None; this file is intended to be public." : "Restrict access or remove this file from the web root.",
          });
        }
      } catch {
        // unreachable probe is fine
      }
    }

    return {
      targetUrl: url,
      httpStatus: res.status,
      findings,
      findingCount: findings.length,
      highSeverityCount: findings.filter((f) => f.severity === "high" || f.severity === "critical").length,
    };
  }

  async scanDependencies(input: { repo?: string; manifestPath?: string }): Promise<unknown> {
    const repo = input.repo ?? requireSecret(this.env, "GITHUB_REPO");
    const alerts = await ghFetch(this.env, `/repos/${repo}/dependabot/alerts?state=open&per_page=100`);
    const mapped = (alerts ?? []).map((a: any) => ({
      number: a.number,
      state: a.state,
      securityAdvisory: a.security_advisory
        ? {
            ghsaId: a.security_advisory.ghsa_id,
            cveId: a.security_advisory.cve_id ?? null,
            severity: a.security_advisory.severity,
            summary: a.security_advisory.summary,
          }
        : null,
      package: a.security_vulnerability?.package,
      vulnerableVersionRange: a.security_vulnerability?.vulnerable_version_range,
      patchedVersions: a.security_vulnerability?.first_patched_version?.identifier ?? null,
      htmlUrl: a.html_url,
    }));
    return {
      repo,
      tool: "github-dependabot",
      openAlertCount: mapped.length,
      criticalCount: mapped.filter((a: any) => a.securityAdvisory?.severity === "critical").length,
      highCount: mapped.filter((a: any) => a.securityAdvisory?.severity === "high").length,
      alerts: mapped,
    };
  }

  async scanSecrets(input: { repo: string; ref?: string }): Promise<unknown> {
    const alerts = await ghFetch(this.env, `/repos/${input.repo}/secret-scanning/alerts?state=open&per_page=100`);
    const mapped = (alerts ?? []).map((a: any) => ({
      number: a.number,
      state: a.state,
      secretType: a.secret_type,
      secretTypeDisplayName: a.secret_type_display_name,
      location: a.location ? { path: a.location.path, line: a.location.start_line } : null,
      htmlUrl: a.html_url,
    }));
    return {
      repo: input.repo,
      tool: "github-secret-scanning",
      openAlertCount: mapped.length,
      alerts: mapped,
    };
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
