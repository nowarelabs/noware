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

async function readRepoFile(
  env: Env,
  repo: string,
  path: string,
): Promise<{ content: string; encoding: string } | null> {
  try {
    const res = await ghFetch(env, `/repos/${repo}/contents/${path}`);
    if (!res || typeof res.content !== "string") return null;
    return { content: res.content, encoding: res.encoding ?? "base64" };
  } catch {
    return null;
  }
}

function decode(content: string, encoding: string): string {
  if (encoding === "base64") return atob(content);
  return content;
}

async function registryLicense(pkg: string, version: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/${version}`);
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.license ?? data.licenses?.[0]?.type ?? null;
  } catch {
    return null;
  }
}

function spdxSbom(
  deps: { name: string; version: string; license?: string | null }[],
  root: { name: string; version: string },
): unknown {
  const packages = [
    {
      SPDXID: "SPDXRef-Package-0",
      name: root.name,
      versionInfo: root.version,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: "NOASSERTION",
      licenseDeclared: "NOASSERTION",
    },
    ...deps.map((d, i) => ({
      SPDXID: `SPDXRef-Package-${i + 1}`,
      name: d.name,
      versionInfo: d.version,
      downloadLocation: `NOASSERTION`,
      filesAnalyzed: false,
      licenseConcluded: "NOASSERTION",
      licenseDeclared: d.license ?? "NOASSERTION",
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceType: "purl",
          referenceLocator: `pkg:npm/${d.name}@${d.version}`,
        },
      ],
    })),
  ];
  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${root.name} SBOM`,
    documentNamespace: `https://flax.dev/sbom/${crypto.randomUUID()}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ["Tool: flax-sbom-tool"],
    },
    packages,
    relationships: [
      ...deps.map((_, i) => ({
        spdxElementId: "SPDXRef-DOCUMENT",
        relationshipType: "DESCRIBES",
        relatedSpdxElement: `SPDXRef-Package-${i + 1}`,
      })),
    ],
  };
}

function cyclonedxSbom(
  deps: { name: string; version: string; license?: string | null }[],
  root: { name: string; version: string },
): unknown {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    metadata: {
      component: {
        type: "application",
        name: root.name,
        version: root.version,
        "bom-ref": "pkg:npm/" + root.name + "@" + root.version,
      },
      timestamp: new Date().toISOString(),
      tools: [{ vendor: "flax", name: "sbom-tool" }],
    },
    components: deps.map((d) => ({
      type: "library",
      name: d.name,
      version: d.version,
      "bom-ref": `pkg:npm/${d.name}@${d.version}`,
      licenses: d.license ? [{ license: { name: d.license } }] : [],
    })),
  };
}

export class SbomTool extends WorkerEntrypoint<Env> {
  async generateSbom(input: { repo?: string; format?: string }): Promise<{ sbom: unknown }> {
    const repo = input.repo ?? requireSecret(this.env, "GITHUB_REPO");
    const format = (input.format ?? "spdx").toLowerCase();

    const candidates = [
      "package.json",
      "packages/package.json",
      "requirements.txt",
      "pyproject.toml",
    ];
    let manifest: { path: string; content: string } | null = null;
    for (const path of candidates) {
      const file = await readRepoFile(this.env, repo, path);
      if (file) {
        manifest = { path, content: decode(file.content, file.encoding) };
        break;
      }
    }
    if (!manifest)
      throw new Error(`no dependency manifest found in ${repo} (tried ${candidates.join(", ")})`);

    let deps: { name: string; version: string; license?: string | null }[] = [];
    let root = { name: repo, version: "0.0.0" };

    if (manifest.path.endsWith("package.json")) {
      const pkg = JSON.parse(manifest.content);
      root = { name: pkg.name ?? repo, version: pkg.version ?? "0.0.0" };
      const all = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
        ...(pkg.optionalDependencies ?? {}),
      };
      deps = Object.entries(all).map(([name, version]) => ({ name, version: String(version) }));
      const settled = await Promise.allSettled(
        deps.slice(0, 50).map((d) => registryLicense(d.name, d.version.replace(/[^0-9.]/g, ""))),
      );
      deps = deps.map((d, i) => ({
        ...d,
        license:
          i < settled.length && settled[i].status === "fulfilled"
            ? (settled[i] as PromiseFulfilledResult<string | null>).value
            : null,
      }));
    } else {
      for (const line of manifest.content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        if (manifest.path.endsWith("requirements.txt")) {
          const m = /^([A-Za-z0-9_.\-]+)(?:[=<>!~]+([^;\s]+))?/.exec(t);
          if (m) deps.push({ name: m[1], version: m[2] ?? "latest" });
        } else if (manifest.path.endsWith("pyproject.toml")) {
          const m = /^([A-Za-z0-9_.\-]+)\s*(?:=\s*"?([^"]+)"?)?/.exec(t);
          if (m && m[1] !== "name") deps.push({ name: m[1], version: m[2]?.trim() ?? "latest" });
        }
      }
    }

    const sbom = format === "cyclonedx" ? cyclonedxSbom(deps, root) : spdxSbom(deps, root);
    return { sbom };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
