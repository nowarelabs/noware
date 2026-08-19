import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

const manifest = new Map<string, { name: string; version: string; scope: string }>();

async function resolveVersion(
  name: string,
  version?: string,
): Promise<{ version: string; latest: string }> {
  const encoded = encodeURIComponent(name).replace(/^%40/, "@");
  const res = await fetch(`https://registry.npmjs.org/${encoded}`);
  if (!res.ok)
    throw new Error(`npm registry ${res.status} for ${name}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  const latest = data["dist-tags"]?.latest ?? "0.0.0";
  const target = version ?? latest;
  return { version: target.startsWith("^") || target.startsWith("~") ? target : target, latest };
}

export class PackageManagerTool extends WorkerEntrypoint<Env> {
  async installDependency(input: {
    package: string;
    version?: string;
    scope?: string;
  }): Promise<{ installed: string }> {
    const { version } = await resolveVersion(input.package, input.version);
    manifest.set(input.package, {
      name: input.package,
      version,
      scope: input.scope ?? "dependencies",
    });
    return { installed: `${input.package}@${version}` };
  }

  async updateDependency(input: {
    package: string;
    version?: string;
    scope?: string;
  }): Promise<{ updated: string }> {
    const { version } = await resolveVersion(input.package, input.version);
    manifest.set(input.package, {
      name: input.package,
      version,
      scope: input.scope ?? "dependencies",
    });
    return { updated: `${input.package}@${version}` };
  }

  async auditDependencies(input: { scope?: string; fix?: boolean }): Promise<unknown> {
    const deps = [...manifest.values()].filter((d) => !input.scope || d.scope === input.scope);
    if (deps.length === 0) {
      return {
        vulnerabilities: 0,
        advisories: [],
        note: "no dependencies tracked; install dependencies first",
      };
    }

    const bulk: Record<string, string[]> = {};
    for (const dep of deps) {
      const clean = dep.version.replace(/[^0-9.]/g, "");
      bulk[dep.name] = [clean];
    }

    const res = await fetch(`https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [JSON.stringify(deps.map((d) => d.name))]: deps.map((d) =>
          d.version.replace(/[^0-9.]/g, ""),
        ),
      }),
    }).catch(() => null);

    let advisories: any[] = [];
    if (res && res.ok) {
      const data: any = await res.json();
      advisories = Object.entries(data ?? {}).flatMap(([, advs]) => advs as any[]);
    }

    const mapped = advisories.map((a: any) => ({
      id: a.id,
      title: a.title ?? a.module_name,
      module: a.module_name,
      severity: a.severity,
      cvss: a.cvss?.score ?? null,
      vulnerableVersions: a.vulnerable_versions,
      patchedVersions: a.patched_versions,
    }));

    const bySeverity = (sev: string) => mapped.filter((m) => m.severity === sev).length;

    const result: any = {
      vulnerabilities: mapped.length,
      criticalCount: bySeverity("critical"),
      highCount: bySeverity("high"),
      moderateCount: bySeverity("moderate"),
      lowCount: bySeverity("low"),
      advisories: mapped.slice(0, 100),
    };

    if (input.fix) {
      const fixes: { package: string; fixedTo: string }[] = [];
      for (const dep of deps) {
        if (mapped.some((m) => m.module === dep.name)) {
          const { version } = await resolveVersion(dep.name);
          fixes.push({ package: dep.name, fixedTo: version });
          manifest.set(dep.name, { ...dep, version });
        }
      }
      result.fixes = fixes;
    }

    return result;
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
