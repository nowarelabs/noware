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

function optionalSecret(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

async function ghFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${requireSecret(env, "GITHUB_TOKEN")}`,
      ...init.headers,
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

async function k8sFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const base = requireSecret(env, "K8S_BASE_URL").replace(/\/$/, "");
  const token = requireSecret(env, "K8S_TOKEN");
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kubernetes API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const deployments = new Map<string, { image: string; status: string; updatedAt: string }>();

function imageRef(repo: string, tag: string, sha: string): string {
  return `registry.example.com/${repo}:${tag}-${sha.slice(0, 8)}`;
}

export class ContainersTool extends WorkerEntrypoint<Env> {
  async buildImage(input: {
    repo?: string;
    dockerfile?: string;
    tag?: string;
  }): Promise<{ image: string }> {
    const buildUrl = optionalSecret(this.env, "CONTAINER_BUILD_URL");
    const repo = input.repo ?? requireSecret(this.env, "GITHUB_REPO");
    const tag = input.tag ?? "latest";

    if (buildUrl) {
      const res = await fetch(`${buildUrl.replace(/\/$/, "")}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, dockerfile: input.dockerfile ?? "Dockerfile", tag }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`container build failed (${res.status}): ${text.slice(0, 300)}`);
      const data = JSON.parse(text || "{}");
      return {
        image:
          data.image ??
          data.imageRef ??
          `${buildUrl.replace(/^https?:\/\//, "")}/library/${repo}:${tag}`,
      };
    }

    const head = await ghFetch(this.env, `/repos/${repo}/git/ref/heads/main`).catch(() =>
      ghFetch(this.env, `/repos/${repo}/git/ref/heads/master`),
    );
    const image = imageRef(repo, tag, head?.object?.sha ?? "latest");
    return { image };
  }

  async deployToK8s(input: {
    image: string;
    namespace?: string;
    manifest?: unknown;
  }): Promise<{ deployment: string }> {
    const namespace = input.namespace ?? optionalSecret(this.env, "K8S_NAMESPACE") ?? "default";
    const name = input.image
      .split("/")
      .pop()!
      .split(":")[0]
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase();

    const k8sBase = optionalSecret(this.env, "K8S_BASE_URL");
    if (k8sBase && this.env.K8S_TOKEN) {
      const manifest = (input.manifest as any) ?? {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: { name, namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name } },
            spec: { containers: [{ name, image: input.image, imagePullPolicy: "IfNotPresent" }] },
          },
        },
      };
      await k8sFetch(this.env, `/apis/apps/v1/namespaces/${namespace}/deployments`, {
        method: "POST",
        body: JSON.stringify(manifest),
      });
    }

    deployments.set(name, {
      image: input.image,
      status: "deployed",
      updatedAt: new Date().toISOString(),
    });
    return { deployment: name };
  }

  async getDeploymentStatus(input: { deployment: string; namespace?: string }): Promise<unknown> {
    const k8sBase = optionalSecret(this.env, "K8S_BASE_URL");
    if (k8sBase && this.env.K8S_TOKEN) {
      const namespace = input.namespace ?? optionalSecret(this.env, "K8S_NAMESPACE") ?? "default";
      const dep = await k8sFetch(
        this.env,
        `/apis/apps/v1/namespaces/${namespace}/deployments/${input.deployment}`,
      );
      const conditions = dep.status?.conditions ?? [];
      return {
        deployment: input.deployment,
        namespace,
        replicas: dep.status?.replicas ?? 0,
        availableReplicas: dep.status?.availableReplicas ?? 0,
        readyReplicas: dep.status?.readyReplicas ?? 0,
        conditions: conditions.map((c: any) => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
          message: c.message,
        })),
        updatedAt: dep.metadata?.creationTimestamp ?? null,
      };
    }

    const local = deployments.get(input.deployment);
    if (!local) throw new Error(`deployment "${input.deployment}" not found`);
    return {
      deployment: input.deployment,
      image: local.image,
      status: local.status,
      updatedAt: local.updatedAt,
    };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
